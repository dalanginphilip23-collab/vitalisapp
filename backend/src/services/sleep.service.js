// Sleep logs — business logic + DB access.
// (Write log, latest "today" row, graph series, analysis, scatter.)
const db = require("../config/db");

// Insert a sleep log row. Values are range-validated by the controller.
async function saveSleepLog(userId, values) {
  await db.execute(
    `INSERT INTO sleep_logs 
          (user_id, sleep_duration, sleep_quality, recovery_score, water_intake_ml)
          VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      values.sleepDuration,
      values.sleepQuality,
      values.recoveryScore,
      values.waterIntakeMl,
    ],
  );
  return { success: true };
}

// Most recent non-empty log for the user, or null when none exists.
async function getLatestToday(userId) {
  const [rows] = await db.execute(
    `SELECT sleep_duration, sleep_quality, recovery_score, water_intake_ml, recorded_at
         FROM sleep_logs
         WHERE user_id = ?
         AND (sleep_duration > 0 OR sleep_quality > 0 OR water_intake_ml > 0 OR recovery_score > 0)
         ORDER BY recorded_at DESC
         LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

const SERIES_METRIC_COLUMNS = {
  duration: "sleep_duration",
  quality: "sleep_quality",
  recovery: "recovery_score",
};

async function getSeries(userId, range, metric) {
  const interval = range === "W" ? "7 DAY" : range === "M" ? "30 DAY" : "1 DAY";
  const column = SERIES_METRIC_COLUMNS[metric] ?? "sleep_duration";
  const isDaily = range === "D";
  const labelFormat = isDaily ? "%H:%i" : "%m/%d";
  // Daily: one row per log (no GROUP BY — grouping by raw timestamp
  // explodes under ONLY_FULL_GROUP_BY). W/M: daily averages.
  const [rows] = isDaily
    ? await db.execute(
        `SELECT DATE_FORMAT(recorded_at, '${labelFormat}') AS label,
                        ${column} AS value
                 FROM sleep_logs
                 WHERE user_id = ?
                   AND recorded_at >= DATE_SUB(NOW(), INTERVAL ${interval})
                   AND ${column} > 0
                 ORDER BY recorded_at ASC
                 LIMIT 1000`,
        [userId],
      )
    : await db.execute(
        `SELECT DATE_FORMAT(recorded_at, '${labelFormat}') AS label,
                        AVG(${column}) AS value
                 FROM sleep_logs
                 WHERE user_id = ?
                   AND recorded_at >= DATE_SUB(NOW(), INTERVAL ${interval})
                   AND ${column} > 0
                 GROUP BY DATE(recorded_at)
                 ORDER BY DATE(recorded_at) ASC
                 LIMIT 1000`,
        [userId],
      );
  return rows;
}

const ANALYSIS_METRIC_COLUMNS = {
  sleep_hours: "sleep_duration",
  recovery_score: "recovery_score",
  efficiency: "sleep_quality",
};

async function getAnalysis(userId, range, metric) {
  const column = ANALYSIS_METRIC_COLUMNS[metric] || "sleep_duration";
  const interval = range === "W" ? "7 DAY" : range === "M" ? "30 DAY" : "1 DAY";
  const isDaily = range === "D";
  const labelFormat = isDaily ? "%H:%i" : range === "W" ? "%a" : "%m/%d";

  // GROUP BY the same expression as the label — grouping by
  // HOUR() while selecting %H:%i breaks under ONLY_FULL_GROUP_BY.
  const groupExpr = isDaily ? "DATE_FORMAT(recorded_at, '%Y-%m-%d %H')" : "DATE(recorded_at)";
  const [rows] = await db.execute(
    `SELECT DATE_FORMAT(recorded_at, '${labelFormat}') AS label, 
                        AVG(${column}) AS value
                 FROM sleep_logs
                 WHERE user_id = ? 
                   AND recorded_at >= DATE_SUB(NOW(), INTERVAL ${interval})
                 GROUP BY ${groupExpr}
                 ORDER BY MIN(recorded_at) ASC
                 LIMIT 1000`,
    [userId],
  );
  return rows;
}

const SCATTER_INTERVALS = {
  weekly: "7 DAY",
  monthly: "30 DAY",
  quarterly: "90 DAY",
};

async function getScatter(userId, timeframe) {
  const interval = SCATTER_INTERVALS[timeframe];
  const [rows] = await db.execute(
    `SELECT 
                   sleep_duration,
                   sleep_quality,
                   recovery_score,
                   DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i') AS recorded_at
                 FROM sleep_logs
                  WHERE user_id = ?
                    AND recorded_at >= DATE_SUB(NOW(), INTERVAL ${interval})
                    AND sleep_duration > 0
                    AND sleep_quality  > 0
                  ORDER BY recorded_at ASC
                  LIMIT 1000`,
    [userId],
  );
  return rows;
}

module.exports = {
  saveSleepLog,
  getLatestToday,
  getSeries,
  getAnalysis,
  getScatter,
};
