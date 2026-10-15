const db = require('../config/db');
const log = require('../utils/logger');
const { generatePlan } = require('../utils/planEngine');
const { validUserId } = require('../utils/ids');
const { AppError } = require('../utils/errors');

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

// POST /api/goals/:userId — create (or replace) the active goal + generate plan
async function postUserId(req, res, next) {
  try {
    const userId = validUserId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const {
      dob,
      sex,
      heightCm,
      height_cm,
      weightKg,
      weight_kg,
      goalType,
      goal_type,
      targetWeightKg,
      target_weight_kg,
      pace,
      focus,
      activityLevel,
      activity_level,
      sleepHours,
      sleep_quality,
      sleepQuality,
      stressLevel,
      stress_level,
      exerciseFreq,
      exercise_freq,
      recoveryLevel,
      recovery_level,
    } = req.body || {};

    const height = Number(heightCm ?? height_cm);
    const weight = Number(weightKg ?? weight_kg);
    if (!Number.isFinite(height) || !Number.isFinite(weight) || height <= 0 || weight <= 0) {
      return res.status(400).json({ error: 'heightCm and weightKg must be positive numbers' });
    }
    if (height < 50 || height > 300)
      return res.status(400).json({ error: 'heightCm out of range (50–300)' });
    if (weight < 10 || weight > 1000)
      return res.status(400).json({ error: 'weightKg out of range (10–1000)' });
    const goalRaw = goalType ?? goal_type;
    const goal = typeof goalRaw === 'string' ? goalRaw.trim().toUpperCase() : null;
    if (!goal || !GOAL_TYPES.includes(goal)) {
      return res.status(400).json({ error: `goalType must be one of: ${GOAL_TYPES.join(', ')}` });
    }

    const checks = {
      sex: enumField(
        sex,
        SEXES.map((s) => s.toUpperCase())
      ),
      pace: enumField(pace, PACES),
      activity: enumField(activityLevel ?? activity_level, ACTIVITY_LEVELS),
      sleepQ: enumField(sleepQuality ?? sleep_quality, LEVELS),
      stress: enumField(stressLevel ?? stress_level, LEVELS),
      recovery: enumField(recoveryLevel ?? recovery_level, LEVELS),
      target: numOrNull(targetWeightKg ?? target_weight_kg, {
        min: 10,
        max: 1000,
        name: 'targetWeightKg',
      }),
      sleepH: numOrNull(sleepHours, { min: 0, max: 24, name: 'sleepHours' }),
      dob: validDob(dob),
    };
    for (const [k, f] of Object.entries(checks)) {
      if (f.error) return res.status(400).json({ error: `${k}: ${f.error}` });
    }
    // Direction guard: a loss goal with target >= current (or gain with
    // target <= current) is a data-entry mistake, e.g. 55 kg → 85 kg for
    // LOSE_WEIGHT. PATCH /change funnels through here too, so both UIs
    // are covered even if client validation is bypassed.
    const targetVal = checks.target.value;
    if (targetVal != null && (goal === 'LOSE_WEIGHT' || goal === 'GAIN_WEIGHT')) {
      if (goal === 'LOSE_WEIGHT' && targetVal >= weight) {
        return res.status(400).json({ error: 'target: target weight must be below current weight for LOSE_WEIGHT' });
      }
      if (goal === 'GAIN_WEIGHT' && targetVal <= weight) {
        return res.status(400).json({ error: 'target: target weight must be above current weight for GAIN_WEIGHT' });
      }
    }
    const focusNorm =
      focus === undefined || focus === null || focus === ''
        ? null
        : String(focus).trim().slice(0, 40) || null;
    const exerciseNorm = exerciseFreq ?? exercise_freq ?? null;
    const exerciseFreqNorm =
      exerciseNorm === null || exerciseNorm === ''
        ? null
        : String(exerciseNorm).trim().slice(0, 20);

    const plan = generatePlan({
      weightKg: weight,
      heightCm: height,
      dob: checks.dob.value,
      sex: checks.sex.value?.toLowerCase(),
      activityLevel: checks.activity.value,
      goalType: goal,
      pace: checks.pace.value,
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
          checks.dob.value,
          checks.sex.value?.toLowerCase() ?? null,
          height,
          weight,
          plan.bmi,
          goal,
          checks.target.value,
          checks.pace.value,
          focusNorm,
          checks.activity.value,
          checks.sleepH.value,
          checks.sleepQ.value,
          checks.stress.value,
          exerciseFreqNorm,
          checks.recovery.value,
          plan.dailyKcal,
          plan.proteinG,
          plan.carbsG,
          plan.fatG,
        ]
      );

      // Keep legacy surfaces in sync: users.fitness_goal + user_profiles metrics
      await conn.execute('UPDATE users SET fitness_goal = ? WHERE id = ?', [goal, userId]);
      await conn.execute(
        `INSERT INTO user_profiles (user_id, height_cm, weight_kg)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg)`,
        [userId, height, weight]
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
    res.status(201).json({ success: true, plan, goal: toRecord(row) });
  } catch (e) {
    next(e);
  }
}

// GET /api/goals/active/:userId — active goal + progress vs target
async function getactiveUserId(req, res, next) {
  try {
    const userId = validUserId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const [rows] = await db.execute(
      `SELECT * FROM fitness_goals WHERE user_id = ? AND status = 'active'
         ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) return res.json({ goal: null });

    const goal = toRecord(rows[0]);

    // Progress: current weight = latest bmi log, else goal start weight
    let currentWeight = goal.weightKg;
    try {
      const [bmiRows] = await db.execute(
        `SELECT weight_kg FROM bmi_records WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`,
        [userId]
      );
      const w = bmiRows.length > 0 ? Number(bmiRows[0].weight_kg) : NaN;
      if (Number.isFinite(w) && w > 0) currentWeight = w;
    } catch (err) {
      log.error('[goals] BMI lookup failed:', err.message);
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

    res.json({ goal, currentWeightKg: currentWeight, progressPct });
  } catch (e) {
    next(e);
  }
}

// PATCH /api/goals/:userId/change — switch goal (archives old, generates new plan)
async function patchchangeUserId(req, res, next) {
  try {
    const userId = validUserId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const [rows] = await db.execute(
      `SELECT * FROM fitness_goals WHERE user_id = ? AND status = 'active'
         ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) {
      // No prior goal — treat as first creation
      return postUserId(req, res, next);
    }
    const prev = rows[0];
    // Carry forward body profile unless the caller overrides it (never mutate req.body)
    const carried = {
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
      ...(req.body || {}),
    };
    const mergedReq = { ...req, body: carried };
    return postUserId(mergedReq, res, next);
  } catch (e) {
    next(e);
  }
}

// PATCH /api/goals/active/:userId — edit identity fields (dob/sex) in place.
// Unlike POST /change (archive + re-insert + full rewrite), this only touches
// the active row. The plan IS recomputed because BMR depends on age/sex.
async function patchActiveUserId(req, res, next) {
  try {
    const userId = validUserId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const { dob, sex } = req.body || {};
    if (dob === undefined && sex === undefined) {
      return res.status(400).json({ error: 'Nothing to update. Provide dob and/or sex.' });
    }
    const [rows] = await db.execute(
      `SELECT * FROM fitness_goals WHERE user_id = ? AND status = 'active'
         ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'No active goal. Complete onboarding first.', code: 'NO_ACTIVE_GOAL' });
    }
    const prev = rows[0];

    const dobCheck = dob === undefined ? { value: prev.dob } : validDob(dob);
    if (dobCheck.error) return res.status(400).json({ error: `dob: ${dobCheck.error}` });
    const sexCheck =
      sex === undefined
        ? { value: prev.sex }
        : enumField(
            sex,
            SEXES.map((s) => s.toUpperCase())
          );
    if (sexCheck.error) return res.status(400).json({ error: `sex: ${sexCheck.error}` });

    const dobVal = dobCheck.value ? new Date(dobCheck.value).toISOString().slice(0, 10) : null;
    const sexVal = sexCheck.value ? String(sexCheck.value).toLowerCase() : null;

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
    res.json({ success: true, goal: toRecord(row) });
  } catch (e) {
    next(e);
  }
}

module.exports = { postUserId, getactiveUserId, patchchangeUserId, patchActiveUserId };
