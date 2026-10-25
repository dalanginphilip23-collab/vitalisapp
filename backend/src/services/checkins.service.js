const db = require("../config/db");

const VALID_LEVELS = ['LOW', 'MODERATE', 'GOOD', 'HIGH'];

function normalizeLevel(v) {
  return v == null ? null : String(v).trim().toUpperCase();
}

// POST /api/checkins/:userId — create or update today's check-in
async function upsertTodayCheckin(userId, values) {
  await db.execute(
    `INSERT INTO daily_checkins
     (user_id, checkin_date, sleep_hours, sleep_quality, stress_level, soreness_level, energy_level)
     VALUES (?, CURDATE(), ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       sleep_hours = VALUES(sleep_hours),
       sleep_quality = VALUES(sleep_quality),
       stress_level = VALUES(stress_level),
       soreness_level = VALUES(soreness_level),
       energy_level = VALUES(energy_level)`,
    [
      userId, values.hours,
      values.sleepQuality,
      values.stressLevel,
      values.sorenessLevel,
      values.energyLevel,
    ]
  );

  const [[row]] = await db.execute(
    'SELECT * FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE()',
    [userId]
  );
  return row;
}

// GET /api/checkins/:userId/today — today's check-in or null
async function getTodayCheckin(userId) {
  const [rows] = await db.execute(
    'SELECT *, checkin_date AS check_date, soreness_level AS soreness FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE() LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

// GET /api/checkins/:userId/history?days=14 — recent check-ins for trends
async function getCheckinHistory(userId, days) {
  const [rows] = await db.execute(
    `SELECT checkin_date, checkin_date AS check_date, sleep_hours, sleep_quality, stress_level, soreness_level, soreness_level AS soreness, energy_level
     FROM daily_checkins WHERE user_id = ? AND checkin_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY checkin_date ASC`,
    [userId, days]
  );
  return rows || [];
}

module.exports = {
  VALID_LEVELS,
  normalizeLevel,
  upsertTodayCheckin,
  getTodayCheckin,
  getCheckinHistory,
};
