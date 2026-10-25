const service = require('../services/checkins.service');

const { VALID_LEVELS, normalizeLevel } = service;

// POST /api/checkins/:userId — create or update today's check-in
async function postUserId(req,res,next){
  try{
      const { userId } = req.params;
      const { sleepHours, sleep_hours, sleepQuality, sleep_quality,
              stressLevel, stress_level, soreness, soreness_level, sorenessLevel,
              energyLevel, energy_level } = req.body || {};

      const hours = sleepHours ?? sleep_hours;
      if (hours == null || Number(hours) < 0 || Number(hours) > 24) {
        return res.status(400).json({ error: 'sleepHours (0–24) is required' });
      }
      const qNorm = normalizeLevel(sleepQuality ?? sleep_quality);
      const stNorm = normalizeLevel(stressLevel ?? stress_level);
      const soNorm = normalizeLevel(soreness ?? soreness_level ?? sorenessLevel);
      const eNorm = normalizeLevel(energyLevel ?? energy_level);
      for (const [label, val] of [['sleep_quality', qNorm], ['stress_level', stNorm], ['soreness_level', soNorm], ['energy_level', eNorm]]) {
        if (val !== null && !VALID_LEVELS.includes(val)) {
          return res.status(400).json({ error: `${label} must be one of: ${VALID_LEVELS.join(', ')}` });
        }
      }

      const row = await service.upsertTodayCheckin(userId, {
        hours: Number(hours),
        sleepQuality: qNorm,
        stressLevel: stNorm,
        sorenessLevel: soNorm,
        energyLevel: eNorm,
      });
      res.status(201).json({ success: true, checkin: row });
  }catch(e){ next(e); }
}

// GET /api/checkins/:userId/today — today's check-in or null
async function gettodayUserId(req,res,next){
  try{
      const { userId } = req.params;
      const row = await service.getTodayCheckin(userId);
      res.json({ checkin: row || null });
  }catch(e){ next(e); }
}

// GET /api/checkins/:userId/history?days=14 — recent check-ins for trends
async function gethistoryUserId(req,res,next){
  try{
      const { userId } = req.params;
      const days = Math.min(Math.max(parseInt(req.query.days) || 14, 1), 60);
      const rows = await service.getCheckinHistory(userId, days);
      res.json({ history: rows || [] });
  }catch(e){ next(e); }
}

module.exports = { postUserId, gettodayUserId, gethistoryUserId, VALID_LEVELS };
