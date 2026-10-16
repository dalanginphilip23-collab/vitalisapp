
const db = require('../config/db');
const log = require('../utils/logger');
const { calcReadiness } = require('../utils/readiness');
const { validId } = require('../utils/ids');

async function getdashboardUserId(req, res, next) {
  // requireOwner already enforced identity; validate shape here so malformed
  // ids return 400 (client bug) instead of hitting SQL or aliasing to Guest.
  const userId = validId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'Invalid user id' });
  try {
            // Independent selects run concurrently — ~3x faster than sequential awaits.
            const [statsRes, userRes, sleepRes, waterRes] = await Promise.all([
              db.execute(
                `SELECT calories_burned, steps, workout_duration_mins
                 FROM daily_stats 
                 WHERE user_id = ? AND stat_date = CURDATE()`,
                [userId]
              ),
              db.execute(
                `SELECT u.name, u.fitness_goal, COALESCE(p.avatar_url, u.avatar_url) AS avatar_url
                 FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
                 WHERE u.id = ?`,
                [userId]
              ),
              db.execute(
                `SELECT DATE_FORMAT(recorded_at, '%H:%i') AS label, AVG(sleep_duration) AS value
                 FROM sleep_logs
                 WHERE user_id = ? AND recorded_at >= CURDATE() AND recorded_at < CURDATE() + INTERVAL 1 DAY
                 GROUP BY label ORDER BY label ASC LIMIT 20`,
                [userId]
              ),
              db.execute(
                `SELECT COALESCE(SUM(water_intake_ml),0) AS water_ml, COALESCE(SUM(sleep_duration),0) AS sleep_h
                 FROM sleep_logs WHERE user_id = ? AND recorded_at >= CURDATE() AND recorded_at < CURDATE() + INTERVAL 1 DAY`,
                [userId]
              ),
            ]);
            const [stats] = statsRes;
            const [user] = userRes;
            const [sleepData] = sleepRes;
            const [[waterRow]] = waterRes;

            // Readiness v2 (utils/readiness): check-in driven when present,
            // activity fallback otherwise, null when no data at all.
            // Degrades gracefully on pre-014 databases (no daily_checkins table).
            let checkins = [];
            try {
              [checkins] = await db.execute(
                  `SELECT sleep_hours, sleep_quality, stress_level, soreness_level, soreness_level AS soreness, energy_level
                   FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE() LIMIT 1`,
                  [userId]
              );
            } catch (err) {
              if (err.code !== 'ER_NO_SUCH_TABLE' && err.code !== 'ER_BAD_FIELD_ERROR') throw err;
              log.warn('[dashboard] daily_checkins schema mismatch — run db:migrate (014/016)');
            }
            const s = stats[0] || { calories_burned: 0, steps: 0, workout_duration_mins: 0 };
            const r = calcReadiness({
              checkin: checkins[0] || null,
              sleepCount: (sleepData || []).length,
              steps: s.steps || 0,
              calories: s.calories_burned || 0,
            });

            res.json({
                stats:    { ...s, water_intake_ml: Number(waterRow?.water_ml || 0),
                            sleep_duration: Number(waterRow?.sleep_h || 0),
                            readiness: r.readiness, readinessSource: r.source,
                            readinessNote: r.recommendation },
                profile:  user[0]   || { name: "Guest" },
                checkin:  checkins[0] || null,
                sleep_trend: sleepData || [],
                hrv_data: sleepData || [] // deprecated alias, use sleep_trend
            });
  } catch (e) {
    log.error('DASHBOARD ERROR:', e);
    next(e);
  }
}

async function getsearch(req, res, next) {
  try {
    const raw = req.query.q;
    if (!raw) return res.json([]);
    const q = String(raw).trim().slice(0, 50);
    if (!q) return res.json([]);
    const escaped = String(q).replace(/[\\%_]/g, (c) => `\\${c}`);
    const [results] = await db.execute(
      "SELECT u.name, COALESCE(p.avatar_url, u.avatar_url) AS avatar_url FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.name LIKE ? ESCAPE '\\\\' LIMIT 5",
      [`%${escaped}%`]
    );
    res.json(results);
  } catch (e) {
    log.error('SEARCH ERROR:', e);
    next(e);
  }
}

module.exports = { getdashboardUserId, getsearch };
