const service = require('../services/goals.service');
const { validUserId } = require('../utils/ids');

const {
  GOAL_TYPES,
  SEXES,
  PACES,
  ACTIVITY_LEVELS,
  LEVELS,
  enumField,
  numOrNull,
  validDob,
  toRecord,
} = service;

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
    const focusNorm =
      focus === undefined || focus === null || focus === ''
        ? null
        : String(focus).trim().slice(0, 40) || null;
    const exerciseNorm = exerciseFreq ?? exercise_freq ?? null;
    const exerciseFreqNorm =
      exerciseNorm === null || exerciseNorm === ''
        ? null
        : String(exerciseNorm).trim().slice(0, 20);

    const { plan, goal: record } = await service.createGoal(userId, {
      dob: checks.dob.value,
      sex: checks.sex.value,
      height,
      weight,
      goal,
      target: checks.target.value,
      pace: checks.pace.value,
      focus: focusNorm,
      activity: checks.activity.value,
      sleepH: checks.sleepH.value,
      sleepQ: checks.sleepQ.value,
      stress: checks.stress.value,
      exerciseFreq: exerciseFreqNorm,
      recovery: checks.recovery.value,
    });
    res.status(201).json({ success: true, plan, goal: record });
  } catch (e) {
    next(e);
  }
}

// GET /api/goals/active/:userId — active goal + progress vs target
async function getactiveUserId(req, res, next) {
  try {
    const userId = validUserId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const row = await service.getActiveGoalRow(userId);
    if (!row) return res.json({ goal: null });

    const goal = toRecord(row);
    const { currentWeightKg, progressPct } = await service.computeProgress(userId, goal);

    res.json({ goal, currentWeightKg, progressPct });
  } catch (e) {
    next(e);
  }
}

// PATCH /api/goals/:userId/change — switch goal (archives old, generates new plan)
async function patchchangeUserId(req, res, next) {
  try {
    const userId = validUserId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const prev = await service.getActiveGoalRow(userId);
    if (!prev) {
      // No prior goal — treat as first creation
      return postUserId(req, res, next);
    }
    const mergedReq = { ...req, body: service.carriedBody(prev, req.body) };
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
    const prev = await service.getActiveGoalRow(userId);
    if (!prev) {
      return res
        .status(404)
        .json({ error: 'No active goal. Complete onboarding first.', code: 'NO_ACTIVE_GOAL' });
    }

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

    const goal = await service.updateActiveGoalIdentity(prev, dobVal, sexVal);
    res.json({ success: true, goal });
  } catch (e) {
    next(e);
  }
}

// POST /api/goals/active/:userId/recalibrate — re-derive kcal/macros from the
// latest weigh-in (manual button; auto recalibration is threshold-gated, this
// forces the recompute).
async function postActiveRecalibrate(req, res, next) {
  try {
    const userId = validUserId(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    const prev = await service.getActiveGoalRow(userId);
    if (!prev) {
      return res
        .status(404)
        .json({ error: 'No active goal. Complete onboarding first.', code: 'NO_ACTIVE_GOAL' });
    }
    const result = await service.recalibrateGoal(userId, { force: true });
    if (!result.recalibrated) {
      const reasons = {
        NO_WEIGH_IN: 'Log your weight first — calibration needs at least one weigh-in.',
        MISSING_PROFILE: 'Goal is missing height/sex data — re-check onboarding.',
        ERROR: 'Recalibration failed — try again.',
      };
      return res.status(409).json({
        error: reasons[result.reason] || 'Recalibration not possible right now.',
        code: result.reason,
      });
    }
    res.json({
      success: true,
      message: `Targets recalibrated to your latest weigh-in (${result.driftKg > 0 ? '+' : ''}${result.driftKg} kg since last calibration).`,
      driftKg: result.driftKg,
      plan: result.plan,
      goal: result.goal,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { postUserId, getactiveUserId, patchchangeUserId, patchActiveUserId, postActiveRecalibrate };
