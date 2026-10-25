// Activity logs — thin controller. Logic + DB live in services/logs.service.js.
const service = require('../services/logs.service');

async function postUserId(req,res,next){
  try{
        const { userId } = req.params;
        const { calories, steps, minutes, water } = req.body;
        const c = Math.max(0, parseInt(calories) || 0);
        const s = Math.max(0, parseInt(steps) || 0);
        const m = Math.max(0, parseInt(minutes) || 0);
        const w = Math.max(0, parseInt(water) || 0);
        if (c > 20000 || s > 200000 || m > 1440 || w > 15000) {
          return res.status(400).json({ error: 'Log values out of range (cal 1–20000, steps 0–200k, mins 0–1440, water 0–15000)' });
        }
        // Reject junk 0,0,0 rows — at least one metric must be > 0
        if (c <= 0 && s <= 0 && m <= 0 && w <= 0) {
          return res.status(400).json({ error: 'At least one value (calories, steps, minutes, water) must be greater than 0' });
        }
    
        if (process.env.NODE_ENV !== 'production') console.log(`[LOGS] Received — userId:${userId} calories:${c} steps:${s} minutes:${m}`);
    
        try {
            const result = await service.logDailyStats(userId, { calories: c, steps: s, minutes: m, water: w });
            if (process.env.NODE_ENV !== 'production') console.log(`[LOGS] OK — affectedRows:${result.affectedRows}`);
            res.status(200).json({ message: "Activity logged successfully" });
        } catch (err) {
            console.error("[LOGS] DB Error:", err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

async function gethistoryUserId(req,res,next){
  try{
        const { userId } = req.params;
        try {
            const rows = await service.getWorkoutHistory(userId);
            res.json(rows);
        } catch (err) {
            console.error("History fetch error:", err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

module.exports = { postUserId, gethistoryUserId };
