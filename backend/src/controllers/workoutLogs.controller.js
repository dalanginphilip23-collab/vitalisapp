// Workout logs — thin controller. Logic + DB live in services/workoutLogs.service.js.
const workoutService = require('../services/workoutLogs.service');

function parseLogId(req, res) {
  const logId = parseInt(req.params.id, 10);
  if (!Number.isInteger(logId) || logId <= 0) {
    res.status(400).json({ error: 'Invalid workout id' });
    return null;
  }
  return logId;
}

async function poststart(req, res, next) {
  try {
    const workout_type = workoutService.cleanWorkoutType(req.body?.workout_type);
    if (workout_type === null) {
      return res.status(400).json({ error: 'workout_type must be a short text slug' });
    }
    try {
      const result = await workoutService.startWorkout(req.user.id, workout_type);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function patchIdEnd(req, res, next) {
  try {
    const logId = parseLogId(req, res);
    if (logId === null) return undefined;
    const { status = 'completed', rep_count = 0, sets } = req.body || {};
    if (!workoutService.VALID_END_STATUS.includes(status)) {
      return res
        .status(400)
        .json({ error: `status must be one of: ${workoutService.VALID_END_STATUS.join(', ')}` });
    }
    const reps = Number(rep_count);
    if (!Number.isInteger(reps) || reps < 0 || reps > 100000) {
      return res.status(400).json({ error: 'rep_count must be an integer 0–100000' });
    }
    try {
      const result = await workoutService.endWorkout(req.user.id, logId, status, reps, sets);
      if (result.outcome === 'not_found') return res.status(404).json({ error: 'Log not found' });
      if (result.outcome === 'conflict') return res.status(409).json({ error: `Already ${result.status}` });
      res.json(result.log);
    } catch (err) {
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

// POST /:id/pause and /:id/resume — freeze the wall clock on an active session.
async function postPause(req, res, next) {
  try {
    const logId = parseLogId(req, res);
    if (logId === null) return undefined;
    const result = await workoutService.pauseWorkout(req.user.id, logId);
    if (result.outcome === 'not_found') return res.status(404).json({ error: 'Log not found' });
    if (result.outcome === 'conflict') return res.status(409).json({ error: `Already ${result.status}` });
    res.json({ status: 'paused' });
  } catch (e) {
    next(e);
  }
}

async function postResume(req, res, next) {
  try {
    const logId = parseLogId(req, res);
    if (logId === null) return undefined;
    const result = await workoutService.resumeWorkout(req.user.id, logId);
    if (result.outcome === 'not_found') return res.status(404).json({ error: 'Log not found' });
    if (result.outcome === 'conflict') return res.status(409).json({ error: `Already ${result.status}` });
    res.json({ status: 'active' });
  } catch (e) {
    next(e);
  }
}

// PATCH /:id/feedback — post-workout self-report (rating 1–5 + optional note).
async function patchFeedback(req, res, next) {
  try {
    const logId = parseLogId(req, res);
    if (logId === null) return undefined;
    const { difficulty_rating, session_notes } = req.body || {};
    try {
      const result = await workoutService.updateFeedback(req.user.id, logId, {
        difficulty_rating, session_notes,
      });
      if (result.outcome === 'not_found') return res.status(404).json({ error: 'Log not found' });
      res.json(result.log);
    } catch (err) {
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

// GET /:id — session detail with parsed set rows.
async function getId(req, res, next) {
  try {
    const logId = parseLogId(req, res);
    if (logId === null) return undefined;
    const log = await workoutService.getWorkoutDetail(req.user.id, logId);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    res.json({ log });
  } catch (e) {
    next(e);
  }
}

async function get(req, res, next) {
  try {
    try {
      const with_sets = req.query.with_sets === '1' || req.query.with_sets === 'true';
      const logs = await workoutService.listWorkouts(req.user.id, { with_sets });
      res.json({ logs });
    } catch (err) {
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

// POST /manual — backdated completed session from the Log page (no camera).
// Contrasts with /start: full transaction insert, no active row left behind.
async function postManual(req, res, next) {
  try {
    const { workout_type, duration_minutes, rep_count, sets, performed_at } = req.body || {};
    try {
      const log = await workoutService.createManualWorkout(req.user.id, {
        workout_type, duration_minutes, rep_count, sets, performed_at,
      });
      res.status(201).json(log);
    } catch (err) {
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

module.exports = { poststart, patchIdEnd, postPause, postResume, patchFeedback, postManual, getId, get };
