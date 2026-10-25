// Security — business logic + DB access.
// (Active device sessions list + single-session removal.)
const db = require('../config/db');

// All sessions for the logged in user.
async function getSessions(userId) {
  try {
    const [rows] = await db.execute(`
                SELECT
                    id,
                    device      AS device_type,
                    browser,
                    os,
                    ip_address,
                    location    AS city,
                    ''          AS country,
                    created_at  AS last_active,
                    is_current
                FROM user_sessions
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 50
              `, [userId]);
    return rows;
  } catch (e) {
    // Fallback for DBs where location column also missing (defensive)
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      const [fallback] = await db.execute(`
                  SELECT
                      id,
                      device      AS device_type,
                      browser,
                      os,
                      ip_address,
                      ''          AS city,
                      ''          AS country,
                      created_at  AS last_active,
                      is_current
                  FROM user_sessions
                  WHERE user_id = ?
                  ORDER BY created_at DESC
                  LIMIT 50
                `, [userId]);
      return fallback;
    } else throw e;
  }
}

// Removes one of the caller's own sessions. Returns true when a row was deleted.
async function deleteSession(sessionId, userId) {
  const [result] = await db.execute(`
                DELETE FROM user_sessions
                WHERE id = ? AND user_id = ?
            `, [sessionId, userId]);
  return result.affectedRows > 0;
}

module.exports = { getSessions, deleteSession };
