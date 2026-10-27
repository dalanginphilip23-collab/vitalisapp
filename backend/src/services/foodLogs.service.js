// Food logs — business logic + DB access.
// (AI analysis, plan suggestion, persistence, listing.)
const db = require("../config/db");
const crypto = require("crypto");
const {
  analyzeFoodImage,
  suggestPlanForMeal,
  safeParseAI,
  stripDataUriPrefix,
  callGeminiWithFallback,
} = require("../config/gemini");
const { AppError } = require("../utils/errors");
const { buildFoodDensityPrompt } = require("../constants/foodAnalysisPrompt");
const {
  per100FromServing,
  normalizeGrams,
  normalizeFoodName,
  sanitizeDensity,
} = require("../utils/nutrition");

// Module 4 — persisted meal slot. The manual form used to stuff the meal type
// into `serving` and the diary reverse-engineered it by string-matching; now
// it is a real column. Anything outside this list stores as NULL (not "Other")
// so logged_at remains the honest fallback for grouping.
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack", "Other"];

// ─── AI ANALYSIS CACHE (+ in-flight dedupe) ───
const analysisCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

setInterval(
  () => {
    const now = Date.now();
    for (const [k, v] of analysisCache) {
      if (now - v.ts > CACHE_TTL_MS) analysisCache.delete(k);
    }
    if (analysisCache.size > MAX_CACHE_ENTRIES) {
      const excess = analysisCache.size - MAX_CACHE_ENTRIES;
      const keys = [...analysisCache.keys()].slice(0, excess);
      for (const k of keys) analysisCache.delete(k);
    }
  },
  5 * 60 * 1000,
).unref?.();

function imageHash(base64Image) {
  return crypto.createHash("sha256").update(stripDataUriPrefix(base64Image)).digest("hex");
}

function getCached(base64Image) {
  const key = imageHash(base64Image);
  const entry = analysisCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    analysisCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(base64Image, result) {
  if (analysisCache.size >= 200) {
    let oldestKey = null;
    let oldestTs = Infinity;
    for (const [k, v] of analysisCache) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts;
        oldestKey = k;
      }
    }
    if (oldestKey) analysisCache.delete(oldestKey);
  }
  analysisCache.set(imageHash(base64Image), { result, ts: Date.now() });
}

// In-flight dedupe: two concurrent scans of the same photo share ONE AI call.
// Entries are deleted on settle, so failures never stick.
const inflightAnalyses = new Map();

async function analyzeAndClamp(base64Image) {
  // analyzeFoodImage returns a JSON string (never throws for provider failures —
  // it falls back to Unknown food; throws only on timeout/bug).
  const raw = await analyzeFoodImage(base64Image);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim()
      .match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse AI response as JSON");
    parsed = JSON.parse(match[0]);
  }

  // Final safety clamp — per item (supports legacy single-object shape)
  const clampItem = (it = {}) => ({
    food_name: String(it.food_name || "Unknown food").slice(0, 150),
    serving: String(it.serving || "").slice(0, 100),
    calories: Math.max(0, Math.round(Number(it.calories) || 0)),
    protein: Math.max(0, Math.round(Number(it.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(it.fat) || 0)),
    saturated_fat: Math.max(0, Math.round(Number(it.saturated_fat || 0) * 10) / 10),
    trans_fat: Math.max(0, Math.round(Number(it.trans_fat || 0) * 10) / 10),
    polyunsaturated_fat: Math.max(0, Math.round(Number(it.polyunsaturated_fat || 0) * 10) / 10),
    monounsaturated_fat: Math.max(0, Math.round(Number(it.monounsaturated_fat || 0) * 10) / 10),
    ...(it.low_confidence ? { low_confidence: true } : {}),
    // Allergen hints (safety signal) — keep the model's strings, capped.
    ...(Array.isArray(it.possible_allergens)
      ? {
          possible_allergens: it.possible_allergens
            .filter((x) => typeof x === "string" && x.trim())
            .map((x) => String(x).trim().slice(0, 40))
            .slice(0, 12),
        }
      : {}),
  });
  if (Array.isArray(parsed.items)) {
    parsed.items = parsed.items.filter(Boolean).slice(0, 8).map(clampItem);
    if (typeof parsed.suggestion === "string") parsed.suggestion = parsed.suggestion.slice(0, 200);
  } else {
    const suggestion = typeof parsed.suggestion === "string" ? parsed.suggestion : "";
    parsed = { items: [clampItem(parsed)], suggestion };
  }
  // Preserve the retryable flag from the overload fallback.
  return parsed;
}

// Returns { result, cached, joined }. Throws only on genuine AI failure.
async function analyzeImage(base64Image) {
  const cached = getCached(base64Image);
  if (cached) return { result: cached, cached: true, joined: false };

  const key = imageHash(base64Image);
  let shared = inflightAnalyses.get(key);
  const joined = Boolean(shared);
  if (!shared) {
    shared = analyzeAndClamp(base64Image).finally(() => {
      if (inflightAnalyses.get(key) === shared) inflightAnalyses.delete(key);
    });
    inflightAnalyses.set(key, shared);
  }

  const parsed = await shared;

  const onlyUnknown =
    Array.isArray(parsed.items) &&
    parsed.items.length === 1 &&
    parsed.items[0].food_name === "Unknown food" &&
    Number(parsed.items[0].calories) === 0;
  if (!onlyUnknown) setCache(base64Image, parsed);

  return { result: parsed, cached: false, joined };
}

// ─── AI PLAN SUGGESTION ───
async function suggestPlan(userId, body) {
  const { food_name, calories, protein, carbs, fat, caloriesSoFar: clientSoFar } = body;

  // Day-basis fix: prefer the client's browser-local day total when valid.
  const clientValid =
    clientSoFar !== undefined &&
    clientSoFar !== null &&
    clientSoFar !== "" &&
    Number.isFinite(Number(clientSoFar)) &&
    Number(clientSoFar) >= 0 &&
    Number(clientSoFar) <= 100000;

  const [[{ caloriesSoFar }], [plans], [gRows]] = await Promise.all([
    clientValid
      ? Promise.resolve([[{ caloriesSoFar: Math.round(Number(clientSoFar)) }]])
      : db
          .execute(
            `SELECT COALESCE(SUM(calories), 0) AS caloriesSoFar
             FROM food_logs WHERE user_id = ? AND logged_at >= CURDATE() AND logged_at < CURDATE() + INTERVAL 1 DAY`,
            [userId],
          )
          .then(([r]) => r),
    db
      .execute(
        `SELECT p.*, IF(up.user_id IS NULL, 0, 1) AS is_enrolled
         FROM plans p
         LEFT JOIN user_plans up ON p.id = up.plan_id AND up.user_id = ?
         ORDER BY p.id ASC`,
        [userId],
      )
      .then(([r]) => r),
    db
      .execute(
        "SELECT daily_kcal FROM fitness_goals WHERE user_id = ? AND status = ? ORDER BY id DESC LIMIT 1",
        [userId, "active"],
      )
      .then(([r]) => r)
      .catch(() => []),
  ]);

  const meal = {
    food_name,
    calories: calories || 0,
    protein: protein || 0,
    carbs: carbs || 0,
    fat: fat || 0,
  };
  const calorieGoal = gRows[0]?.daily_kcal ? Number(gRows[0].daily_kcal) : 2000;
  const dailyContext = { caloriesSoFar: Math.round(Number(caloriesSoFar) || 0), calorieGoal };

  const raw = await suggestPlanForMeal(meal, plans, dailyContext);
  const { parsed: aiResult, raw: rawText } = safeParseAI(raw);
  if (!aiResult?.message) {
    return {
      food_name: meal.food_name,
      calories: meal.calories,
      message: String(rawText).slice(0, 600),
      reasoning: "AI returned plain text.",
      estimated_minutes: null,
      recommended_plan: plans.find((p) => p.is_enrolled === 1) || plans[0] || null,
      recommended_source: null,
      has_enrolled_plans: plans.some((p) => p.is_enrolled === 1),
      has_any_plans: plans.length > 0,
    };
  }

  const recommendedPlan =
    plans.find((p) => String(p.id) === String(aiResult.recommended_plan_id)) || null;
  const recommendedSource = recommendedPlan
    ? recommendedPlan.is_enrolled === 1
      ? "enrolled"
      : "marketplace"
    : null;

  return {
    food_name: meal.food_name,
    calories: meal.calories,
    message: aiResult.message,
    reasoning: aiResult.reasoning,
    estimated_minutes: (() => {
      const n = Math.round(Number(aiResult.estimated_minutes));
      return Number.isFinite(n) && n >= 5 && n <= 300 ? n : null;
    })(),
    recommended_plan: recommendedPlan,
    recommended_source: recommendedSource,
    has_enrolled_plans: plans.some((p) => p.is_enrolled === 1),
    has_any_plans: plans.length > 0,
  };
}

// ─── AI DENSITY ESTIMATE (per 100 g) ───
// Best-effort cache: a database that has not run 044 still gets estimates, it
// just cannot reuse them. Never let a cache failure block the user's estimate.
function isMissingTableError(err) {
  return Boolean(err) && (err.code === "ER_NO_SUCH_TABLE" || err.errno === 1146);
}

async function readDensityCache(nameNormalized) {
  try {
    const [[row]] = await db.execute(
      `SELECT display_name, calories, protein, carbs, fat, source
         FROM food_nutrition_cache WHERE name_normalized = ? LIMIT 1`,
      [nameNormalized],
    );
    if (!row) return null;
    const per100 = sanitizeDensity(row);
    if (!per100) return null;
    return { name: row.display_name, per100, source: row.source || "ai" };
  } catch (err) {
    if (isMissingTableError(err)) return null;
    throw err;
  }
}

async function writeDensityCache(nameNormalized, displayName, per100) {
  try {
    await db.execute(
      `INSERT INTO food_nutrition_cache
         (name_normalized, display_name, calories, protein, carbs, fat, source)
       VALUES (?, ?, ?, ?, ?, ?, 'ai')
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         calories = VALUES(calories),
         protein = VALUES(protein),
         carbs = VALUES(carbs),
         fat = VALUES(fat),
         hit_count = hit_count + 1`,
      [nameNormalized, displayName, per100.calories, per100.protein, per100.carbs, per100.fat],
    );
  } catch (err) {
    if (isMissingTableError(err)) return;
    console.warn("[food-density] cache write failed:", err.code || err.message);
  }
}

// Per-100 g nutrition for an arbitrary dish name. Catalog-first would not
// help here (the service only sees names that missed the catalog); the cache
// makes repeat dishes instant.
async function estimateFoodDensity(foodName) {
  const displayName = String(foodName || "").replace(/\s+/g, " ").trim().slice(0, 150);
  if (displayName.length < 2) {
    throw new AppError("Enter a food name first (at least 2 characters).", 400, "INVALID_FOOD_NAME");
  }
  const key = normalizeFoodName(displayName);
  if (!key) {
    throw new AppError("That food name cannot be estimated.", 400, "INVALID_FOOD_NAME");
  }

  const cached = await readDensityCache(key);
  if (cached) return { ...cached, cached: true };

  const raw = await callGeminiWithFallback(buildFoodDensityPrompt(displayName));
  const { parsed } = safeParseAI(raw, null);
  if (!parsed) {
    // callGeminiWithFallback returns a plain "high demand" string, never throws.
    const unavailable = /high demand|try again|unavailable/i.test(String(raw));
    throw new AppError(
      unavailable
        ? "AI nutrition estimate is unavailable right now. Try again in a moment."
        : "Could not estimate nutrition for that food. Enter the values manually.",
      unavailable ? 503 : 422,
      unavailable ? "AI_ESTIMATE_UNAVAILABLE" : "AI_ESTIMATE_UNUSABLE",
    );
  }

  const per100 = sanitizeDensity(parsed);
  if (!per100) {
    throw new AppError(
      "Could not estimate nutrition for that food. Enter the values manually.",
      422,
      "AI_ESTIMATE_UNUSABLE",
    );
  }

  await writeDensityCache(key, displayName, per100);
  return { name: displayName, per100, source: "ai", cached: false };
}

// ─── PERSISTENCE ───
async function saveFoodLog(userId, body) {
  const {
    food_name,
    serving,
    grams,
    meal_type,
    calories,
    protein,
    carbs,
    fat,
    saturated_fat,
    trans_fat,
    polyunsaturated_fat,
    monounsaturated_fat,
    image_url,
  } = body;

  const foodNameNorm = String(food_name).trim().slice(0, 150);
  const servingNorm = typeof serving === "string" ? serving.trim().slice(0, 100) || null : null;
  const gramsNorm = normalizeGrams(grams);
  // No explicit serving text but a weight was logged → show the portion in the
  // diary ("250 g"). Keeps older clients/scan items exactly as before.
  const servingText = servingNorm || (gramsNorm ? `${gramsNorm} g` : null);
  // Reject unknown slots (e.g. free-text) rather than storing garbage.
  const mealTypeNorm = MEAL_TYPES.includes(meal_type) ? meal_type : null;

  const round1 = (v) => (v != null && v !== "" ? Math.round(Number(v) * 10) / 10 : 0);
  const sFat = round1(saturated_fat);
  const tFat = round1(trans_fat);
  const pFat = round1(polyunsaturated_fat);
  const mFat = round1(monounsaturated_fat);

  let insertId;
  // Try full schema first (with grams + fat breakdown)
  try {
    const [result] = await db.execute(
      `INSERT INTO food_logs (user_id, food_name, serving, grams, meal_type, calories, protein, carbs, fat, saturated_fat, trans_fat, polyunsaturated_fat, monounsaturated_fat, image_url, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        foodNameNorm,
        servingText,
        gramsNorm,
        mealTypeNorm,
        calories || 0,
        protein || 0,
        carbs || 0,
        fat || 0,
        sFat,
        tFat,
        pFat,
        mFat,
        image_url || null,
      ],
    );
    insertId = result.insertId;
  } catch (colErr) {
    if (colErr.code !== "ER_BAD_FIELD_ERROR") throw colErr;
    // Fallback: without grams + fat breakdown columns (pre-043 schema)
    try {
      const [result] = await db.execute(
        `INSERT INTO food_logs (user_id, food_name, serving, meal_type, calories, protein, carbs, fat, image_url, logged_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [userId, foodNameNorm, servingText, mealTypeNorm, calories || 0, protein || 0, carbs || 0, fat || 0, image_url || null],
      );
      insertId = result.insertId;
    } catch (e2) {
      if (e2.code !== "ER_BAD_FIELD_ERROR") throw e2;
      // Fallback: minimal schema
      try {
        const [result] = await db.execute(
          `INSERT INTO food_logs (user_id, food_name, meal_type, calories, protein, carbs, fat, image_url, logged_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [userId, foodNameNorm, mealTypeNorm, calories || 0, protein || 0, carbs || 0, fat || 0, image_url || null],
        );
        insertId = result.insertId;
      } catch (e3) {
        if (e3.code !== "ER_BAD_FIELD_ERROR") throw e3;
        throw new AppError(
          "Database schema mismatch — cannot insert food log",
          500,
          "SCHEMA_MISMATCH",
        );
      }
    }
  }

  return { insertId };
}

async function getMealContext(userId) {
  const [[user]] = await db.execute("SELECT email FROM users WHERE id = ?", [userId]);
  const [[summary]] = await db.execute(
    `SELECT
       COALESCE(SUM(calories), 0) AS calories,
       COALESCE(SUM(protein),  0) AS protein,
       COALESCE(SUM(carbs),    0) AS carbs,
       COALESCE(SUM(fat),      0) AS fat,
       COALESCE(SUM(saturated_fat), 0) AS saturated_fat,
       COALESCE(SUM(trans_fat), 0) AS trans_fat,
       COALESCE(SUM(polyunsaturated_fat), 0) AS polyunsaturated_fat,
       COALESCE(SUM(monounsaturated_fat), 0) AS monounsaturated_fat
     FROM food_logs
     WHERE user_id = ? AND logged_at >= CURDATE() AND logged_at < CURDATE() + INTERVAL 1 DAY`,
    [userId],
  );
  return { email: user?.email || null, summary };
}

function buildMealNotification(summary) {
  return `Meal logged! Today: ${Math.round(summary.calories)} kcal | P: ${Math.round(summary.protein)}g | C: ${Math.round(summary.carbs)}g | F: ${Math.round(summary.fat)}g | Sat:${Number(summary.saturated_fat || 0).toFixed(1)}g Trans:${Number(summary.trans_fat || 0).toFixed(1)}g`;
}

async function insertNotification(userId, message) {
  await db.execute("INSERT INTO notifications (user_id, message) VALUES (?, ?)", [userId, message]);
}

async function listFoodLogs(userId, limit, offset) {
  let rows;
  // NOTE: db.query (not execute) — server-side prepares reject placeholders in
  // LIMIT/OFFSET on some MySQL versions.
  try {
    [rows] = await db.query(
      `SELECT id, food_name, serving, grams, meal_type, calories, protein, carbs, fat, saturated_fat, trans_fat, polyunsaturated_fat, monounsaturated_fat, image_url,
                DATE_FORMAT(logged_at, '%Y-%m-%d %H:%i') AS logged_at
         FROM food_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
  } catch (colErr) {
    if (colErr.code !== "ER_BAD_FIELD_ERROR") throw colErr;
    try {
      [rows] = await db.query(
        `SELECT id, food_name, serving, meal_type, calories, protein, carbs, fat, image_url,
                  DATE_FORMAT(logged_at, '%Y-%m-%d %H:%i') AS logged_at
           FROM food_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT ? OFFSET ?`,
        [userId, limit, offset],
      );
    } catch (e2) {
      if (e2.code !== "ER_BAD_FIELD_ERROR") throw e2;
      [rows] = await db.query(
        `SELECT id, food_name, meal_type, calories, protein, carbs, fat, image_url,
                  DATE_FORMAT(logged_at, '%Y-%m-%d %H:%i') AS logged_at
           FROM food_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT ? OFFSET ?`,
        [userId, limit, offset],
      );
    }
  }
  const [[countRow]] = await db.execute("SELECT COUNT(*) AS total FROM food_logs WHERE user_id = ?", [
    userId,
  ]);
  return { records: rows, total: countRow?.total ?? 0 };
}

// Module 4 — food catalog autocomplete (GET /api/food-catalog?q=).
// Seeded reference table; case-insensitive prefix-then-contains ranking.
// Returns both the reference serving values and a derived per-100 g density so
// the manual form can scale macros from a user-entered weight.
async function searchFoodCatalog(q, limit = 20) {
  const term = String(q || "").trim().slice(0, 80);
  const cap = Math.min(Math.max(Number(limit) || 20, 1), 50);
  if (term.length < 2) return [];
  const like = `%${term}%`;
  let rows;
  try {
    [rows] = await db.query(
      `SELECT name, serving_label, serving_grams, calories, protein, carbs, fat
         FROM food_catalog
        WHERE name LIKE ?
        ORDER BY name LIKE CONCAT(?) DESC, name
        LIMIT ${cap}`,
      [like, `${term}%`],
    );
  } catch (colErr) {
    if (colErr.code !== "ER_BAD_FIELD_ERROR") throw colErr;
    // Pre-043 catalog: still serve autocomplete, just without weight scaling.
    [rows] = await db.query(
      `SELECT name, serving_label, calories, protein, carbs, fat
         FROM food_catalog
        WHERE name LIKE ?
        ORDER BY name LIKE CONCAT(?) DESC, name
        LIMIT ${cap}`,
      [like, `${term}%`],
    );
  }
  return rows.map((row) => {
    const grams = Number(row.serving_grams);
    return {
      name: row.name,
      serving_label: row.serving_label,
      serving_grams: Number.isFinite(grams) && grams > 0 ? grams : null,
      calories: Math.round(Number(row.calories) || 0),
      protein: Number(row.protein) || 0,
      carbs: Number(row.carbs) || 0,
      fat: Number(row.fat) || 0,
      per100: per100FromServing(row),
    };
  });
}

async function deleteFoodLog(userId, mealId) {
  const [result] = await db.execute("DELETE FROM food_logs WHERE id = ? AND user_id = ?", [
    mealId,
    userId,
  ]);
  return result.affectedRows > 0;
}

module.exports = {
  imageHash,
  analyzeImage,
  suggestPlan,
  saveFoodLog,
  getMealContext,
  buildMealNotification,
  insertNotification,
  listFoodLogs,
  deleteFoodLog,
  searchFoodCatalog,
  estimateFoodDensity,
  MEAL_TYPES,
  // exposed for tests / introspection
  getCached,
  setCache,
};
