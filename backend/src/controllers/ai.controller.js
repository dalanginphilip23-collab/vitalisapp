// AI — thin controller. Logic + DB live in services/ai.service.js.
const aiService = require('../services/ai.service');

// AI POSE ANALYSIS
async function postanalyzePose(req,res,next){
  try{
        try {
            const { image, metadata } = req.body;
            if (!image || typeof image !== 'string' || !image.includes(',')) {
              return res.status(400).json({ error: 'Valid base64 image (data:mime;base64,...) is required' });
            }
            if (image.length > 10 * 1024 * 1024) {
              return res.status(413).json({ error: 'Image payload too large (max 10MB).' });
            }
            const base64 = image.split(',')[1];
            if (!base64) return res.status(400).json({ error: 'Could not decode image' });
            const result = await aiService.analyzePose(base64, metadata);
            if (result.notConfigured) {
              return res.status(503).json({ error: 'AI vision is not configured. Set GEMINI_API_KEY.', code: 'AI_NOT_CONFIGURED' });
            }
            if (result.degraded) return res.json({ suggestion: result.suggestion, degraded: true });
            return res.json({ suggestion: result.suggestion });
        } catch (error) {
            // Message only: full error can serialize the image payload.
            console.error("Gemini Error:", error?.message);
            next(error);
        }
  }catch(e){ next(e); }
}

async function postaiFitnessAnalysis(req,res,next){
  try{
        const { stats } = req.body;
        // Identity comes from JWT — never trust a body userId
        const userId = req.user.id;

        try {
            const result = await aiService.fitnessAnalysis(userId, stats);

            if (result.kind === 'noSleep') {
                return res.status(200).json({
                    insights: [
                        {
                            id: `sleep-${Date.now()}`,
                            message: `${result.firstName}, we don't have enough sleep data to generate an accurate analysis yet. Please log your sleep and water intake to unlock personalized insights.`,
                            category: 'Rest Advisory',
                            trend: 'stable'
                        }
                    ],
                    fromCache: false,
                    warning: 'No valid sleep data found for this user.'
                });
            }

            if (result.kind === 'cached') {
                return res.json({
                    insights: [
                        { id: `sleep-${Date.now()}`,    ...result.sleepCached },
                        { id: `activity-${Date.now()}`, ...result.activityCached }
                    ],
                    fromCache: true
                });
            }

            if (result.kind === 'plainText') {
                return res.status(200).json({
                    insights: [
                        { id: `sleep-${Date.now()}`, message: String(result.rawStr).slice(0, 500), category: 'Rest Advisory', trend: 'stable' },
                    ],
                    fromCache: false,
                    warning: 'AI returned plain text; showing raw insight.',
                });
            }

            res.json({
                insights: [
                    { id: `sleep-${Date.now()}`,    ...result.sleepSuggestion },
                    { id: `activity-${Date.now()}`, ...result.activitySuggestion }
                ],
                fromCache: false
            });
        } catch (err) {
            // Message only: full error can embed sleep/activity rows.
            console.error("AI Logic Error:", err?.message);
            next(err);
        }
  }catch(e){ next(e); }
}

async function postaiCoach(req,res,next){
  try{
            const { landmarks, workoutType } = req.body;
            if (!landmarks || (typeof landmarks !== 'object' && !Array.isArray(landmarks))) {
              return res.status(400).json({ error: 'landmarks are required' });
            }
            try {
                const { tip } = await aiService.coachTip(workoutType, landmarks);
                res.json({ tip });
            } catch (error) {
                // Message only: full error can embed landmark arrays.
                console.error("Coach Error:", error?.message);
                next(error);
        }
  }catch(e){ next(e); }
}

async function getaiHistoryUserId(req,res,next){
  try{
                const { userId } = req.params;
                try {
                    const history = await aiService.getHistory(userId);
                    res.json(history);
                } catch (err) {
                    next(err);
              }
  }catch(e){ next(e); }
}

async function getlogsLatestUserId(req,res,next){
  try{
                    const { userId } = req.params;
                    try {
                        const data = await aiService.getLatestLogs(userId);
                        if (!data) {
                            return res.status(404).json({ message: "No historical data found for this user." });
                        }
                        res.json(data);
                    } catch (error) {
                        console.error("Error fetching latest logs:", error?.message);
                        next(error);
                    }
  }catch(e){ next(e); }
}

async function postaiRunAnalysis(req,res,next){
  try{
                const { run } = req.body;
                const userId = req.user.id;
                // Guard: missing/non-object run used to throw TypeError → 500.
                // Frontend tolerates failure (.catch(()=>null)), but 400 with a
                // clear message is cheaper than a 500 + error-handler noise.
                if (!run || typeof run !== 'object') {
                  return res.status(400).json({ error: 'run object is required (distance, duration, pace, calories).' });
                }
                // Sanitize: clamp absurd values so a bad client can't make the
                // coach praise a 500km / -100kcal run. Valid runs pass through
                // untouched; only out-of-range values are bounded.
                const cleanRun = {
                  distance: Math.min(500, Math.max(0, Number(run.distance) || 0)),
                  duration: String(run.duration || '00:00:00').slice(0, 32),
                  pace: String(run.pace || '--:--').slice(0, 32),
                  calories: Math.min(20000, Math.max(0, Math.round(Number(run.calories) || 0))),
                  splits: Array.isArray(run.splits) ? run.splits.slice(0, 100) : [],
                };

            try {
                const result = await aiService.runAnalysis(userId, cleanRun);

                if (result.kind === 'plainText') {
                  return res.status(200).json({
                    firstName: result.firstName,
                    summary: String(result.rawText).slice(0, 600),
                    prediction: 'Keep logging runs to unlock predictions.',
                    tip: 'Focus on steady pacing for your next run.',
                    emoji_verdict: '🏃',
                    stats: {
                        distance:  cleanRun.distance,
                        duration:  cleanRun.duration,
                        pace:      cleanRun.pace,
                        calories:  cleanRun.calories,
                    },
                    warning: 'AI returned plain text.',
                  });
                }

                res.json({
                    firstName: result.firstName,
                    summary:       result.summary,
                    prediction:    result.prediction,
                    tip:           result.tip,
                    emoji_verdict: result.emoji_verdict,
                    stats: {
                        distance:  cleanRun.distance,
                        duration:  cleanRun.duration,
                        pace:      cleanRun.pace,
                        calories:  cleanRun.calories,
                    }
                });

        } catch (err) {
            console.error('Run Analysis Error:', err?.message);
            next(err);
        }
  }catch(e){ next(e); }
}

// Get AI daily summary/recommendations based on progress and goals
async function getaiDailySummary(req,res,next){
  try{
    const userId = req.user.id;
    try {
      const result = await aiService.dailySummary(userId);
      res.json(result);
    } catch (err) {
      console.error('[daily-summary] Error:', err?.message);
      next(err);
    }
  }catch(e){ next(e); }
}

module.exports = { postanalyzePose, postaiFitnessAnalysis, postaiClinicalAnalysis: postaiFitnessAnalysis, postaiCoach, getaiHistoryUserId, getlogsLatestUserId, postaiRunAnalysis, getaiDailySummary };
