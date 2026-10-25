// Progress — Module 6 business logic + DB access.
// HTTP concerns (status codes, streaming CSV) stay in progress.controller.js.
//
// Three halves:
//   1. Activity analytics — aggregated from REAL workout_logs rows (duration
//      minus paused time, Module 5 columns). Feeds the Progress page chart AND
//      the trainingInsights algorithm (see collectStats wiring there).
//   2. Progress photos — front/side/back captures stored privately, analyzed
//      by Gemini vision (per-photo review + older-vs-newer comparison).
//      Everything AI produces is labeled an estimate — never a diagnosis and
//      never a body-fat measurement.
//   3. Body measurements — weight/BF%/tapes, one row per user per date
//      (upsert). Weight mirrors into bmi_records so existing BMI surfaces and
//      AI weight-trend context keep working.
const db = require("../config/db");
const { AppError } = require("../utils/errors");
const gemini = require("../config/gemini");
const { computeBmi } = require("./bmi.service");
// Single BMI category source — matches planEngine (Onboarding) and the master plan.
const { bmiCategory: getBmiCategory } = require("../utils/planEngine");
const overview = require("../utils/progressOverview");

const POSES = ["front", "side", "back"];
// ~4.5MB of base64 ≈ 3.3MB binary — client compresses far below this.
const MAX_IMAGE_B64 = 6_000_000;

// ─── 1. ACTIVITY ANALYTICS ─────────────────────────────────────────────
// Active minutes = stored duration_seconds minus accumulated pause time
// (Module 5). Sessions without duration fall back to start/end wall clock.
function activeMinutesExpr() {
  return `
    GREATEST(0, ROUND(
      ( COALESCE(t.duration_seconds, TIMESTAMPDIFF(SECOND, t.start_time, t.end_time))
        - COALESCE(t.paused_seconds, 0)
      ) / 60
    ))`;
}

// Week view: rolling 7-day buckets (label = Monday's date of that bucket),
// oldest first, 8 buckets. Month view: day rows for the running month.
async function getActivity(userId) {
  const [weeks] = await db.query(
    `SELECT
       DATE_FORMAT(DATE_SUB(t.start_time, INTERVAL WEEKDAY(t.start_time) DAY), '%Y-%m-%d') AS weekStart,
       COUNT(*) AS sessions,
       SUM(${activeMinutesExpr()}) AS minutes,
       SUM(COALESCE(t.rep_count, 0)) AS reps,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed
     FROM workout_logs t
     WHERE t.user_id = ?
       AND t.start_time >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
     GROUP BY weekStart
     ORDER BY weekStart ASC`,
    [userId],
  );

  const [days] = await db.query(
    `SELECT
       DATE_FORMAT(t.start_time, '%Y-%m-%d') AS day,
       COUNT(*) AS sessions,
       SUM(${activeMinutesExpr()}) AS minutes,
       SUM(COALESCE(t.rep_count, 0)) AS reps,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed
     FROM workout_logs t
     WHERE t.user_id = ?
       AND t.start_time >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
     GROUP BY day
     ORDER BY day ASC`,
    [userId],
  );

  // Full 8-week window on the client (chart shows gaps as zero).
  const weekRows = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - i * 7);
    const key = monday.getFullYear() + "-" + String(monday.getMonth() + 1).padStart(2, "0") + "-" + String(monday.getDate()).padStart(2, "0");
    const hit = weeks.find((w) => w.weekStart === key);
    weekRows.push({
      week_start: key,
      label: i === 0 ? "This week" : key,
      sessions: Number(hit?.sessions || 0),
      minutes: Number(hit?.minutes || 0),
      reps: Number(hit?.reps || 0),
      completed: Number(hit?.completed || 0),
    });
  }

  const dayRows = [];
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (let d = 1; d <= daysInMonth; d++) {
    const key = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const hit = byDay.get(key);
    const row = hit || {};
    dayRows.push({
      day: key,
      sessions: Number(row.sessions || 0),
      minutes: Number(row.minutes || 0),
      reps: Number(row.reps || 0),
      completed: Number(row.completed || 0),
    });
  }

  return { weeks: weekRows, month: dayRows };
}

// Cross-metric series for the Logs "Progress Overview" chart. Every point is
// derived from the user's real rows; nutrition is averaged per LOGGED day so a
// skipped day never looks like a 0 kcal fast, and body metrics keep the last
// measurement per bucket. Range: 30d | 90d | 1y | all.
async function getOverview(userId, rawRange) {
  const range = overview.normalizeRange(rawRange);
  const today = overview.todayISO();
  const nominalStart = overview.rangeStartISO(range, today);
  const since = nominalStart ? `${nominalStart} 00:00:00` : null;

  const workoutSql = `
    SELECT DATE_FORMAT(t.start_time, '%Y-%m-%d') AS day,
           COUNT(*) AS sessions,
           COALESCE(SUM(${activeMinutesExpr()}), 0) AS minutes
    FROM workout_logs t
    WHERE t.user_id = ?
      AND COALESCE(t.status, 'completed') <> 'cancelled'
      ${since ? "AND t.start_time >= ?" : ""}
    GROUP BY day
    ORDER BY day ASC`;
  const mealSql = `
    SELECT DATE_FORMAT(logged_at, '%Y-%m-%d') AS day,
           COALESCE(SUM(calories), 0) AS kcal,
           COALESCE(SUM(protein), 0) AS protein
    FROM food_logs
    WHERE user_id = ?
      ${since ? "AND logged_at >= ?" : ""}
    GROUP BY day
    ORDER BY day ASC`;
  const weightSql = `
    SELECT DATE_FORMAT(recorded_at, '%Y-%m-%d') AS day, weight_kg AS value
    FROM bmi_records
    WHERE user_id = ? AND weight_kg IS NOT NULL
      ${since ? "AND recorded_at >= ?" : ""}
    ORDER BY recorded_at ASC, id ASC`;
  const waistSql = `
    SELECT DATE_FORMAT(recorded_at, '%Y-%m-%d') AS day, waist_cm AS value
    FROM body_measurements
    WHERE user_id = ? AND waist_cm IS NOT NULL
      ${since ? "AND recorded_at >= ?" : ""}
    ORDER BY recorded_at ASC, id ASC`;

  // Measurements arrived in migration 038. On a not-yet-migrated DB the rest
  // of the chart still works — only the waist series goes quiet.
  const waistPromise = db.query(waistSql, since ? [userId, since] : [userId]).catch((err) => {
    if (err.code === "ER_NO_SUCH_TABLE") {
      console.warn("[progress-overview] body_measurements missing — waist series skipped");
      return [[]];
    }
    throw err;
  });

  const [
    [workoutRows],
    [mealRows],
    [weightRows],
    [waistRows],
  ] = await Promise.all([
    db.query(workoutSql, since ? [userId, since] : [userId]),
    db.query(mealSql, since ? [userId, since] : [userId]),
    db.query(weightSql, since ? [userId, since] : [userId]),
    waistPromise,
  ]);

  const workouts = workoutRows.map((r) => ({
    day: r.day,
    sessions: Number(r.sessions) || 0,
    minutes: Number(r.minutes) || 0,
  }));
  const meals = mealRows.map((r) => ({
    day: r.day,
    kcal: Number(r.kcal) || 0,
    protein: Number(r.protein) || 0,
  }));
  const weights = weightRows.map((r) => ({ day: r.day, value: Number(r.value) }));
  const waists = waistRows.map((r) => ({ day: r.day, value: Number(r.value) }));

  // "All" starts at the first real row so an empty chart never pretends to
  // have years of history; the fallback window keeps the axis sensible.
  let start = nominalStart;
  if (!start) {
    start = [workouts[0]?.day, meals[0]?.day, weights[0]?.day, waists[0]?.day]
      .filter(Boolean)
      .sort()[0] || overview.addDays(today, -29);
  }

  const bucket = overview.chooseBucket(overview.diffDays(start, today) + 1);
  let chartStart = start;
  if (bucket === "week") chartStart = overview.startOfWeekISO(chartStart);
  if (bucket === "month") chartStart = overview.startOfMonthISO(chartStart);

  const buckets = overview.buildBuckets(chartStart, today, bucket);

  return {
    range,
    bucket,
    start,
    chartStart,
    end: today,
    metrics: overview.aggregateOverview({ buckets, workouts, meals, weights, waists }),
  };
}

// ─── 2. PROGRESS PHOTOS ────────────────────────────────────────────────
// Check-in cadence (042_progress_cadence): user picks Weekly (7d) or Monthly
// (30d); the SAME pose cannot be uploaded again until the gap passes. A pose's
// first photo is always allowed — after that, before/after pairs stay fair.
const CADENCES = { weekly: 7, monthly: 30 };

async function getCadenceRow(userId) {
  try {
    const [rows] = await db.execute(
      `SELECT cadence_days FROM progress_settings WHERE user_id = ?`,
      [userId],
    );
    // Default when unset or an unknown stored value.
    return rows[0]?.cadence_days === 7 ? 7 : 30;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return 30; // pre-migration DB still works
    throw err;
  }
}

function cadenceLabel(days) {
  return days === 7 ? "Weekly" : "Monthly";
}

async function setCadence(userId, cadence) {
  const key = String(cadence || "").trim().toLowerCase();
  if (!CADENCES[key]) {
    throw new AppError("cadence must be 'weekly' or 'monthly'", 400, "BAD_CADENCE");
  }
  const days = CADENCES[key];
  try {
    await db.execute(
      `INSERT INTO progress_settings (user_id, cadence_days) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE cadence_days = VALUES(cadence_days)`,
      [userId, days],
    );
  } catch (err) {
    if (err.code !== "ER_NO_SUCH_TABLE") throw err;
    // Pre-migration DB: nothing to persist; report the requested cadence anyway.
  }
  return { cadence: key, days };
}

// Full check-in state for the Log tab: chosen cadence + per-pose cooldowns.
async function getCheckinState(userId) {
  const days = await getCadenceRow(userId);
  const [rows] = await db.execute(
    `SELECT pose, MAX(captured_at) AS last_at FROM progress_photos WHERE user_id = ? GROUP BY pose`,
    [userId],
  );
  const byLastPose = new Map(rows.map((r) => [r.pose, r.last_at]));
  const intervalMs = days * 86400000;
  const now = Date.now();
  const poses = {};
  for (const pose of POSES) {
    const lastAt = byLastPose.get(pose) || null;
    let nextAllowedAt = null;
    let daysLeft = 0;
    let lastMs = lastAt ? new Date(lastAt).getTime() : NaN;
    if (Number.isFinite(lastMs) && now - lastMs >= 0 && now - lastMs < intervalMs) {
      const nextMs = lastMs + intervalMs;
      nextAllowedAt = new Date(nextMs).toISOString();
      daysLeft = Math.max(1, Math.ceil((nextMs - now) / 86400000));
    }
    poses[pose] = { lastAt, nextAllowedAt, daysLeft };
  }
  return { cadence: days === 7 ? "weekly" : "monthly", days, poses };
}

function poseLabel(pose) {
  return pose.charAt(0).toUpperCase() + pose.slice(1);
}

async function savePhoto(userId, { pose, image_data }) {
  if (!POSES.includes(pose)) {
    throw new AppError("pose must be one of: " + POSES.join(", "), 400, "BAD_POSE");
  }
  const b64 = typeof image_data === "string" ? image_data.trim() : "";
  if (!b64) throw new AppError("Photo data is required", 400, "NO_IMAGE");
  if (b64.length > MAX_IMAGE_B64) {
    throw new AppError("Photo too large (max ~4MB)", 413, "IMAGE_TOO_LARGE");
  }

  // Enforced check-in cadence: same-pose uploads wait out the interval so
  // before/after comparisons involve real change, not lighting noise.
  const cadenceDays = await getCadenceRow(userId);
  try {
    const [lastRows] = await db.execute(
      `SELECT captured_at FROM progress_photos WHERE user_id = ? AND pose = ?
       ORDER BY captured_at DESC, id DESC LIMIT 1`,
      [userId, pose],
    );
    const lastMs = lastRows[0] ? new Date(lastRows[0].captured_at).getTime() : NaN;
    const elapsed = Date.now() - lastMs;
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < cadenceDays * 86400000) {
      const nextMs = lastMs + cadenceDays * 86400000;
      const nextAllowedAt = new Date(nextMs).toISOString();
      const daysLeft = Math.max(1, Math.ceil((nextMs - Date.now()) / 86400000));
      throw new AppError(
        `${poseLabel(pose)} check-in done for this ${cadenceLabel(cadenceDays).toLowerCase()} period — next one from ${nextAllowedAt.slice(0, 10)} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).`,
        429,
        "CHECKIN_TOO_SOON",
        { pose, nextAllowedAt, daysLeft },
      );
    }
  } catch (err) {
    if (err.code === "CHECKIN_TOO_SOON") throw err;
    if (err.code !== "ER_NO_SUCH_TABLE") throw err;
    // progress_settings missing — old DB: skip the gate rather than block uploads.
  }

  const [result] = await db.execute(
    `INSERT INTO progress_photos (user_id, pose, image_data) VALUES (?, ?, ?)`,
    [userId, pose, b64],
  );
  return { id: result.insertId, pose };
}

// Metadata only — images are fetched lazily via getPhotoImage (MEDIUMTEXT can
// be a few hundred KB each; never ship a gallery's worth in one JSON).
async function listPhotos(userId) {
  const [rows] = await db.execute(
    `SELECT id, pose, ai_rating, ai_quality, ai_summary, captured_at
     FROM progress_photos WHERE user_id = ? ORDER BY captured_at DESC, id DESC
     LIMIT 300`,
    [userId],
  );
  return rows.map((r) => ({
    ...r,
    ai_rating: r.ai_rating == null ? null : Number(r.ai_rating),
  }));
}

async function getPhotoImage(userId, photoId) {
  const [rows] = await db.execute(
    `SELECT image_data, pose FROM progress_photos WHERE id = ? AND user_id = ?`,
    [photoId, userId],
  );
  return rows[0] || null;
}

async function getPhotoData(userId, photoId) {
  const [rows] = await db.execute(
    `SELECT id, pose, image_data, ai_rating, ai_quality, ai_summary, captured_at
     FROM progress_photos WHERE id = ? AND user_id = ?`,
    [photoId, userId],
  );
  return rows[0] || null;
}

async function deletePhoto(userId, photoId) {
  const [result] = await db.execute(
    `DELETE FROM progress_photos WHERE id = ? AND user_id = ?`,
    [photoId, userId],
  );
  return result.affectedRows > 0;
}

// Strip a data-URL prefix for Gemini's inline (raw base64 + mimeType).
function toMimeAndB64(stored) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(stored.trim());
  if (m) return { mimeType: m[1], base64: m[2] };
  return { mimeType: "image/jpeg", base64: stored.trim() };
}

// One vision-model attempt cycle (mirrors analyzeFoodImage's fallback chain).
async function callVisionModel(parts, prompt) {
  const models = gemini.getVisionModels();
  let lastErr = null;
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      const model = gemini.genAI.getGenerativeModel({ model: modelName });
      const result = await gemini.withTimeout(
        model.generateContent([{ text: prompt }, ...parts]),
        gemini.AI_VISION_TIMEOUT_MS,
        modelName,
      );
      const text = result?.response?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n");
      if (!text) throw new Error(`${modelName} returned empty response`);
      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`[progress-photo] ${modelName} failed:`, err.message);
    }
  }
  throw lastErr || new Error("All vision models failed");
}

const PHOTO_PROMPT = `You are a form-and-progress reviewer for a fitness app's private progress-photo feature.
The photo shows ONE person taking a progress photo from the front, side, or back (the app tells you which).
Only LIGHTING, FRAMING, and VISIBILITY guidance is in your remit. You must NEVER estimate height,
weight, body-fat percentage, or any medical attribute — say plainly if asked. Adults only; refuse
anything that looks like a minor.

Reply with ONLY a JSON object:
{
  "rating": 1-5,               // photo usability for progress tracking (lighting+framing+pose visibility)
  "lighting": "1 short sentence on lighting quality",
  "framing": "1 short sentence on framing/pose (angle, distance, obstructions)",
  "notes": "1-2 short sentences of what is clearly visible (e.g. posture hints, visible muscle definition). Visual estimates only."
}
No markdown, no extra keys.`;

// Goal labels from onboarding (mirror of frontend GOAL_TYPES) — the compare
// should speak to the user's OWN goal, not generic remarks.
const GOAL_LABELS = {
  LOSE_WEIGHT: "Lose Weight / Fat",
  MAINTAIN_WEIGHT: "Maintain Weight",
  GAIN_WEIGHT: "Gain Weight",
  BUILD_MUSCLE: "Build Muscle",
  PERFORMANCE: "Improve Performance",
};

// Active onboarding goal as a compact context line for the AI compare.
async function getGoalContext(userId) {
  try {
    const [rows] = await db.execute(
      `SELECT goal_type, target_weight_kg, pace, focus, activity_level, height_cm, weight_kg
       FROM fitness_goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
      [userId],
    );
    const g = rows[0];
    if (!g) return null;
    const parts = [
      GOAL_LABELS[g.goal_type] || g.goal_type,
      g.target_weight_kg ? `target weight ~${Number(g.target_weight_kg)} kg` : null,
      g.pace ? `pace: ${g.pace}` : null,
      g.focus ? `focus: ${g.focus}` : null,
      g.activity_level ? `activity level: ${g.activity_level}` : null,
      g.height_cm ? `height ~${Number(g.height_cm)} cm` : null,
      g.weight_kg ? `starting weight ~${Number(g.weight_kg)} kg` : null,
    ].filter(Boolean);
    return parts.join("; ");
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR") return null;
    throw err;
  }
}

const COMPARE_PROMPT = `You are a progress reviewer for a fitness app's PRIVATE progress-photo feature.
You receive two progress photos of the SAME person from the SAME pose angle, older first, plus their
measurement deltas and their onboarding goal. Only DESCRIBE VISIBLE CHANGES conservatively (posture,
visible muscle definition, visible fullness). You must NEVER estimate weight, body-fat percentage, or
make medical claims. Photo quality (lighting) differences are not body changes — say so instead.
Frame the review relative to the user's stated goal: note which visible changes are the DIRECTION the
goal suggests (speculative wording only — "appears to be moving toward ..."), never a verdict on success.

Reply with ONLY a JSON object:
{
  "summary": "3-6 plain sentences: 2-4 comparing the two photos ('appears', 'looks like'), then 1-2 short sentences connecting what is visible to their stated goal.",
  "confidence": "low" | "medium" | "high"   // low unless framing/lighting are similar
}
No markdown, no extra keys.`;

// Per-photo review; persists rating + quality JSON. Throws ServiceUnavailable
// (mapped in the controller) when every model is down — never silently fakes.
async function analyzePhoto(userId, photoId) {
  const photo = await getPhotoData(userId, photoId);
  if (!photo) throw new AppError("Photo not found", 404, "PHOTO_NOT_FOUND");

  const { mimeType, base64 } = toMimeAndB64(photo.image_data || "");
  const raw = await callVisionModel(
    [{ inlineData: { mimeType, data: base64.slice(0, MAX_IMAGE_B64) } }],
    PHOTO_PROMPT + `\nPose angle: ${photo.pose}.`,
  );
  const { parsed } = gemini.safeParseAI(raw, null);
  if (!parsed || typeof parsed.rating === "undefined") {
    throw new AppError("AI could not review this photo — try again", 502, "AI_ANALYZE_FAILED");
  }
  const rating = Math.min(5, Math.max(1, Math.round(Number(parsed.rating) || 0)));
  const quality = {
    lighting: String(parsed.lighting || "").slice(0, 300),
    framing: String(parsed.framing || "").slice(0, 300),
    notes: String(parsed.notes || "").slice(0, 600),
  };
  const summary = [
    "Visual estimate — not a measurement.",
    quality.lighting, quality.framing, quality.notes,
  ].filter(Boolean).join(" ");

  await db.execute(
    `UPDATE progress_photos SET ai_rating = ?, ai_quality = ?, ai_summary = ? WHERE id = ? AND user_id = ?`,
    [rating, JSON.stringify(quality), summary, photoId, userId],
  );

  return { id: Number(photoId), pose: photo.pose, ai_rating: rating, ai_quality: quality, ai_summary: summary };
}

// Latest vs previous photo of the SAME pose + measurement deltas for context.
async function compareLatest(userId, pose) {
  if (!POSES.includes(pose)) {
    throw new AppError("pose must be one of: " + POSES.join(", "), 400, "BAD_POSE");
  }
  const [rows] = await db.execute(
    `SELECT id, pose, image_data, captured_at FROM progress_photos
     WHERE user_id = ? AND pose = ? ORDER BY captured_at DESC, id DESC LIMIT 2`,
    [userId, pose],
  );
  if (rows.length < 2) {
    throw new AppError("Need at least two photos of this pose to compare", 400, "NOT_ENOUGH_PHOTOS");
  }
  const [newer, older] = rows; // DESC order

  // Measurement context (fraud-free deltas straight from the log).
  const [measRows] = await db.execute(
    `SELECT weight_kg, waist_cm, chest_cm, hips_cm, arm_cm FROM body_measurements
     WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 30`,
    [userId],
  );
  const first = measRows[measRows.length - 1] || {};
  const last = measRows[0] || {};
  const delta = (k) => {
    const a = Number(first[k]); const b = Number(last[k]);
    if (!a || !b) return null;
    return Number((b - a).toFixed(1));
  };
  const ctx = [
    `Time between photos: ${Math.round((new Date(newer.captured_at) - new Date(older.captured_at)) / 86400000)} days.`,
    delta("weight_kg") != null ? `Logged weight change: ${delta("weight_kg") > 0 ? "+" : ""}${delta("weight_kg")} kg (user-entered).` : null,
    delta("waist_cm") != null ? `Logged waist change: ${delta("waist_cm") > 0 ? "+" : ""}${delta("waist_cm")} cm (user-entered).` : null,
    delta("chest_cm") != null ? `Logged chest change: ${delta("chest_cm") > 0 ? "+" : ""}${delta("chest_cm")} cm (user-entered).` : null,
    `User goal (from onboarding): ${(await getGoalContext(userId)) || "not set — keep the review generic"}.`,
  ].filter(Boolean).join(" ");

  const img = (p) => {
    const { mimeType, base64 } = toMimeAndB64(p.image_data || "");
    return { inlineData: { mimeType, data: base64.slice(0, MAX_IMAGE_B64) } };
  };
  const raw = await callVisionModel(
    [
      { text: `OLDER ${pose} photo (${older.captured_at})` }, img(older),
      { text: `NEWER ${pose} photo (${newer.captured_at})` }, img(newer),
    ],
    COMPARE_PROMPT + `\nContext: ${ctx}`,
  );
  const { parsed } = gemini.safeParseAI(raw, null);
  if (!parsed || !parsed.summary) {
    throw new AppError("AI could not compare the photos — try again", 502, "AI_COMPARE_FAILED");
  }
  return {
    pose,
    older_photo_id: older.id,
    newer_photo_id: newer.id,
    confidence: String(parsed.confidence || "low"),
    summary: "Visual estimate — not a measurement. " + String(parsed.summary).slice(0, 1200),
  };
}

// ─── 3. BODY MEASUREMENTS ──────────────────────────────────────────────
const MEASUREMENT_FIELDS = [
  ["weight_kg", 20, 500],
  ["body_fat_pct", 1, 70],
  ["chest_cm", 40, 200],
  ["waist_cm", 30, 250],
  ["hips_cm", 40, 250],
  ["arm_cm", 15, 70],
  ["thigh_cm", 25, 120],
];

function validateMeasurements(body) {
  const out = {};
  let provided = 0;
  for (const [key, min, max] of MEASUREMENT_FIELDS) {
    const v = body?.[key];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new AppError(`${key} must be a number ${min}–${max}`, 400, "BAD_MEASUREMENT");
    }
    out[key] = n;
    provided += 1;
  }
  return { fields: out, provided };
}

// Upsert-by-date (UNIQUE user_id+recorded_at). A weight entry mirrors into
// bmi_records so the Body tab BMI history + AI weight-trend context stay live.
async function saveMeasurements(userId, body) {
  const { fields, provided } = validateMeasurements(body);
  if (provided === 0) {
    throw new AppError("Provide at least one measurement", 400, "NO_FIELDS");
  }
  const date = typeof body.recorded_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.recorded_at)
    ? body.recorded_at
    : new Date().toISOString().slice(0, 10);
  if (date > new Date().toISOString().slice(0, 10)) {
    throw new AppError("recorded_at cannot be in the future", 400, "FUTURE_DATE");
  }
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 300) || null : null;

  await db.execute(
    `INSERT INTO body_measurements
       (user_id, recorded_at, weight_kg, body_fat_pct, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       weight_kg = COALESCE(VALUES(weight_kg), weight_kg),
       body_fat_pct = COALESCE(VALUES(body_fat_pct), body_fat_pct),
       chest_cm = COALESCE(VALUES(chest_cm), chest_cm),
       waist_cm = COALESCE(VALUES(waist_cm), waist_cm),
       hips_cm = COALESCE(VALUES(hips_cm), hips_cm),
       arm_cm = COALESCE(VALUES(arm_cm), arm_cm),
       thigh_cm = COALESCE(VALUES(thigh_cm), thigh_cm),
       notes = COALESCE(VALUES(notes), notes)`,
    [userId, date,
      fields.weight_kg ?? null, fields.body_fat_pct ?? null, fields.chest_cm ?? null,
      fields.waist_cm ?? null, fields.hips_cm ?? null, fields.arm_cm ?? null,
      fields.thigh_cm ?? null, notes],
  );

  // Weight mirror into bmi_records (only when BOTH weight and a known height).
  if (fields.weight_kg != null) {
    const [[heightRow]] = await db.execute(
      `SELECT height_cm FROM bmi_records WHERE user_id = ? AND height_cm IS NOT NULL
       ORDER BY recorded_at DESC LIMIT 1`,
      [userId],
    );
    if (heightRow?.height_cm) {
      const bmi = computeBmi(fields.weight_kg, Number(heightRow.height_cm));
      await db.execute(
        `INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, bmi_category, recorded_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, fields.weight_kg, Number(heightRow.height_cm), bmi, getBmiCategory(bmi)],
      );
    }
  }

  return { success: true, recorded_at: date };
}

async function listMeasurements(userId, limit = 60) {
  const cap = Math.min(Math.max(Number(limit) || 60, 1), 180);
  const [rows] = await db.execute(
    `SELECT id, DATE_FORMAT(recorded_at, '%Y-%m-%d') AS recorded_at, weight_kg, body_fat_pct,
            chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm, notes
     FROM body_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ${cap}`,
    [userId],
  );
  return rows;
}

async function deleteMeasurement(userId, measurementId) {
  const [result] = await db.execute(
    `DELETE FROM body_measurements WHERE id = ? AND user_id = ?`,
    [measurementId, userId],
  );
  return result.affectedRows > 0;
}

// ─── 4. EXPORT (CSV + AI diary) ────────────────────────────────────────
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvSection(title, headers, rows) {
  const lines = [`# ${title}`, headers.join(",")];
  for (const r of rows) {
    if (Array.isArray(r)) lines.push(r.map(csvEscape).join(","));
    else lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

async function buildExportCsv(userId) {
  const [workouts] = await db.query(
    `SELECT DATE_FORMAT(t.start_time, '%Y-%m-%d %H:%i') AS start_time, t.end_time, t.status,
            t.workout_type, t.rep_count, t.duration_seconds, t.paused_seconds,
            (SELECT COUNT(*) FROM workout_sets s WHERE s.workout_log_id = t.id) AS sets
     FROM workout_logs t WHERE t.user_id = ? ORDER BY t.start_time DESC LIMIT 2000`,
    [userId],
  );
  const measurements = await listMeasurements(userId, 180);
  const photos = (await listPhotos(userId)).map((p) => ({
    pose: p.pose, captured_at: p.captured_at, ai_rating: p.ai_rating,
  }));

  const ts = new Date().toISOString().slice(0, 10);
  const header = `Vitalis progress export — user #${userId} — ${ts}\nGenerated by Vitalis. Private data.\n`;
  return [
    header,
    csvSection("WORKOUTS", ["start_time", "end_time", "status", "workout_type", "rep_count", "duration_seconds", "paused_seconds", "sets"], workouts),
    "",
    csvSection("MEASUREMENTS", ["recorded_at", "weight_kg", "body_fat_pct", "chest_cm", "waist_cm", "hips_cm", "arm_cm", "thigh_cm", "notes"], measurements),
    "",
    csvSection("PHOTOS", ["pose", "captured_at", "ai_rating"], photos),
  ].join("\n") + "\n";
}

// AI progress diary — plain-text letter from real logged data. Falls back to a
// static (still useful) summary when every model is busy.
async function buildDiary(userId) {
  const activity = await getActivity(userId);
  const meas = await listMeasurements(userId, 30);
  const [meals] = await db.query(
    `SELECT COUNT(*) AS meals, COALESCE(SUM(calories),0) AS kcal, DATE(logged_at) AS day
     FROM food_logs WHERE user_id = ? AND logged_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY day ORDER BY day DESC LIMIT 30`,
    [userId],
  );

  // Goal + photo context so the diary judgment reflects the user's plan too.
  const [goalCtx, photoFacts] = await Promise.all([
    getGoalContext(userId).catch(() => null),
    (async () => {
      try {
        const [[p]] = await db.execute(
          `SELECT COUNT(*) AS total, SUM(ai_rating IS NOT NULL) AS rated FROM progress_photos WHERE user_id = ?`,
          [userId],
        );
        return Number(p?.total || 0)
          ? `Progress photos: ${Number(p.total)} captured (${cadenceLabel(await getCadenceRow(userId)).toLowerCase()} check-ins).`
          : null;
      } catch (_) { return null; }
    })(),
  ]);

  const totalSessions = activity.weeks.reduce((s, w) => s + w.sessions, 0);
  const totalMins = activity.weeks.reduce((s, w) => s + w.minutes, 0);
  const thisWeek = activity.weeks[activity.weeks.length - 1];
  const prevWeek = activity.weeks[activity.weeks.length - 2] || {};
  const w0 = meas[meas.length - 1]; const wN = meas[0];
  const weightDelta = w0?.weight_kg != null && wN?.weight_kg != null && wN !== w0
    ? (Number(wN.weight_kg) - Number(w0.weight_kg)) : null;

  const facts = [
    goalCtx ? `Stated goal (from onboarding): ${goalCtx}.` : null,
    `Workouts logged (last 8 weeks): ${totalSessions} sessions, ~${Math.round(totalMins)} active minutes.`,
    `This week: ${thisWeek?.sessions ?? 0} sessions / ${thisWeek?.minutes ?? 0} min. Last week: ${prevWeek?.sessions ?? 0} sessions / ${prevWeek?.minutes ?? 0} min.`,
    `Meals logged in the last 30 days: ${meals.length} days, total ${meals.reduce((s, m) => s + Number(m.kcal || 0), 0)} kcal.`,
    weightDelta != null ? `Weight change across ${meas.length} entries: ${weightDelta > 0 ? "+" : ""}${weightDelta} kg (${w0.recorded_at} → ${wN.recorded_at}).` : `No weight measurements logged yet.`,
    meas.length ? `Latest measurements: ${wN.waist_cm ? `waist ${wN.waist_cm}cm; ` : ""}${wN.body_fat_pct ? `body fat ${wN.body_fat_pct}%; ` : ""}${wN.chest_cm ? `chest ${wN.chest_cm}cm.` : ""}` : null,
    photoFacts,
  ].filter(Boolean).join("\n");

  const prompt = `You are Vitalis AI writing a short "progress diary" letter for a fitness app user.
Rules: general fitness information only, never medical advice; no diagnosis; end with exactly:
"General fitness info — not medical advice."
Base every claim on the REAL data below; do not invent workouts or numbers. If data is thin, focus on
building the habit. Encouraging, direct, second person. 150-220 words. Here is the data:

${facts}`;

  const raw = await gemini.callGeminiWithFallback(prompt);
  const degraded = typeof raw !== "string" || /high demand|currently experiencing|try again later/i.test(raw);
  if (degraded) {
    return [
      "Your Vitalis Progress Diary (offline summary)",
      "",
      facts,
      "",
      "AI letter-writing is busy right now — these are your real logged numbers.",
      "General fitness info — not medical advice.",
    ].join("\n");
  }
  return `[AI letter — based on your real logged data]\n${String(raw).trim()}\n\n--- DATA BEHIND THIS LETTER ---\n${facts}`;
}

module.exports = {
  POSES,
  MEASUREMENT_FIELDS,
  getActivity,
  getOverview,
  savePhoto,
  listPhotos,
  getPhotoImage,
  analyzePhoto,
  compareLatest,
  getCheckinState,
  setCadence,
  deletePhoto,
  saveMeasurements,
  listMeasurements,
  deleteMeasurement,
  buildExportCsv,
  buildDiary,
};
