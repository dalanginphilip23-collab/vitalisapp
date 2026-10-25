// BMI — thin controller. Logic + DB live in services/bmi.service.js.
const bmiService = require('../services/bmi.service');

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
    
        const bmi = bmiService.computeBmi(w, h);
        if (!Number.isFinite(bmi)) return res.status(400).json({ error: 'Could not compute BMI from given values' });

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
            const saved = await bmiService.saveBmi(userId, {
              weight: w, height: h, bmi, age: ageNum, gender: genderNorm,
            });

            if (process.env.NODE_ENV !== 'production') console.log(`[BMI] Saved — userId:${userId} bmi:${saved.bmi} category:${saved.category}`);
            res.status(200).json({ message: 'BMI saved', id: saved.id, bmi: saved.bmi, category: saved.category, aiSuggestion: saved.aiSuggestion, degraded: saved.degraded });

        } catch (err) {
            console.error('[BMI] Insert Error:', err.message);
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
            const data = await bmiService.listRecords(userId, limit, offset);
            res.json(data);
        } catch (err) {
            console.error('[BMI] Fetch Error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

module.exports = { postUserId, getUserId };
