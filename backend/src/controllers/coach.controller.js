// AI coach — thin controller. AI orchestration lives in services/coach.service.js.
const { z } = require('zod');
const service = require('../services/coach.service');

const WORKOUT_TYPES = ['pushup', 'squat', 'plank', 'lunge', 'bicep_curl', 'overhead', 'crunch', 'situp', 'lateral_raise', 'calfraise', 'calf_raise', 'general'];

const coachSchema = z.object({
  workoutType: z.string().trim().toLowerCase().max(32).optional().default('general'),
  context: z.string().trim().max(2000).optional().default(''),
  // Legacy compat (useAiCoach sends these today)
  prompt: z.string().trim().max(4000).optional(),
  system: z.string().max(1000).optional(), // accepted but IGNORED
}).refine((v) => v.context || v.prompt, { message: 'context or prompt is required' });

async function post(req,res,next){
  try{
      const parsed = coachSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid coach request.', details: parsed.error.flatten().fieldErrors });
      }
      const rawType = String(parsed.data.workoutType || 'general').toLowerCase().trim();
      // Normalize aliases: calf_raise -> calfraise (frontend uses both)
      const normalized = rawType === 'calf_raise' ? 'calfraise' : rawType;
      const workoutType = WORKOUT_TYPES.includes(normalized) ? normalized : 'general';
      const context = (parsed.data.context || parsed.data.prompt || '').slice(0, 2000);
      if (!context.trim()) return res.status(400).json({ error: 'prompt is required' });
      try {
        const result = await service.getCoachingCue(workoutType, context);
        res.json(result);
      } catch (err) {
        next(err);
      }
  }catch(e){ next(e); }
}

module.exports = { post };
