// Stats — business logic + DB access.
// (Daily stats, readiness scoring.)
const db = require('../config/db');
const { calcReadiness } = require('../utils/readiness');

// Today's daily_stats row (DB-local day), or zeroed defaults when none.
async function getDailyStats(userId) {
  // Use CURDATE() (DB-local) as source of truth — avoids UTC off-by-one
  // when app TZ != UTC. `today` kept only for response echo.
  const today = new Date().toISOString().slice(0, 10);
  const [stats] = await db.execute(
    'SELECT calories_burned, steps, workout_duration_mins FROM daily_stats WHERE user_id = ? AND stat_date = CURDATE()',
    [userId]
  );

  if (stats.length === 0) {
    return {
      calories_burned: 0,
      steps: 0,
      workout_duration_mins: 0,
    };
  }

  return stats[0];
}

// null when no data, never misleading 0%
async function getReadiness(userId) {
  const today = new Date().toISOString().slice(0, 10);
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
    console.warn('[readiness] daily_checkins schema mismatch — run db:migrate (014/016)');
  }
  const s = stats[0] || { calories_burned: 0, steps: 0, workout_duration_mins: 0 };
  const result = calcReadiness({
    checkin: checkins[0] || null,
    sleepCount: sleep[0]?.cnt || 0,
    steps: s.steps || 0,
    calories: s.calories_burned || 0,
  });
  return { ...result, stats: s, checkin: checkins[0] || null };
}

module.exports = { getDailyStats, getReadiness };
