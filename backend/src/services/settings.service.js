const db = require('../config/db');

const ALLOWED_UNITS = ['metric', 'imperial'];
const ALLOWED_THEMES = ['light', 'dark', 'system'];
const DEFAULTS = { units: 'metric', step_goal: 8000, theme: 'system' };

async function getSettings(userId) {
  const [rows] = await db.execute(
    'SELECT units, step_goal, theme FROM user_settings WHERE user_id=?',
    [userId]
  );
  return rows;
}

// Upsert: merge partial updates over the stored row (or DEFAULTS when absent).
async function upsertSettings(userId, { units, step_goal, theme }) {
  const [existing] = await db.execute('SELECT units, step_goal, theme FROM user_settings WHERE user_id=?', [userId]);
  const cur = existing[0] || DEFAULTS;

  const nextUnits = units === undefined ? cur.units : units;
  const nextGoal = step_goal === undefined ? Number(cur.step_goal) : Number(step_goal);
  const nextTheme = theme === undefined ? cur.theme : theme;

  await db.execute(
    `INSERT INTO user_settings (user_id, units, step_goal, theme) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE units=VALUES(units), step_goal=VALUES(step_goal), theme=VALUES(theme), updated_at=NOW()`,
    [userId, nextUnits, nextGoal, nextTheme]
  );
  return { units: nextUnits, step_goal: nextGoal, theme: nextTheme };
}

module.exports = { ALLOWED_UNITS, ALLOWED_THEMES, DEFAULTS, getSettings, upsertSettings };
