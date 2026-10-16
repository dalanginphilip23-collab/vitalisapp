
const db = require('../config/db');
const { callGeminiWithFallback } = require('../config/gemini');
// Single BMI category source — matches planEngine (Onboarding) and the master plan.
const { bmiCategory: getBmiCategory, calcBmi } = require('../utils/planEngine');
const log = require('../utils/logger');

const VALID_GENDERS = ['male', 'female', 'other'];

// Save BMI and return AI suggestion

async function postUserId(req,res,next){
  try{
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
          return res.status(400).json({ error: 'Invalid user id' });
        }
        const { weight_kg, height_cm, age, gender } = req.body || {};
    
        const w = Number(weight_kg);
        const h = Number(height_cm);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
            return res.status(400).json({ error: 'weight_kg and height_cm must be positive numbers' });
        }
        if (h < 50 || h > 300) return res.status(400).json({ error: 'height_cm out of range (50–300)' });
        if (w < 10 || w > 1000) return res.status(400).json({ error: 'weight_kg out of range (10–1000)' });
    
        // Single precision source: planEngine.calcBmi (1 decimal) keeps the
        // BMI log, Profile page, and onboarding plan in agreement.
        const bmi = calcBmi(w, h);
        if (!Number.isFinite(bmi)) return res.status(400).json({ error: 'Could not compute BMI from given values' });
        const category = getBmiCategory(bmi);

        const ageNum = age == null || age === '' ? null : Number(age);
        if (ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 5 || ageNum > 120)) {
          return res.status(400).json({ error: 'age must be an integer 5–120' });
        }
        const genderNorm = gender == null || gender === '' ? null
          : String(gender).trim().toLowerCase();
        if (genderNorm !== null && !VALID_GENDERS.includes(genderNorm)) {
          return res.status(400).json({ error: `gender must be one of: ${VALID_GENDERS.join(', ')}` });
        }
    
        try {
            const [result] = await db.execute(
                `INSERT INTO bmi_records (user_id, weight_kg, height_cm, bmi, bmi_category, recorded_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [userId, w, h, bmi, category]
            );
    
            // FIX: keep user_profiles.height_cm / weight_kg in sync with the
            // latest BMI log, so the Profile page (which computes BMI live
            // from user_profiles) reflects this calculation immediately.
            // Requires a UNIQUE constraint on user_profiles.user_id.
            await db.execute(`
                INSERT INTO user_profiles (user_id, height_cm, weight_kg)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    height_cm = VALUES(height_cm),
                    weight_kg = VALUES(weight_kg)
            `, [userId, h, w]);
    
            // Generate AI suggestion — general fitness info only, never diagnosis/treatment
            const prompt = `You are Vitalis AI, a fitness assistant providing general fitness information only.
                A user has the following stats:
                - BMI: ${bmi} (${category})
                - Weight: ${w} kg
                - Height: ${h} cm
                ${ageNum !== null ? `- Age: ${ageNum}` : ''}
                ${genderNorm ? `- Gender: ${genderNorm}` : ''}

                Give a 2-3 sentence personalized, encouraging fitness suggestion based on their body profile.
                Be direct, warm, and actionable. Do not diagnose, treat, or prescribe.
                End with: General fitness info only — not medical advice.`;
    
            let aiSuggestion = '';
            let aiDegraded = false;
            try {
                aiSuggestion = await callGeminiWithFallback(prompt);
                // callGeminiWithFallback never throws on outage — returns high-demand string
                if (typeof aiSuggestion === 'string' && /high demand|currently experiencing|try again later/i.test(aiSuggestion)) {
                  aiDegraded = true;
                  aiSuggestion = 'Focus on balanced nutrition and consistent activity to optimize your body composition.';
                }
            } catch (aiErr) {
                log.error('[BMI] AI Error:', aiErr.message);
                aiDegraded = true;
                aiSuggestion = 'Focus on balanced nutrition and consistent activity to optimize your body composition.';
            }
    
            log.debug(`[BMI] Saved — userId:${userId} bmi:${bmi} category:${category}`);
            res.status(200).json({ message: 'BMI saved', id: result.insertId, bmi, category, aiSuggestion, degraded: aiDegraded });
    
        } catch (err) {
            log.error('[BMI] Insert Error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

async function getUserId(req,res,next){
  try{
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId <= 0) {
          return res.status(400).json({ error: 'Invalid user id' });
        }
        const limit  = Math.min(Math.max(parseInt(req.query.limit, 10)  || 10, 1), 100);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    
        try {
            // NOTE: db.query (not execute) — mysql2 server-side prepares reject
            // placeholders in LIMIT/OFFSET on some MySQL versions.
            const [rows] = await db.query(
                `SELECT id, weight_kg, height_cm, bmi, bmi_category,
                        DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i') AS recorded_at
                 FROM bmi_records
                 WHERE user_id = ?
                 ORDER BY recorded_at DESC
                 LIMIT ? OFFSET ?`,
                [userId, limit, offset]
            );
    
            const [[countRow]] = await db.execute(
                `SELECT COUNT(*) AS total FROM bmi_records WHERE user_id = ?`,
                [userId]
            );
    
            res.json({ records: rows, total: countRow?.total ?? 0 });
        } catch (err) {
            log.error('[BMI] Fetch Error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

module.exports = { postUserId, getUserId };
