const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

function devLog(...args) {
  if (process.env.NODE_ENV !== "production") console.log(...args);
}
function devWarn(...args) {
  if (process.env.NODE_ENV !== "production") console.warn(...args);
}
function devError(...args) {
  console.error(...args);
}

let _genAI = null;
let _groq = null;
function getGenAI() {
  if (!_genAI)
    _genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || "missing-key",
    );
  return _genAI;
}
function getGroq() {
  if (!_groq)
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "missing-key" });
  return _groq;
}
function aiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

// Model IDs rotatable via env. 2.0/1.5/2.5-flash are retired (404);
// 3.6-flash verified working, Groq is the final fallback.
function getTextModels() {
  const fromEnv = String(process.env.GEMINI_TEXT_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash"];
}

function getVisionModels() {
  const fromEnv = String(process.env.GEMINI_VISION_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash"];
}

// Exponential backoff with jitter for 503/429; fixed 1s for the rest.
function isRetryableError(err) {
  const msg = String((err && err.message) || err || "").toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("try again later") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource exhausted")
  );
}

function backoffSleep(attempt, err) {
  const base = isRetryableError(err) ? 2000 * Math.pow(2, attempt) : 1000;
  const capped = Math.min(base, 15000);
  const jitter = Math.floor(Math.random() * 500);
  return new Promise((r) => setTimeout(r, capped + jitter));
}

const AI_TEXT_TIMEOUT_MS = 25000;
// Env-tunable so deploys can trade latency for coverage. 40s keeps thinking
// models comfortable while the chain-wide deadline (analyzeFoodImage) still
// brings the whole scan home inside the client's abort window.
const AI_VISION_TIMEOUT_MS = Number.parseInt(process.env.AI_VISION_TIMEOUT_MS || "40000", 10) || 40000;

// SDKs expose no AbortSignal: race caps a hung provider so it fails over
// instead of parking the request (and its 10MB body) forever.

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(t));
}

async function callGeminiWithFallback(prompt) {
  // Fail fast when no keys are configured — same static fallback as before,
  // but without burning 25s x N timeouts first.
  if (!aiConfigured()) {
    devWarn("[VITALIS AI] No GEMINI_API_KEY/GROQ_API_KEY — static fallback");
    return "I'm currently experiencing high demand. Please try again in a moment.";
  }
  const models = getTextModels();

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      devLog(`[VITALIS AI] Trying ${modelName}...`);
      const model = getGenAI().getGenerativeModel({ model: modelName });
      const result = await withTimeout(model.generateContent(prompt), AI_TEXT_TIMEOUT_MS, modelName);
      const text = result.response.text();
      if (text) {
        devLog(`[VITALIS AI] ✅ Success with ${modelName}`);
        return text;
      }
      // Empty text: distinguish safety-block from capacity failure
      try {
        const reason = result?.response?.candidates?.[0]?.finishReason
          || result?.response?.promptFeedback?.blockReason;
        if (reason) devWarn(`[VITALIS AI] ${modelName} empty text (finishReason=${reason})`);
      } catch { /* candidates shape varies by SDK — best effort only */ }
    } catch (err) {
      // Retryable 503/429 (capacity pressure) is routine during demand spikes
      // and the chain continues — log as warn with next-step, not ❌ error, so
      // consoles don't look crashed when failover is working as designed.
      if (isRetryableError(err)) {
        devWarn(`[VITALIS AI] ↻ ${modelName} busy (${String(err.message).slice(0, 120)}) — trying next model…`);
      } else {
        devError(`[VITALIS AI] ❌ ${modelName} failed:`, err.message);
      }
      await backoffSleep(i, err);
    }
  }

  devWarn("[VITALIS AI] All Gemini text models failed → Groq fallback");
  try {
    const resp = await withTimeout(getGroq().chat.completions.create({
      model: "openai/gpt-oss-20b",
      max_tokens: 2000,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }), AI_TEXT_TIMEOUT_MS, "Groq openai/gpt-oss-20b");
    const text = resp.choices[0]?.message?.content;
    if (text) {
      devLog("[VITALIS AI] ✅ Success with Groq openai/gpt-oss-20b");
      return text;
    }
  } catch (groqErr) {
    devError("[VITALIS AI] ❌ Groq fallback failed:", groqErr.message);
  }

  devWarn("[VITALIS AI] All models failed — returning static fallback");
  return "I'm currently experiencing high demand. Please try again in a moment.";
}

// SECTION 2 — FOOD IMAGE ANALYSIS (vision)

// Prompt extracted to constants/foodAnalysisPrompt.js (clean separation)
const { FOOD_ANALYSIS_PROMPT } = require("../constants/foodAnalysisPrompt");

// ─── FOOD CATEGORY DETECTION ──────────────────────────────────────────────────

const BREADED_FOOD_KEYWORDS = [
  "fried",
  "breaded",
  "battered",
  "crispy",
  "nugget",
  "tempura",
  "katsu",
  "schnitzel",
  "fish and chips",
  "popcorn chicken",
  "tender",
  "wing",
  "drumstick",
  "karaage",
  "panko",
  "chicken piece",
  "chickenjoy",
  "kwek",
  "fish ball",
  "kikiam",
  "calamares",
];

const ZERO_CARB_ALLOWED = [
  "grilled chicken breast",
  "plain grilled",
  "boiled egg",
  "hard boiled",
  "steamed fish",
  "grilled fish",
  "tuna steak",
  "salmon fillet",
  "beef steak",
  "pork chop grilled",
  "shrimp grilled",
  "bacon",
];

const ZERO_FAT_ALLOWED = [
  "steamed white rice",
  "plain rice",
  "fruit",
  "watermelon",
  "banana",
  "apple",
  "mango",
  "papaya",
  "grapes",
  "black coffee",
];

// Meaty / high-protein foods must never come back with 0g protein.
// Used for the protein floor + absurd-result reject below.
const MEATY_FOOD_KEYWORDS = [
  "burger",
  "cheeseburger",
  "chicken",
  "beef",
  "pork",
  "bacon",
  "steak",
  "meat",
  "fish",
  "tuna",
  "salmon",
  "shrimp",
  "egg",
  "hotdog",
  "hot dog",
  "sausage",
  "ham",
  "turkey",
  "duck",
  "crab",
  "lobster",
  "squid",
  "octopus",
  "mussel",
  "clam",
  "oyster",
  "scallop",
  "tofu",
  "tempeh",
  "seitan",
  "cheese",
  "yogurt",
  "kebab",
  "shawarma",
  "meatball",
  "patty",
  "fillet",
  "drumstick",
  "wing",
  "thigh",
  "breast",
  "lechon",
  "adobo",
  "sisig",
  "tapa",
  "tocino",
  "longganisa",
];

// Main-dish keywords for the absurd-low-calorie reject. A full meal
// photographed as the subject can never plausibly be < 120 kcal.
const MAIN_DISH_KEYWORDS = [
  "burger",
  "cheeseburger",
  "pizza",
  "pasta",
  "spaghetti",
  "rice",
  "chicken",
  "beef",
  "pork",
  "fish",
  "sandwich",
  "noodle",
  "pancit",
  "ramen",
  "steak",
  "chop",
  "fillet",
  "platter",
  "meal",
  "combo",
  "bucket",
  "spaghetti",
  "fries",
  "lasagna",
  "burrito",
  "taco",
  "kebab",
  "curry",
  "stew",
  "soup",
  "salmon",
  "tuna",
  "shrimp",
];

function isMeatyFood(foodName = "") {
  const lower = foodName.toLowerCase();
  return MEATY_FOOD_KEYWORDS.some((kw) => lower.includes(kw));
}

function isMainDish(foodName = "") {
  const lower = foodName.toLowerCase();
  return MAIN_DISH_KEYWORDS.some((kw) => lower.includes(kw));
}

function isBreadedFood(foodName = "") {
  const lower = foodName.toLowerCase();
  return BREADED_FOOD_KEYWORDS.some((kw) => lower.includes(kw));
}

function isZeroCarbAllowed(foodName = "") {
  const lower = foodName.toLowerCase();
  return ZERO_CARB_ALLOWED.some((kw) => lower.includes(kw));
}

function isZeroFatAllowed(foodName = "") {
  const lower = foodName.toLowerCase();
  return ZERO_FAT_ALLOWED.some((kw) => lower.includes(kw));
}

function extractPieceCount(foodName = "") {
  const match = foodName.match(/\(?\b(\d+)\s*p(?:cs|ieces?|c)?\b\)?/i);
  return match ? parseInt(match[1]) : null;
}

// ─── ANCHOR DB (canonical per-serving values, mirrors foodAnalysisPrompt) ────
// Used as a plausibility guard: if AI reports < 40% of the anchor-scaled
// expectation the item is rejected (next model tried); if > 250% it is
// pulled back toward the anchor and flagged low_confidence. Within band the
// photo-specific AI estimate is kept untouched.
const ANCHOR_DB = [
  { keys: ["double cheeseburger", "double burger", "double patty burger"], unit: "pc", qty: 1, calories: 750, protein: 44, carbs: 44, fat: 40 },
  { keys: ["cheeseburger", "burger"], unit: "pc", qty: 1, calories: 550, protein: 30, carbs: 40, fat: 30 },
  { keys: ["chickenjoy", "fried chicken"], unit: "pc", qty: 1, calories: 310, protein: 22, carbs: 16, fat: 18 },
  { keys: ["steamed white rice", "steamed rice", "plain rice", "cooked rice"], unit: "cup", qty: 1, calories: 206, protein: 4, carbs: 45, fat: 0 },
  { keys: ["fried rice", "garlic fried rice", "sinangag"], unit: "cup", qty: 1, calories: 295, protein: 6, carbs: 43, fat: 10 },
  { keys: ["jolly spaghetti", "filipino spaghetti", "sweet spaghetti"], unit: "serving", qty: 1, calories: 440, protein: 14, carbs: 62, fat: 14 },
  { keys: ["carbonara"], unit: "serving", qty: 1, calories: 520, protein: 18, carbs: 52, fat: 26 },
  { keys: ["pancit canton"], unit: "serving", qty: 1, calories: 320, protein: 12, carbs: 48, fat: 8 },
  { keys: ["pancit bihon"], unit: "serving", qty: 1, calories: 280, protein: 10, carbs: 44, fat: 6 },
  { keys: ["pizza"], unit: "slice", qty: 1, calories: 270, protein: 11, carbs: 35, fat: 9 },
  { keys: ["fries", "french fries"], unit: "serving", qty: 1, calories: 365, protein: 4, carbs: 48, fat: 17 },
  { keys: ["chicken adobo"], unit: "serving", qty: 1, calories: 320, protein: 28, carbs: 8, fat: 18 },
  { keys: ["sinigang"], unit: "bowl", qty: 1, calories: 225, protein: 20, carbs: 11, fat: 10 },
  { keys: ["sisig"], unit: "serving", qty: 1, calories: 480, protein: 28, carbs: 10, fat: 36 },
  { keys: ["lechon kawali"], unit: "serving", qty: 1, calories: 480, protein: 22, carbs: 8, fat: 40 },
  { keys: ["crispy pata"], unit: "serving", qty: 1, calories: 650, protein: 38, carbs: 10, fat: 50 },
  { keys: ["tocino"], unit: "serving", qty: 1, calories: 220, protein: 14, carbs: 14, fat: 12 },
  { keys: ["longganisa"], unit: "serving", qty: 1, calories: 240, protein: 10, carbs: 10, fat: 18 },
  { keys: ["tapa"], unit: "serving", qty: 1, calories: 200, protein: 20, carbs: 4, fat: 12 },
  { keys: ["grilled chicken breast"], unit: "pc", qty: 1, calories: 330, protein: 62, carbs: 0, fat: 7 },
  { keys: ["boiled egg", "hard boiled egg", "hard-boiled egg"], unit: "pc", qty: 1, calories: 78, protein: 6, carbs: 1, fat: 5 },
  { keys: ["scrambled egg"], unit: "serving", qty: 1, calories: 180, protein: 12, carbs: 2, fat: 14 },
  { keys: ["banana"], unit: "pc", qty: 1, calories: 105, protein: 1, carbs: 27, fat: 0 },
  { keys: ["pandesal"], unit: "pc", qty: 1, calories: 150, protein: 4, carbs: 28, fat: 2 },
  { keys: ["peach mango pie"], unit: "pc", qty: 1, calories: 240, protein: 2, carbs: 36, fat: 10 },
  { keys: ["cola", "softdrink", "soft drink", "soda"], unit: "serving", qty: 1, calories: 140, protein: 0, carbs: 36, fat: 0 },
  { keys: ["milk tea", "milktea", "boba"], unit: "serving", qty: 1, calories: 380, protein: 4, carbs: 72, fat: 8 },
  // Indian
  { keys: ["chicken biryani", "biryani"], unit: "serving", qty: 1, calories: 550, protein: 28, carbs: 58, fat: 20 },
  { keys: ["butter chicken", "murgh makhani"], unit: "serving", qty: 1, calories: 480, protein: 30, carbs: 14, fat: 32 },
  { keys: ["masala dosa", "dosa"], unit: "pc", qty: 1, calories: 320, protein: 7, carbs: 55, fat: 8 },
  { keys: ["naan", "garlic naan"], unit: "pc", qty: 1, calories: 260, protein: 7, carbs: 48, fat: 5 },
  // Middle-Eastern
  { keys: ["chicken shawarma", "shawarma"], unit: "serving", qty: 1, calories: 520, protein: 32, carbs: 42, fat: 22 },
  { keys: ["falafel"], unit: "serving", qty: 1, calories: 380, protein: 12, carbs: 36, fat: 20 },
  { keys: ["hummus"], unit: "serving", qty: 1, calories: 280, protein: 8, carbs: 20, fat: 18 },
  // Western / fine-dining
  { keys: ["caesar salad", "chicken caesar"], unit: "serving", qty: 1, calories: 420, protein: 30, carbs: 14, fat: 28 },
  { keys: ["salmon", "grilled salmon"], unit: "serving", qty: 1, calories: 380, protein: 34, carbs: 2, fat: 24 },
  { keys: ["steak", "ribeye", "sirloin"], unit: "serving", qty: 1, calories: 520, protein: 42, carbs: 0, fat: 36 },
  { keys: ["ramen"], unit: "bowl", qty: 1, calories: 550, protein: 24, carbs: 62, fat: 20 },
  { keys: ["pho"], unit: "bowl", qty: 1, calories: 450, protein: 28, carbs: 58, fat: 8 },
];

// Parse "2 pcs" / "0.5 cup" / "250g" / "3 slices" / "1 bowl" from serving text.
function parseServingQuantity(serving = "") {
  const s = String(serving || "").toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(cups?|pcs?|pieces?|g(?:rams?)?|kg|slices?|bowls?|servings?|plates?|bottles?|cans?|glasses?|sachets?)/);
  if (!m) return null;
  let qty = parseFloat(m[1]);
  let unit = m[2];
  if (unit.startsWith("kg")) { qty *= 1000; unit = "g"; }
  else if (unit.startsWith("cup")) unit = "cup";
  else if (unit[0] === "p" || unit.startsWith("piece")) unit = "pc";
  else if (unit.startsWith("slic")) unit = "slice";
  else if (unit.startsWith("bowl")) unit = "bowl";
  else if (unit.startsWith("serv") || unit.startsWith("plate")) unit = "serving";
  else if (unit === "g" || unit.startsWith("gram")) unit = "g";
  else return { qty, unit: "other" };
  return { qty, unit };
}

function anchorExpected(foodName = "", serving = "") {
  const lower = String(foodName || "").toLowerCase();
  const anchor = ANCHOR_DB.find((a) => a.keys.some((k) => lower.includes(k)));
  if (!anchor) return null;
  const parsed = parseServingQuantity(serving);
  // Scale when serving unit matches anchor unit (2 pcs burger = 2x).
  if (parsed && parsed.unit === anchor.unit && parsed.qty > 0 && parsed.qty <= 12) {
    const scale = parsed.qty / anchor.qty;
    return {
      calories: anchor.calories * scale,
      protein: anchor.protein * scale,
      carbs: anchor.carbs * scale,
      fat: anchor.fat * scale,
      scaled: true,
    };
  }
  return { ...anchor, scaled: false };
}

// ─── MACRO VALIDATION & CORRECTION ───────────────────────────────────────────

function validateAndCorrectMacros(parsed) {
  let { calories, protein, carbs, fat, food_name = "" } = parsed;
  let saturated_fat = Math.max(0, Number(parsed.saturated_fat ?? 0));
  let trans_fat = Math.max(0, Number(parsed.trans_fat ?? 0));
  let polyunsaturated_fat = Math.max(
    0,
    Number(parsed.polyunsaturated_fat ?? 0),
  );
  let monounsaturated_fat = Math.max(
    0,
    Number(parsed.monounsaturated_fat ?? 0),
  );

  // Clamp negatives
  protein = Math.max(0, Math.round(Number(protein) || 0));
  carbs = Math.max(0, Math.round(Number(carbs) || 0));
  fat = Math.max(0, Math.round(Number(fat) || 0));
  calories = Math.max(1, Math.round(Number(calories) || 0));
  // Clamp fats to 1 decimal
  saturated_fat = Math.round(saturated_fat * 10) / 10;
  trans_fat = Math.round(trans_fat * 10) / 10;
  polyunsaturated_fat = Math.round(polyunsaturated_fat * 10) / 10;
  monounsaturated_fat = Math.round(monounsaturated_fat * 10) / 10;
  const sumFats =
    saturated_fat + trans_fat + polyunsaturated_fat + monounsaturated_fat;
  if (sumFats > fat + 0.5) {
    const scale = fat / Math.max(sumFats, 1);
    saturated_fat = Math.round(saturated_fat * scale * 10) / 10;
    trans_fat = Math.round(trans_fat * scale * 10) / 10;
    polyunsaturated_fat = Math.round(polyunsaturated_fat * scale * 10) / 10;
    monounsaturated_fat = Math.round(monounsaturated_fat * scale * 10) / 10;
  }

  // Enforce carbs for breaded/starchy/sweet foods
  if (carbs === 0 && !isZeroCarbAllowed(food_name)) {
    devWarn(`[VITALIS IMAGE] Zero carb correction for "${food_name}"`);
    carbs = Math.max(5, Math.round((calories * 0.1) / 4));
  }

  // Enforce fat for fried/oily foods
  if (fat === 0 && !isZeroFatAllowed(food_name)) {
    devWarn(`[VITALIS IMAGE] Zero fat correction for "${food_name}"`);
    fat = Math.max(3, Math.round((calories * 0.08) / 9));
  }

  // Protein floor for meaty / high-protein foods — 0g protein for a
  // burger, chicken, egg, cheese etc. is never plausible (e.g. the
  // "Double Cheeseburger 47 kcal P0" case). Inject a minimum derived
  // from stated calories and flag low confidence.
  let low_confidence = false;
  if (protein === 0 && isMeatyFood(food_name)) {
    protein = Math.max(8, Math.round((calories * 0.15) / 4));
    low_confidence = true;
    devWarn(`[VITALIS IMAGE] Zero protein correction for "${food_name}" → ${protein}g (low confidence)`);
  }

  // Protein cap for fried chicken by piece count
  if (isBreadedFood(food_name)) {
    const pieceCount = extractPieceCount(food_name);
    if (pieceCount) {
      const maxProtein = pieceCount * 25;
      if (protein > maxProtein) {
        devWarn(
          `[VITALIS IMAGE] Protein cap: ${protein}g → ${maxProtein}g for ${pieceCount} pieces`,
        );
        protein = maxProtein;
      }
    }

    // Minimum carbs for breaded foods
    if (carbs < 10) {
      carbs = Math.max(15, Math.round((calories * 0.12) / 4));
    }
  }

  // Always recalculate calories from macros — macros are source of truth
  const macroCalories = protein * 4 + carbs * 4 + fat * 9;

  if (macroCalories > 0) {
    const diff = Math.abs(macroCalories - calories) / Math.max(calories, 1);
    if (diff > 0.05) {
      devWarn(
        `[VITALIS IMAGE] Calorie mismatch: stated=${calories}, macro-derived=${macroCalories} — using macro-derived`,
      );
      calories = macroCalories;
    }
  }

  // Sanity cap: single dishes rarely exceed 2500 kcal
  if (calories > 2500) {
    devWarn(`[VITALIS IMAGE] Calorie cap: ${calories} → 2500`);
    const scale = 2500 / calories;
    calories = 2500;
    protein = Math.round(protein * scale);
    carbs = Math.round(carbs * scale);
    fat = Math.round(fat * scale);
  }

  // Serving is free text from AI — cap length so it fits the DB column
  const serving =
    typeof parsed.serving === "string"
      ? parsed.serving.trim().slice(0, 100)
      : "";

  // Absurd-result reject: a photographed main dish can never plausibly be
  // < 120 kcal with < 30g total macros (e.g. "Double Cheeseburger 47 kcal").
  // Return null so normalizeItems drops the item and analyzeFoodImage tries
  // the next model instead of showing a nonsense number.
  const totalMacros = protein + carbs + fat;
  if (isMainDish(food_name) && calories < 120 && totalMacros < 30) {
    devWarn(`[VITALIS IMAGE] Absurd result rejected for "${food_name}": ${calories} kcal P${protein}/C${carbs}/F${fat} — trying next model`);
    return null;
  }

  // Weight plausibility: when the model supplies estimated_weight_g,
  // kcal/g must be physically possible (0.05–9.5 covers lettuce → oil).
  // Outside that band the estimate is hallucinated → retry next model.
  const estW = Number(parsed.estimated_weight_g);
  if (estW > 0 && Number.isFinite(estW)) {
    const perGram = calories / estW;
    if (perGram < 0.05 || perGram > 9.5) {
      devWarn(`[VITALIS IMAGE] Weight implausible for "${food_name}": ${calories} kcal / ${estW}g = ${perGram.toFixed(2)}/g — trying next model`);
      return null;
    }
  }
  // Anchor plausibility guard: compare against the canonical per-serving
  // values (scaled when the serving parses, e.g. "2 pcs"). < 40% of anchor
  // means the model missed most of the food → reject (retry next model).
  // > 250% means hallucinated abundance → pull back to 1.5x anchor + flag.
  // Inside the band the photo-specific estimate is kept untouched.
  const expected = anchorExpected(food_name, serving);
  if (expected && expected.calories > 0) {
    if (calories < expected.calories * 0.4) {
      devWarn(`[VITALIS IMAGE] Anchor reject for "${food_name}": ${calories} kcal vs anchor ${Math.round(expected.calories)} — trying next model`);
      return null;
    }
    if (calories > expected.calories * 2.5) {
      const scale = (expected.calories * 1.5) / calories;
      calories = Math.round(expected.calories * 1.5);
      protein = Math.round(protein * scale);
      carbs = Math.round(carbs * scale);
      fat = Math.round(fat * scale);
      low_confidence = true;
      devWarn(`[VITALIS IMAGE] Anchor cap for "${food_name}" → ${calories} kcal (low confidence)`);
    }
  }

  return {
    ...parsed,
    serving,
    calories,
    protein,
    carbs,
    fat,
    saturated_fat,
    trans_fat,
    polyunsaturated_fat,
    monounsaturated_fat,
    ...(low_confidence ? { low_confidence: true } : {}),
  };
}

// ─── JSON PARSER ──────────────────────────────────────────────────────────────

// Balanced-brace extraction: finds the largest valid JSON object containing
// "items" (or a single food object). Replaces the old non-greedy
// /\{[\s\S]*?\}/ which stopped at the FIRST inner "}" and silently dropped
// every item past the first on multi-item plates.
function extractBalancedJSON(str) {
  let best = null;
  let searchFrom = 0;
  while (true) {
    const start = str.indexOf('{', searchFrom);
    if (start < 0) break;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < str.length; i++) {
      const c = str[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          const slice = str.slice(start, i + 1);
          try {
            const obj = JSON.parse(slice);
            if (obj && (Array.isArray(obj.items) || obj.food_name)) {
              // Prefer the parse with the most items.
              const count = Array.isArray(obj.items) ? obj.items.length : 1;
              const bestCount = best && Array.isArray(best.items) ? best.items.length : (best ? 1 : 0);
              if (!best || count > bestCount) best = obj;
            }
          } catch (_) {}
          break;
        }
      }
    }
    searchFrom = start + 1;
  }
  return best;
}

// Last resort: scrape every flat {...} block containing food_name + calories
// (for outputs truncated mid-array where no balanced object parses).
function scrapeItemBlocks(str) {
  const items = [];
  const re = /\{[^{}]*"food_name"[^{}]*\}/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    try {
      const obj = JSON.parse(m[0]);
      if (obj.food_name && obj.calories != null) items.push(obj);
    } catch (_) {}
  }
  return items;
}

function parseNutritionJSON(raw) {
  const clean = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (_) {}

  const balanced = extractBalancedJSON(clean);
  if (balanced) return balanced;

  const scraped = scrapeItemBlocks(clean);
  if (scraped.length > 0) {
    return { items: scraped.slice(0, 8), suggestion: "" };
  }

  const extract = (key) => {
    const m = clean.match(new RegExp(`"${key}"\\s*:\\s*"?([^",}]+)"?`));
    return m ? m[1].trim() : null;
  };

  const food_name = extract("food_name");
  const calories = extract("calories");
  if (!food_name || !calories) return null;

  return {
    food_name: food_name,
    serving: extract("serving") || "",
    calories: Number(calories) || 0,
    protein: Number(extract("protein")) || 0,
    carbs: Number(extract("carbs")) || 0,
    fat: Number(extract("fat")) || 0,
    saturated_fat: Number(extract("saturated_fat")) || 0,
    trans_fat: Number(extract("trans_fat")) || 0,
    polyunsaturated_fat: Number(extract("polyunsaturated_fat")) || 0,
    monounsaturated_fat: Number(extract("monounsaturated_fat")) || 0,
    suggestion: extract("suggestion") || "",
  };
}

// MULTI-ITEM NORMALIZER
function normalizeItems(raw) {
  const parsed = parseNutritionJSON(raw);
  if (!parsed) return null;

  if (Array.isArray(parsed.items)) {
    const items = parsed.items
      .filter(Boolean)
      .slice(0, 8)
      .map(validateAndCorrectMacros)
      .filter(Boolean);
    if (items.length === 0) return null;
    return {
      items,
      suggestion:
        typeof parsed.suggestion === "string"
          ? parsed.suggestion.slice(0, 200)
          : "",
    };
  }

  // Legacy single-object shape → one-item list
  if (parsed.food_name && parsed.calories != null) {
    const item = validateAndCorrectMacros(parsed);
    if (!item) return null;
    return {
      items: [item],
      suggestion: parsed.suggestion || "",
    };
  }
  return null;
}

function emptyItemsFallback(reason) {
  return {
    items: [
      {
        food_name: "Unknown food",
        serving: "",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        saturated_fat: 0,
        trans_fat: 0,
        polyunsaturated_fat: 0,
        monounsaturated_fat: 0,
      },
    ],
    suggestion:
      reason || "Could not analyze the image. Please try a clearer photo.",
  };
}

// VISION PROVIDERS
// Gemini 3.x are thinking models: hidden reasoning shares the OUTPUT token
// budget, so maxOutputTokens:1500 clipped the JSON mid-stream (diagnosed live:
// response started mid-sentence with no opening brace). Thinking is disabled,
// the budget raised, and a thinkingConfig-incompatible model degrades cleanly.
function visionGenerationConfig(modelName, allowThinkingConfig = true) {
  const config = { temperature: 0, maxOutputTokens: 4096 };
  if (allowThinkingConfig) config.thinkingConfig = { thinkingBudget: 0 };
  return config;
}

// Models that 400-rejected thinkingConfig at least once (degrade without it).
const thinkingRejected = new Set();

async function analyzeWithGeminiVision(base64Data, mimeType, modelName) {
  devLog(`[VITALIS IMAGE] Trying ${modelName}...`);
  const genAI = getGenAI();
  const call = async (allowThinkingConfig) => genAI
    .getGenerativeModel({
      model: modelName,
      generationConfig: visionGenerationConfig(modelName, allowThinkingConfig),
    })
    .generateContent([
      FOOD_ANALYSIS_PROMPT,
      { inlineData: { data: base64Data, mimeType } },
    ]);

  let result;
  try {
    result = await withTimeout(call(true), AI_VISION_TIMEOUT_MS, modelName);
  } catch (err) {
    // Older models reject thinkingConfig with INVALID_ARGUMENT — retry once
    // without it instead of burning the whole provider.
    const msg = String(err?.message || err);
    if (!thinkingRejected.has(modelName) && (msg.includes("thinking") || msg.includes("INVALID_ARGUMENT") || msg.includes("unknown field") || msg.includes("Unexpected"))) {
      devWarn(`[VITALIS IMAGE] ${modelName} rejected thinkingConfig — retrying without it`);
      thinkingRejected.add(modelName);
      result = await withTimeout(call(false), AI_VISION_TIMEOUT_MS, modelName);
    } else {
      throw err;
    }
  }

  const text = result.response.text();
  if (!text) {
    try {
      const reason = result?.response?.candidates?.[0]?.finishReason
        || result?.response?.promptFeedback?.blockReason;
      if (reason) devWarn(`[VITALIS IMAGE] ${modelName} empty (finishReason=${reason})`);
    } catch { /* best effort */ }
    throw new Error(`${modelName} returned empty response`);
  }
  devLog(`[VITALIS IMAGE] ${modelName} raw:`, String(text).slice(0, 200));
  return text;
}

// Chain-wide budget: stop trying further models once this much has elapsed so
// a full 4-model failover still finishes inside the client's abort window.
const VISION_CHAIN_BUDGET_MS = 120000;

// MAIN EXPORT
async function analyzeFoodImage(base64Data, mimeType = "image/jpeg") {
  // Normalize: callers may send a full data-URI or raw base64. Strip prefix
  // so vision payloads and cache keys are stable either way.
  const cleanBase64 = String(base64Data || "").includes(",")
    ? String(base64Data).split(",").pop()
    : String(base64Data || "");
  const models = getVisionModels();
  const chainDeadline = Date.now() + VISION_CHAIN_BUDGET_MS;
  let seenRetryable = false;
  let seenOther = false;

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    if (Date.now() > chainDeadline) {
      devWarn("[VITALIS IMAGE] Chain time budget exhausted — skipping remaining providers");
      break;
    }
    try {
      const raw = await analyzeWithGeminiVision(
        cleanBase64,
        mimeType,
        modelName,
      );
      const result = normalizeItems(raw);

      if (!result || !result.items || result.items.length === 0) {
        devWarn("[VITALIS IMAGE] Parse failed or absurd result rejected — trying next provider");
        seenOther = true;
        continue;
      }

      devLog(
        "[VITALIS IMAGE] ✅ Final result:",
        JSON.stringify(result).slice(0, 300),
      );
      return JSON.stringify(result);
    } catch (err) {
      if (isRetryableError(err)) {
        devWarn(`[VITALIS IMAGE] ↻ ${modelName} busy — trying next provider…`);
        seenRetryable = true;
      } else {
        devError("[VITALIS IMAGE] ❌ Provider failed:", err.message);
        seenOther = true;
      }
      await backoffSleep(i, err);
    }
  }

  devError("[VITALIS IMAGE] All vision providers failed — returning fallback");
  // Overload-only failure (all 503/429): tell the client to retry instead of
  // the generic "clearer photo" hint. Shape unchanged (items + suggestion)
  // plus a retryable flag, so existing UI keeps working.
  if (seenRetryable && !seenOther) {
    const fb = emptyItemsFallback("AI is busy right now (high demand). Please wait a moment and try again.");
    fb.retryable = true;
    return JSON.stringify(fb);
  }
  return JSON.stringify(emptyItemsFallback());
}

// SECTION 3 — PLAN SUGGESTION

function buildSuggestPlanPrompt(meal, plans, dailyContext) {
  const plansForPrompt = plans.map((p) => ({
    id: p.id,
    title: p.title,
    tag: p.tag,
    intensity: p.intensity,
    target_focus: p.target_focus,
    duration: p.duration,
    description: p.description,
    is_enrolled: p.is_enrolled === 1,
  }));

  return `
You are a fitness AI coach inside a nutrition and training app.

The user just logged this meal:
- Food: ${meal.food_name}
- Calories: ${meal.calories} kcal
- Protein: ${meal.protein}g, Carbs: ${meal.carbs}g, Fat: ${meal.fat}g

Daily context:
- Calories logged today (including this meal): ${dailyContext.caloriesSoFar} kcal
- Daily calorie goal: ${dailyContext.calorieGoal} kcal

Available training plans:
${JSON.stringify(plansForPrompt)}

Instructions:
1. Judge whether this meal is light, balanced, or heavy relative to the day.
2. If plans exist, pick the single best plan id. Prefer enrolled plans; only recommend
   a non-enrolled plan if no enrolled plan fits. If plans array is empty, set recommended_plan_id to null.
3. Estimate how many minutes of that plan would help balance this meal. Null if no plan.
4. Write a friendly 1-2 sentence message. Reassuring if balanced/light; practical and motivating if heavy. Never shame the user.
5. One short sentence of reasoning: why this plan fits nutritionally.

Respond with ONLY raw JSON, no markdown:
{
  "message": "string",
  "reasoning": "string",
  "recommended_plan_id": number or null,
  "estimated_minutes": number or null
}
`.trim();
}

async function suggestPlanForMeal(meal, plans, dailyContext) {
  const prompt = buildSuggestPlanPrompt(meal, plans, dailyContext);
  const raw = await callGeminiWithFallback(prompt);
  return raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

// EXPORTS + SAFE JSON HELPER (never throws — returns { parsed, raw })

function safeParseAI(raw, fallback = null) {
  if (raw == null) return { parsed: fallback, raw: "" };
  const str = String(raw);
  const clean = str
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return { parsed: JSON.parse(clean), raw: str };
  } catch (_) {}
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return { parsed: JSON.parse(match[0]), raw: str };
    } catch (_) {}
  }
  return { parsed: fallback, raw: str };
}

module.exports = {
  AI_TEXT_TIMEOUT_MS,
  AI_VISION_TIMEOUT_MS,
  withTimeout,
  get genAI() {
    return getGenAI();
  },
  get groq() {
    return getGroq();
  },
  aiConfigured,
  getTextModels,
  getVisionModels,
  stripDataUriPrefix(base64) {
    const s = String(base64 || "");
    return s.includes(",") ? s.split(",").pop() : s;
  },
  callGeminiWithFallback,
  analyzeFoodImage,
  normalizeItems,
  validateAndCorrectMacros,
  parseNutritionJSON,
  anchorExpected,
  parseServingQuantity,
  isMeatyFood,
  isMainDish,
  isRetryableError,
  backoffSleep,
  suggestPlanForMeal,
  safeParseAI,
};
