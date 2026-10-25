// Sleep logs — thin controller. Logic + DB live in services/sleep.service.js.
const sleepService = require('../services/sleep.service');
const { validUserId } = require('../utils/ids');

function numField(v, { min = 0, max = 100, name }) {
  // Strict: missing (undefined/null/'') means "not provided" → null (no junk zeros).
  if (v === undefined || v === null || v === '') return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { error: `${name} must be a number ${min}–${max}` };
  }
  return { value: n };
}
// --- WRITE SLEEP LOG ---

async function postUserId(req,res,next){
  try{
      const userId = validUserId(req.params.userId);
      if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    
      const body = req.body || {};
      const duration = numField(body.sleep_duration, { min: 0, max: 24, name: 'sleep_duration' });
      const quality  = numField(body.sleep_quality, { min: 0, max: 10, name: 'sleep_quality' });
      const recovery = numField(body.recovery_score, { min: 0, max: 100, name: 'recovery_score' });
      const water    = numField(body.water_intake_ml, { min: 0, max: 10000, name: 'water_intake_ml' });
      for (const f of [duration, quality, recovery, water]) {
        if (f.error) return res.status(400).json({ error: f.error });
      }
      if (duration.value === null && quality.value === null
          && recovery.value === null && water.value === null) {
        return res.status(400).json({ error: 'At least one of sleep_duration, sleep_quality, recovery_score, water_intake_ml is required' });
      }
    
      await sleepService.saveSleepLog(userId, {
        sleepDuration: duration.value,
        sleepQuality: quality.value,
        recoveryScore: recovery.value,
        waterIntakeMl: water.value,
      });
    
      res.json({ success: true });
  }catch(e){ next(e); }
}

async function getUserIdToday(req,res,next){
  try{
        const userId = validUserId(req.params.userId);
        if (!userId) return res.status(400).json({ error: 'Invalid user id' });
    
        res.json(await sleepService.getLatestToday(userId));
  }catch(e){ next(e); }
}

async function getUserId(req,res,next){
  try{
        const userId = validUserId(req.params.userId);
        if (!userId) return res.status(400).json({ error: 'Invalid user id' });
        const range = String(req.query?.range ?? 'D').toUpperCase();
        const metric = String(req.query?.metric ?? 'duration').toLowerCase();
        if (!['D', 'W', 'M'].includes(range)) return res.status(400).json({ error: 'range must be D, W, or M' });
    
        res.json(await sleepService.getSeries(userId, range, metric));
  }catch(e){ next(e); }
}

async function getUserIdAnalysis(req,res,next){
  try{
        const userId = validUserId(req.params.userId);
        if (!userId) return res.status(400).json({ error: 'Invalid user id' });
        const range = String(req.query?.range ?? 'D').toUpperCase();
        const metric = String(req.query?.metric ?? 'sleep_hours').toLowerCase();
        if (!['D', 'W', 'M'].includes(range)) return res.status(400).json({ error: 'range must be D, W, or M' });
    
        try {
            res.json(await sleepService.getAnalysis(userId, range, metric));
        } catch (err) {
            console.error('[Analysis Graph] Error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

async function getUserIdScatter(req,res,next){
  try{
        const userId = validUserId(req.params.userId);
        if (!userId) return res.status(400).json({ error: 'Invalid user id' });
        const timeframe = String(req.query?.timeframe ?? 'weekly').toLowerCase();
    
        if (!['weekly', 'monthly', 'quarterly'].includes(timeframe)) {
          return res.status(400).json({ error: 'timeframe must be weekly, monthly, or quarterly' });
        }
    
        try {
            res.json(await sleepService.getScatter(userId, timeframe));
        } catch (err) {
            console.error('[Scatter] Error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

module.exports = { postUserId, getUserIdToday, getUserId, getUserIdAnalysis, getUserIdScatter };
