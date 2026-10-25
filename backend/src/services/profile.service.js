
const db = require('../config/db');

// Returns false when the user row does not exist, true once the profile is saved.
async function updateProfile(userId, { fullName, contact, bio, avatar }) {
  const [userResult] = await db.execute(
    'UPDATE users SET name = ? WHERE id = ?',
    [fullName, userId]
  );
  if (userResult.affectedRows === 0) {
    return false;
  }

  // FIX: height_cm / weight_kg are intentionally NOT part of this
  // update anymore. They're owned by the BMI page (POST /api/bmi/:userId),
  // which upserts them into user_profiles. Touching them here would
  // overwrite that data with null every time the user saves their
  // name/contact/bio/avatar.
  await db.execute(`
                INSERT INTO user_profiles (user_id, contact, bio, avatar_url)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    contact    = VALUES(contact),
                    bio        = VALUES(bio),
                    avatar_url = VALUES(avatar_url)
            `, [
    userId,
    contact,
    bio,
    avatar,
  ]);

  return true;
}

// Returns the profile payload, or null when the user does not exist.
async function getProfile(userId) {
  // height_cm / weight_kg still selected here — Profile page reads
  // them read-only; they're written only from the BMI page.
  const [rows] = await db.execute(`
                SELECT 
                    u.name     AS fullName,
                    u.email,
                    p.contact,
                    p.bio,
                    p.avatar_url,
                    p.height_cm,
                    p.weight_kg
                FROM users u
                LEFT JOIN user_profiles p ON u.id = p.user_id
                WHERE u.id = ?
            `, [userId]);

  if (rows.length === 0) {
    return null;
  }

  // Attach active onboarding/fitness goal if exists (used by Profile page)
  let onboarding = null;
  try {
    const [gRows] = await db.execute(
      `SELECT goal_type, target_weight_kg, pace, focus, activity_level,
                        height_cm, weight_kg, bmi, dob, sex,
                        sleep_hours, sleep_quality, stress_level, exercise_freq, recovery_level,
                        daily_kcal, protein_g, carbs_g, fat_g, status, created_at
                 FROM fitness_goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (gRows.length) {
      const g = gRows[0];
      onboarding = {
        goalType: g.goal_type,
        targetWeightKg: g.target_weight_kg != null ? Number(g.target_weight_kg) : null,
        pace: g.pace,
        focus: g.focus,
        activityLevel: g.activity_level,
        heightCm: g.height_cm != null ? Number(g.height_cm) : null,
        weightKg: g.weight_kg != null ? Number(g.weight_kg) : null,
        bmi: g.bmi != null ? Number(g.bmi) : null,
        dob: g.dob,
        sex: g.sex,
        sleepHours: g.sleep_hours != null ? Number(g.sleep_hours) : null,
        sleepQuality: g.sleep_quality,
        stressLevel: g.stress_level,
        exerciseFreq: g.exercise_freq,
        recoveryLevel: g.recovery_level,
        dailyKcal: g.daily_kcal != null ? Number(g.daily_kcal) : null,
        proteinG: g.protein_g != null ? Number(g.protein_g) : null,
        carbsG: g.carbs_g != null ? Number(g.carbs_g) : null,
        fatG: g.fat_g != null ? Number(g.fat_g) : null,
        status: g.status,
        createdAt: g.created_at,
      };
    }
  } catch (_) { /* onboarding optional */ }

  return { ...rows[0], onboarding };
}

module.exports = { updateProfile, getProfile };
