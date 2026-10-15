
const db = require('../config/db');
const log = require('../utils/logger');
const { calcReadiness } = require('../utils/readiness');
// GET /api/stats/daily/:userId

async function getdailyUserId(req,res,next){
  try{
      const { userId } = req.params;
    
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
    
      try {
        // Use CURDATE() (DB-local) as source of truth — avoids UTC off-by-one
        // when app TZ != UTC.
        const [stats] = await db.execute(
          'SELECT calories_burned, steps, workout_duration_mins FROM daily_stats WHERE user_id = ? AND stat_date = CURDATE()',
          [userId]
        );
    
        if (stats.length === 0) {
          return res.json({
            calories_burned: 0,
            steps: 0,
            workout_duration_mins: 0,
          });
        }
    
        res.json(stats[0]);
      } catch (err) {
        log.error('daily stats fetch error:', err.message);
        next(err);
      }
  }catch(e){ next(e); }
}

// GET /api/stats/readiness/:userId — null when no data, never misleading 0%
async function getreadinessUserId(req,res,next){
  try{
      const { userId } = req.params;
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      try {
        const [stats] = await db.execute(
          'SELECT calories_burned, steps, workout_duration_mins FROM daily_stats WHERE user_id = ? AND stat_date = CURDATE()',
          [userId]
        );
        const [sleep] = await db.execute(
          'SELECT COUNT(*) AS cnt FROM sleep_logs WHERE user_id = ? AND recorded_at >= CURDATE() AND recorded_at < CURDATE() + INTERVAL 1 DAY',
          [userId]
        );
        let checkins = [];
        try {
          [checkins] = await db.execute(
            'SELECT sleep_hours, sleep_quality, stress_level, soreness_level, soreness_level AS soreness, energy_level FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE() LIMIT 1',
            [userId]
          );
        } catch (tableErr) {
          if (tableErr.code !== 'ER_NO_SUCH_TABLE' && tableErr.code !== 'ER_BAD_FIELD_ERROR') throw tableErr;
          log.warn('[readiness] daily_checkins schema mismatch — run db:migrate (014/016)');
        }
        const s = stats[0] || { calories_burned: 0, steps: 0, workout_duration_mins: 0 };
        const result = calcReadiness({
          checkin: checkins[0] || null,
          sleepCount: sleep[0]?.cnt || 0,
          steps: s.steps || 0,
          calories: s.calories_burned || 0,
        });
        res.json({ ...result, stats: s, checkin: checkins[0] || null });
      } catch (err) {
        log.error('readiness fetch error:', err.message);
        next(err);
      }
  }catch(e){ next(e); }
}

module.exports = { getdailyUserId, getreadinessUserId };
