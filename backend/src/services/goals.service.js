const db = require("../config/db");
const { generatePlan } = require("../utils/planEngine");
const { AppError } = require("../utils/errors");

const GOAL_TYPES = ['LOSE_WEIGHT', 'MAINTAIN_WEIGHT', 'GAIN_WEIGHT', 'BUILD_MUSCLE', 'PERFORMANCE'];
const SEXES = ['male', 'female', 'other'];
const PACES = ['GRADUAL', 'MODERATE', 'FASTER', 'SLOW', 'AGGRESSIVE'];
const ACTIVITY_LEVELS = [
  'SEDENTARY',
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
  'HIGHLY_ACTIVE',
];
const LEVELS = ['LOW', 'MODERATE', 'HIGH', 'GOOD'];

function enumField(v, list) {
  if (v === undefined || v === null || v === '') return { value: null };
  const norm = String(v).trim().toUpperCase();
  if (!list.includes(norm)) return { error: `must be one of: ${list.join(', ')}` };
  return { value: norm };
}

function numOrNull(v, { min, max, name, integer = false }) {
  if (v === undefined || v === null || v === '') return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    return { error: `${name} must be a number ${min}–${max}` };
  }
  return { value: n };
}

function validDob(v) {
  if (v === undefined || v === null || v === '') return { value: null };
  const d = new Date(v);
  if (Number.isNaN(d.getTime()) || d > new Date())
    return { error: 'dob must be a valid past date' };
  return { value: d.toISOString().slice(0, 10) };
}

function toRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    goalType: row.goal_type,
    targetWeightKg: row.target_weight_kg != null ? Number(row.target_weight_kg) : null,
    pace: row.pace,
    focus: row.focus,
    activityLevel: row.activity_level,
    heightCm: row.height_cm != null ? Number(row.height_cm) : null,
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
    bmi: row.bmi != null ? Number(row.bmi) : null,
    dob: row.dob,
    sex: row.sex,
    sleepHours: row.sleep_hours != null ? Number(row.sleep_hours) : null,
    sleepQuality: row.sleep_quality,
    stressLevel: row.stress_level,
    exerciseFreq: row.exercise_freq,
    recoveryLevel: row.recovery_level,
    dailyKcal: row.daily_kcal != null ? Number(row.daily_kcal) : null,
    proteinG: row.protein_g != null ? Number(row.protein_g) : null,
    carbsG: row.carbs_g != null ? Number(row.carbs_g) : null,
    fatG: row.fat_g != null ? Number(row.fat_g) : null,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Carry forward body profile unless the caller overrides it (never mutate req.body)
function carriedBody(prev, overrides) {
  return {
    dob: prev.dob,
    sex: prev.sex,
    heightCm: prev.height_cm,
    weightKg: prev.weight_kg,
    goalType: prev.goal_type,
    targetWeightKg: prev.target_weight_kg,
    pace: prev.pace,
    focus: prev.focus,
    activityLevel: prev.activity_level,
    sleepHours: prev.sleep_hours,
    sleepQuality: prev.sleep_quality,
    stressLevel: prev.stress_level,
    exerciseFreq: prev.exercise_freq,
    recoveryLevel: prev.recovery_level,
    ...(overrides || {}),
  };
}

// POST /api/goals/:userId — create (or replace) the active goal + generate plan
async function createGoal(userId, fields) {
  const plan = generatePlan({
    weightKg: fields.weight,
    heightCm: fields.height,
    dob: fields.dob,
    sex: fields.sex?.toLowerCase(),
    activityLevel: fields.activity,
    goalType: fields.goal,
    pace: fields.pace,
  });

  // Archive + insert + legacy sync must succeed or fail together —
  // otherwise a failed insert leaves the user with zero active goals.
  const conn = await db.getConnection();
  let result;
  try {
    await conn.beginTransaction();
    // Archive previous active goals (history preserved)
    await conn.execute(
      `UPDATE fitness_goals SET status = 'archived' WHERE user_id = ? AND status = 'active'`,
      [userId]
    );

    [result] = await conn.execute(
      `INSERT INTO fitness_goals
         (user_id, dob, sex, height_cm, weight_kg, bmi, goal_type, target_weight_kg,
          pace, focus, activity_level, sleep_hours, sleep_quality, stress_level,
          exercise_freq, recovery_level, daily_kcal, protein_g, carbs_g, fat_g, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        userId,
        fields.dob,
        fields.sex?.toLowerCase() ?? null,
        fields.height,
        fields.weight,
        plan.bmi,
        fields.goal,
        fields.target,
        fields.pace,
        fields.focus,
        fields.activity,
        fields.sleepH,
        fields.sleepQ,
        fields.stress,
        fields.exerciseFreq,
        fields.recovery,
        plan.dailyKcal,
        plan.proteinG,
        plan.carbsG,
        plan.fatG,
      ]
    );

    // Keep legacy surfaces in sync: users.fitness_goal + user_profiles metrics
    await conn.execute('UPDATE users SET fitness_goal = ? WHERE id = ?', [fields.goal, userId]);
    await conn.execute(
      `INSERT INTO user_profiles (user_id, height_cm, weight_kg)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg)`,
      [userId, fields.height, fields.weight]
    );
    await conn.commit();
  } catch (txErr) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw txErr;
  } finally {
    conn.release();
  }

  const [[row]] = await db.execute('SELECT * FROM fitness_goals WHERE id = ?', [result.insertId]);
  if (!row)
    throw new AppError('Goal was saved but could not be read back', 500, 'GOAL_READBACK_FAILED');
  return { plan, goal: toRecord(row) };
}

async function getActiveGoalRow(userId) {
  const [rows] = await db.execute(
    `SELECT * FROM fitness_goals WHERE user_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getLatestBmiWeight(userId) {
  const [rows] = await db.execute(
    `SELECT weight_kg FROM bmi_records WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );
  return rows.length > 0 ? Number(rows[0].weight_kg) : NaN;
}

// Progress: current weight = latest bmi log, else goal start weight
async function computeProgress(userId, goal) {
  let currentWeight = goal.weightKg;
  try {
    const w = await getLatestBmiWeight(userId);
    if (Number.isFinite(w) && w > 0) currentWeight = w;
  } catch (err) {
    console.error('[goals] BMI lookup failed:', err.message);
  }

  let progressPct = null;
  if (
    goal.targetWeightKg != null &&
    goal.weightKg != null &&
    Number.isFinite(currentWeight) &&
    goal.targetWeightKg !== goal.weightKg
  ) {
    const total = Math.abs(goal.targetWeightKg - goal.weightKg);
    const done = Math.abs(currentWeight - goal.weightKg);
    progressPct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 100;
  }

  return { currentWeightKg: currentWeight, progressPct };
}

// PATCH /api/goals/active/:userId — edit identity fields (dob/sex) in place.
// The plan IS recomputed because BMR depends on age/sex.
async function updateActiveGoalIdentity(prev, dobVal, sexVal) {
  const plan = generatePlan({
    weightKg: Number(prev.weight_kg),
    heightCm: Number(prev.height_cm),
    dob: dobVal,
    sex: sexVal,
    activityLevel: prev.activity_level,
    goalType: prev.goal_type,
    pace: prev.pace,
  });

  await db.execute(
    `UPDATE fitness_goals
       SET dob = ?, sex = ?, daily_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?
       WHERE id = ?`,
    [dobVal, sexVal, plan.dailyKcal, plan.proteinG, plan.carbsG, plan.fatG, prev.id]
  );
  const [[row]] = await db.execute('SELECT * FROM fitness_goals WHERE id = ?', [prev.id]);
  return toRecord(row);
}

// ── Adaptive recalibration — targets re-derive from the real body ───────────
// On onboarding, daily_kcal/macros are computed from the submitted weight.
// That body stops existing as soon as the user's real weight moves; targets
// frozen at the starting weight progressively over- or under-feed. This
// recomputes the plan engine on the LATEST weigh-in (bmi_records) whenever
// drift from the calibrated reference is significant.
//
// Threshold: >= 2 kg absolute OR >= 5% relative drift (whichever is smaller —
// an OR of the two keeps very light and very heavy users both covered).
// Baseline `weight_kg` is untouched on purpose: PROGRESS toward the target
// keeps measuring from the goal's starting point; only the nutrition targets
// move. Requires height; falls back gracefully on every missing input.
const RECAL_MIN_DRIFT_KG = 2;
const RECAL_MIN_DRIFT_PCT = 0.05;

async function recalibrateGoal(userId, { force = false } = {}) {
  const prev = await getActiveGoalRow(userId);
  if (!prev) return { recalibrated: false, reason: 'NO_ACTIVE_GOAL' };
  if (prev.height_cm == null || Number(prev.height_cm) <= 0) {
    return { recalibrated: false, reason: 'MISSING_PROFILE' };
  }
  const latest = await getLatestBmiWeight(userId); // NaN when no weigh-in yet
  if (!Number.isFinite(latest) || latest <= 0) {
    return { recalibrated: false, reason: 'NO_WEIGH_IN' };
  }

  // Reference weight = the weight the targets were last computed from.
  // calibrated_weight_kg (migration 041) when set, else the goal start weight.
  let refWeight = prev.weight_kg != null ? Number(prev.weight_kg) : null;
  let hasCalibratedCol = true;
  try {
    const [rows] = await db.execute(
      'SELECT calibrated_weight_kg FROM fitness_goals WHERE id = ? LIMIT 1',
      [prev.id]
    );
    if (rows[0]?.calibrated_weight_kg != null) refWeight = Number(rows[0].calibrated_weight_kg);
  } catch (e) {
    if (e && (e.errno === 1054 || /Unknown column 'calibrated_weight_kg'/.test(e.message || ''))) {
      hasCalibratedCol = false; // pre-041 schema — proceed, just skip the marker write
    } else {
      console.error('[goals] recalibration lookup failed:', e.message);
      return { recalibrated: false, reason: 'ERROR' };
    }
  }

  const driftKg = refWeight != null ? latest - refWeight : 0;
  const driftPct = refWeight > 0 ? Math.abs(driftKg) / refWeight : 0;
  const significant =
    Math.abs(driftKg) >= RECAL_MIN_DRIFT_KG || driftPct >= RECAL_MIN_DRIFT_PCT;
  if (!force && !significant) {
    return { recalibrated: false, reason: 'BELOW_THRESHOLD', driftKg: Math.round(driftKg * 10) / 10 };
  }

  const plan = generatePlan({
    weightKg: latest,
    heightCm: Number(prev.height_cm),
    dob: prev.dob,
    sex: prev.sex,
    activityLevel: prev.activity_level,
    goalType: prev.goal_type,
    pace: prev.pace,
  });

  const setCols = ['daily_kcal = ?', 'protein_g = ?', 'carbs_g = ?', 'fat_g = ?'];
  const params = [plan.dailyKcal, plan.proteinG, plan.carbsG, plan.fatG];
  if (hasCalibratedCol) {
    setCols.push('calibrated_weight_kg = ?', 'calibrated_at = NOW()');
    params.push(latest);
  }
  await db.execute(
    `UPDATE fitness_goals SET ${setCols.join(', ')} WHERE id = ?`,
    [...params, prev.id]
  );

  const [[row]] = await db.execute('SELECT * FROM fitness_goals WHERE id = ?', [prev.id]);
  return {
    recalibrated: true,
    reason: force ? 'MANUAL' : 'DRIFT',
    driftKg: Math.round(driftKg * 10) / 10,
    plan,
    goal: toRecord(row),
  };
}

module.exports = {
  RECAL_MIN_DRIFT_KG,
  RECAL_MIN_DRIFT_PCT,
  recalibrateGoal,
  GOAL_TYPES,
  SEXES,
  PACES,
  ACTIVITY_LEVELS,
  LEVELS,
  enumField,
  numOrNull,
  validDob,
  toRecord,
  carriedBody,
  createGoal,
  getActiveGoalRow,
  getLatestBmiWeight,
  computeProgress,
  updateActiveGoalIdentity,
};
