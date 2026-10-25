const db = require('../config/db');

const ALLOWED = ['PROTEIN','CARBOHYDRATES','FAT','TRANS_FAT','SATURATED_FAT','POLYUNSATURATED_FAT','MONOUNSATURATED_FAT','CALORIES','STEPS','EXERCISE','WEIGHT'];
const DEFAULTS = { PROTEIN: 50, CARBOHYDRATES: 275, FAT: 78, TRANS_FAT: 2, SATURATED_FAT: 20, POLYUNSATURATED_FAT: 22, MONOUNSATURATED_FAT: 22, CALORIES: 1500, STEPS: 10000, EXERCISE: 400, WEIGHT: 70 };

async function getGoals(userId) {
  const [rows] = await db.execute('SELECT nutrient, target_value, is_active, created_at FROM user_nutrient_goals WHERE user_id=? AND is_active=1 ORDER BY nutrient', [userId]);
  return rows;
}

async function upsertGoal(userId, nutrient, target) {
  await db.execute(
    `INSERT INTO user_nutrient_goals (user_id, nutrient, target_value, is_active) VALUES (?,?,?,1)
     ON DUPLICATE KEY UPDATE target_value=VALUES(target_value), is_active=1, updated_at=NOW()`,
    [userId, nutrient, target]
  );
  const [rows] = await db.execute('SELECT nutrient, target_value, is_active FROM user_nutrient_goals WHERE user_id=? AND is_active=1 ORDER BY nutrient', [userId]);
  return rows;
}

async function deactivateGoal(userId, nutrient) {
  await db.execute('UPDATE user_nutrient_goals SET is_active=0 WHERE user_id=? AND nutrient=?', [userId, nutrient]);
  const [rows] = await db.execute('SELECT nutrient, target_value, is_active FROM user_nutrient_goals WHERE user_id=? AND is_active=1 ORDER BY nutrient', [userId]);
  return rows;
}

module.exports = { ALLOWED, DEFAULTS, getGoals, upsertGoal, deactivateGoal };
