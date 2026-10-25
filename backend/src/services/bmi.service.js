// BMI — business logic + DB access.
// (BMI calculation, profile sync, AI suggestion, record listing.)
const db = require('../config/db');
const { callGeminiWithFallback } = require('../config/gemini');
// Single BMI category source — matches planEngine (Onboarding) and the master plan.
const { bmiCategory: getBmiCategory } = require('../utils/planEngine');

// BMI from metric weight (kg) / height (cm). Pure — used by the controller for
// its finite-value guard before the (unreachable) insert path.
function computeBmi(weightKg, heightCm) {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

// Save BMI, keep user_profiles in sync, and return the AI suggestion.
async function saveBmi(userId, { weight, height, bmi, age, gender }) {
  const category = getBmiCategory(bmi);

  const [result] = await db.execute(
    `INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, bmi_category, recorded_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [userId, weight, height, bmi, category]
  );

  // FIX: keep user_profiles.height_cm / weight_kg in sync with the
  // latest BMI log, so the Profile page (which computes BMI live
  // from user_profiles) reflects this calculation immediately.
  // Requires a UNIQUE constraint on user_profiles.user_id.
  await db.execute(`
      INSERT INTO user_profiles (user_id, height_cm, weight_kg)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
          height_cm = VALUES(height_cm),
          weight_kg = VALUES(weight_kg)
  `, [userId, height, weight]);

  // Adaptive recalibration (Module 8): if the active goal's kcal/macros were
  // computed from a materially different body weight (>2 kg / >5% drift from
  // the calibrated reference), re-derive them from this weigh-in. Best-effort
  // and threshold-gated — a stale BMI save or a legacy DB must never block.
  let recalibration = null;
  try {
    const goals = require('./goals.service');
    recalibration = await goals.recalibrateGoal(userId);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[bmi] goal recalibration skipped:', err.message);
    }
  }

  // Generate AI suggestion — general fitness info only, never diagnosis/treatment
  const prompt = `You are Vitalis AI, a fitness assistant providing general fitness information only.
                A user has the following stats:
                - BMI: ${bmi} (${category})
                - Weight: ${weight} kg
                - Height: ${height} cm
                ${age !== null ? `- Age: ${age}` : ''}
                ${gender ? `- Gender: ${gender}` : ''}

                Give a 2-3 sentence personalized, encouraging fitness suggestion based on their body profile.
                Be direct, warm, and actionable. Do not diagnose, treat, or prescribe.
                End with: General fitness info only — not medical advice.`;

  let aiSuggestion = '';
  let aiDegraded = false;
  try {
    aiSuggestion = await callGeminiWithFallback(prompt);
    // callGeminiWithFallback never throws on outage — returns high-demand string
    if (typeof aiSuggestion === 'string' && /high demand|currently experiencing|try again later/i.test(aiSuggestion)) {
      aiDegraded = true;
      aiSuggestion = 'Focus on balanced nutrition and consistent activity to optimize your body composition.';
    }
  } catch (aiErr) {
    console.error('[BMI] AI Error:', aiErr.message);
    aiDegraded = true;
    aiSuggestion = 'Focus on balanced nutrition and consistent activity to optimize your body composition.';
  }

  return { id: result.insertId, bmi, category, aiSuggestion, degraded: aiDegraded, recalibration };
}

async function listRecords(userId, limit, offset) {
  // NOTE: db.query (not execute) — mysql2 server-side prepares reject
  // placeholders in LIMIT/OFFSET on some MySQL versions.
  const [rows] = await db.query(
    `SELECT id, weight_kg, height_cm, bmi, bmi_category,
            DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i') AS recorded_at
     FROM bmi_records
     WHERE user_id = ?
     ORDER BY recorded_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const [[countRow]] = await db.execute(
    `SELECT COUNT(*) AS total FROM bmi_records WHERE user_id = ?`,
    [userId]
  );

  return { records: rows, total: countRow?.total ?? 0 };
}

module.exports = { computeBmi, saveBmi, listRecords };
