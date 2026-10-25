const db = require('../config/db');

// Persist today's activity counters. daily_stats accumulates via upsert.
// Water lives in sleep_logs (no water col in daily_stats) — persisted if provided.
async function logDailyStats(userId, { calories, steps, minutes, water }) {
  const [result] = await db.execute(
    `INSERT INTO daily_stats (user_id, stat_date, calories_burned, steps, workout_duration_mins)
     VALUES (?, CURDATE(), ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
         calories_burned       = calories_burned       + VALUES(calories_burned),
         steps                 = steps                 + VALUES(steps),
         workout_duration_mins = workout_duration_mins + VALUES(workout_duration_mins)`,
    [userId, calories, steps, minutes]
  );
  if (water > 0) {
    try {
      await db.execute(
        `INSERT INTO sleep_logs (user_id, water_intake_ml, recorded_at) VALUES (?, ?, NOW())`,
        [userId, water]
      );
    } catch (wErr) {
      console.error('[LOGS] Water insert warning:', wErr.message);
    }
  }
  return result;
}

async function getWorkoutHistory(userId) {
  const [rows] = await db.execute(
    `SELECT id, workout_type, status, rep_count, start_time, end_time,
            duration_seconds, created_at
     FROM workout_logs
     WHERE user_id = ?
     ORDER BY start_time DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
}

module.exports = { logDailyStats, getWorkoutHistory };
