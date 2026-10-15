// Clinical-analysis insights (sleep + activity → cached AI suggestions)
// plus insight-history endpoints. Identity always comes from JWT.
const db = require('../config/db');
const log = require('../utils/logger');
const { callGeminiWithFallback, safeParseAI } = require('../config/gemini');

async function postaiClinicalAnalysis(req,res,next){
  try{
        const { stats } = req.body;
        // Identity comes from JWT — never trust a body userId
        const userId = req.user.id;

        try {
            const [userRows] = await db.execute(
                'SELECT name, fitness_goal FROM users WHERE id = ? LIMIT 1',
                [userId]
            );
            const user = userRows[0] || { name: 'Athlete', fitness_goal: 'general fitness' };
            const firstName = user.name ? user.name.split(' ')[0] : 'Athlete';
            const [sleepRows] = await db.execute(
                `SELECT sleep_duration, sleep_quality, recovery_score, water_intake_ml, recorded_at
                 FROM sleep_logs
                 WHERE user_id = ?
                  AND (sleep_duration > 0 OR sleep_quality > 0 OR water_intake_ml > 0)
                 ORDER BY recorded_at DESC LIMIT 1`,
                [userId]
            );

            log.debug(`[VITALIS AI] ── SLEEP DB QUERY RESULT for user ${userId} ──`);
            log.debug(`  Rows returned: ${sleepRows.length}`);
            log.debug(`  Latest row   :`, sleepRows[0] || '⚠️ NO ROW FOUND IN DB');

            const dbSleep = sleepRows[0] || {};
            log.debug(`[VITALIS AI] Stats from frontend:`, stats);

            const sleep = {
                sleep_duration:  (stats?.sleep_duration  > 0) ? stats.sleep_duration  : (dbSleep.sleep_duration  || 0),
                sleep_quality:   (stats?.sleep_quality   > 0) ? stats.sleep_quality   : (dbSleep.sleep_quality   || 0),
                water_intake_ml: (stats?.water_intake_ml > 0) ? stats.water_intake_ml : (dbSleep.water_intake_ml || 0),
            };

            const activity = {
                calories_burned:       stats?.calories_burned       ?? 0,
                steps:                 stats?.steps                 ?? 0,
                workout_duration_mins: stats?.workout_duration_mins ?? 0,
            };

            if (!stats || Object.keys(stats).length === 0) {
                const [activityRows] = await db.execute(
                    'SELECT calories_burned, steps, workout_duration_mins FROM daily_stats WHERE user_id = ? ORDER BY stat_date DESC LIMIT 1',
                    [userId]
                );
                if (activityRows[0]) {
                    activity.calories_burned       = activityRows[0].calories_burned;
                    activity.steps                 = activityRows[0].steps;
                    activity.workout_duration_mins = activityRows[0].workout_duration_mins;
                }
            }

            log.debug(`[VITALIS AI] ── FINAL SLEEP OBJECT ──`);
            log.debug(`  sleep_duration : ${sleep.sleep_duration}  ${sleep.sleep_duration === 0 ? '⚠️ ZERO' : '✅'}`);
            log.debug(`  sleep_quality  : ${sleep.sleep_quality}   ${sleep.sleep_quality  === 0 ? '⚠️ ZERO' : '✅'}`);
            log.debug(`  water_intake_ml: ${sleep.water_intake_ml} ${sleep.water_intake_ml === 0 ? '⚠️ ZERO' : '✅'}`);
            log.debug(`[VITALIS AI] ── FINAL ACTIVITY OBJECT ──`);
            log.debug(`  calories_burned      : ${activity.calories_burned}       ${activity.calories_burned       === 0 ? '⚠️ ZERO' : '✅'}`);
            log.debug(`  steps                : ${activity.steps}                 ${activity.steps                 === 0 ? '⚠️ ZERO' : '✅'}`);
            log.debug(`  workout_duration_mins: ${activity.workout_duration_mins} ${activity.workout_duration_mins === 0 ? '⚠️ ZERO' : '✅'}`);

            // 5. Guard: If sleep data is still all zeros after DB fallback, return early
            if (sleep.sleep_duration === 0 && sleep.sleep_quality === 0 && sleep.water_intake_ml === 0) {
                log.debug(`[VITALIS AI] ⚠️ All sleep values are zero — returning early for user ${userId}`);
                return res.status(200).json({
                    insights: [
                        {
                            id: `sleep-${Date.now()}`,
                            message: `${firstName}, we don't have enough sleep data to generate an accurate analysis yet. Please log your sleep and water intake to unlock personalized insights.`,
                            category: 'Rest Advisory',
                            trend: 'stable'
                        }
                    ],
                    fromCache: false,
                    warning: 'No valid sleep data found for this user.'
                });
            }

            const today = new Date().toISOString().slice(0, 10); // e.g. "2025-05-02"
            const signature = `s${sleep.sleep_duration}-q${sleep.sleep_quality}-w${sleep.water_intake_ml}-c${activity.calories_burned}-st${activity.steps}-m${activity.workout_duration_mins}-u${userId}-d${today}`;

            log.debug(`[VITALIS AI] Cache signature: ${signature}`);

            const [cached] = await db.execute(
                'SELECT sleep_suggestion, activity_suggestion FROM ai_insight_cache WHERE user_id = ? AND data_signature = ? LIMIT 1',
                [userId, signature]
            );

            if (cached.length > 0) {
                log.debug(`[VITALIS AI] ✅ Cache HIT for user ${userId}`);
                let sleepCached = null; let activityCached = null;
                try { sleepCached = JSON.parse(cached[0].sleep_suggestion); } catch { sleepCached = { message: cached[0].sleep_suggestion }; }
                try { activityCached = JSON.parse(cached[0].activity_suggestion); } catch { activityCached = { message: cached[0].activity_suggestion }; }
                return res.json({
                    insights: [
                        { id: `sleep-${Date.now()}`,    ...sleepCached },
                        { id: `activity-${Date.now()}`, ...activityCached }
                    ],
                    fromCache: true
                });
            }

            log.debug(`[VITALIS AI] Cache MISS for user ${userId} — calling Gemini`);

            // 8. Contextual flags
            const waterGlass      = Math.round(sleep.water_intake_ml / 250);
            const sleepStatus     = sleep.sleep_duration >= 7 ? 'adequate' : sleep.sleep_duration >= 5 ? 'below optimal' : 'critically low';
            const qualityStatus   = sleep.sleep_quality  >= 7 ? 'excellent' : sleep.sleep_quality  >= 5 ? 'fair' : 'poor';
            const stepGoalPercent = Math.round((activity.steps / 10000) * 100);
            const calorieStatus   = activity.calories_burned >= 500 ? 'strong' : activity.calories_burned >= 200 ? 'moderate' : 'low';
            const workoutStatus   = activity.workout_duration_mins >= 45 ? 'solid session' : activity.workout_duration_mins >= 20 ? 'light session' : 'minimal activity';
            const hydrationStatus = sleep.water_intake_ml >= 2500 ? 'well-hydrated' : sleep.water_intake_ml >= 1500 ? 'approaching goal' : 'under-hydrated';
            const todayDate       = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            // Prompt — general fitness coaching only, no diagnosis/treatment language
            const DISCLAIMER = 'General fitness info only — not medical advice. Consult a professional if concerned.';
            const prompt = `
                    You are Vitalis AI Coach, a fitness coaching assistant embedded in a training dashboard.
                    Your job is to give ${firstName} a personalized, specific, and motivating fitness insight — not generic advice.

                    ATHLETE PROFILE:
                    - Name: ${firstName}
                    - Fitness Goal: ${user.fitness_goal || 'general fitness'}
                    - Date: ${todayDate}

                    BIOMETRIC DATA:
                    Sleep & Recovery:
                    - Sleep Duration:  ${sleep.sleep_duration} hours (${sleepStatus})
                    - Sleep Quality:   ${sleep.sleep_quality}/10 (${qualityStatus})
                    - Water Intake:    ${sleep.water_intake_ml} ml (~${waterGlass} glasses, ${hydrationStatus})

                    Daily Activity:
                    - Calories Burned: ${activity.calories_burned} kcal (${calorieStatus} output)
                    - Steps:           ${activity.steps} steps (${stepGoalPercent}% of 10,000 goal)
                    - Workout:         ${activity.workout_duration_mins} mins (${workoutStatus})

                    INSTRUCTIONS:
                    1. Address ${firstName} by name naturally in each message — not robotically.
                    2. Reference their EXACT numbers in the advice (e.g., "your ${sleep.sleep_duration} hours", "those ${activity.steps} steps").
                    3. Each message must be 2–3 sentences. Be specific, supportive, and actionable — never vague. Do not diagnose, treat, or prescribe.
                    4. Choose the trend ("up", "down", "stable") based on whether the metric is improving, declining, or neutral.
                    5. For sleep_suggestion: focus on sleep quality, recovery habits, and hydration relative to their numbers.
                    6. For activity_suggestion: focus on workout output, step count, and calorie burn relative to their goal.
                    7. Tone: supportive fitness coach — warm but data-driven.
                    8. NEVER say "great job" or "keep it up" as opening words. Start with ${firstName}'s name or an observation.
                    9. Do not use clinical/diagnostic language. This is general fitness info only (${DISCLAIMER}).

                    RESPONSE FORMAT (strict JSON only, no markdown, no extra text):
                    {
                    "sleep_suggestion": {
                        "message": "...",
                        "category": "Rest Advisory",
                        "trend": "up|down|stable"
                    },
                    "activity_suggestion": {
                        "message": "...",
                        "category": "Performance Tip",
                        "trend": "up|down|stable"
                    }
                    }`.trim();

            const raw = await callGeminiWithFallback(prompt);

            if (!raw || typeof raw !== 'string') {
                throw new Error("Invalid or empty response from AI Fallback Engine");
            }

            const { parsed: aiResult, raw: rawStr } = safeParseAI(raw);
            if (!aiResult?.sleep_suggestion || !aiResult?.activity_suggestion) {
              // AI returned non-JSON fallback string — degrade gracefully, don't 500
              return res.status(200).json({
                insights: [
                  { id: `sleep-${Date.now()}`, message: String(rawStr).slice(0, 500), category: 'Rest Advisory', trend: 'stable' },
                ],
                fromCache: false,
                warning: 'AI returned plain text; showing raw insight.',
              });
            }

            // UPDATE CACHE
            if (aiResult?.sleep_suggestion && aiResult?.activity_suggestion) {
                await db.execute(
                    `INSERT INTO ai_insight_cache (user_id, data_signature, sleep_suggestion, activity_suggestion)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                       sleep_suggestion    = VALUES(sleep_suggestion),
                       activity_suggestion = VALUES(activity_suggestion),
                       created_at          = NOW()`,
                    [userId, signature, JSON.stringify(aiResult.sleep_suggestion), JSON.stringify(aiResult.activity_suggestion)]
                );
            }

            res.json({
                insights: [
                    { id: `sleep-${Date.now()}`,    ...aiResult.sleep_suggestion },
                    { id: `activity-${Date.now()}`, ...aiResult.activity_suggestion }
                ],
                fromCache: false
            });

            } catch (err) {
                    // Message only: full error can embed sleep/activity rows.
                    log.error("AI Logic Error:", err?.message);
                    next(err);
            }
  }catch(e){ next(e); }
}

async function getaiHistoryUserId(req,res,next){
  try{
                const { userId } = req.params;
                try {
                    const [rows] = await db.execute(
                        `SELECT sleep_suggestion, activity_suggestion, created_at
                         FROM ai_insight_cache
                         WHERE user_id = ?
                         ORDER BY created_at DESC
                         LIMIT 20`,
                        [userId]
                    );
                 const history = rows.map(row => {
                   let s; let a;
                   try { s = JSON.parse(row.sleep_suggestion); } catch { s = { message: row.sleep_suggestion }; }
                   try { a = JSON.parse(row.activity_suggestion); } catch { a = { message: row.activity_suggestion }; }
                   return [
                        { ...s,    id: `sleep-${row.created_at}`,    timestamp: new Date(row.created_at).        toLocaleString() },
                        { ...a, id: `activity-${row.created_at}`, timestamp: new Date(row.created_at).        toLocaleString() },
                   ];
                 }).flat();
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
                    const [latestLog] = await db.execute(
                        `SELECT calories_burned, steps, workout_duration_mins
                         FROM daily_stats
                         WHERE user_id = ?
                         ORDER BY stat_date DESC LIMIT 1`,
                            [userId]
                    );

                     const [latestSleep] = await db.execute(
                            `SELECT * FROM sleep_logs
                             WHERE user_id = ?
                               AND (sleep_duration > 0 OR sleep_quality > 0 OR water_intake_ml > 0)
                             ORDER BY recorded_at DESC LIMIT 1`,
                            [userId]
                     );

            log.debug(`[LATEST LOGS] ── DB RESULTS for user ${userId} ──`);
            log.debug(`  latestLog  :`, latestLog[0]  || '⚠️ NO ROW RETURNED');
            log.debug(`  latestSleep:`, latestSleep[0] || '⚠️ NO ROW RETURNED');

            if (!latestLog.length && !latestSleep.length) {
                return res.status(404).json({ message: "No historical data found for this user." });
            }

            res.json({
                stats: {
                    calories_burned:       latestLog[0]?.calories_burned       || 0,
                    steps:                 latestLog[0]?.steps                 || 0,
                    workout_duration_mins: latestLog[0]?.workout_duration_mins || 0,
                    water_intake_ml:       latestSleep[0]?.water_intake_ml     || 0,
                    sleep_duration:        latestSleep[0]?.sleep_duration      || 0,
                    sleep_quality:         latestSleep[0]?.sleep_quality       || 0,
                },
                last_updated: latestLog[0]?.stat_date || latestSleep[0]?.recorded_at
            });
        } catch (error) {
            log.error("Error fetching latest logs:", error?.message);
            next(error);
        }
  }catch(e){ next(e); }
}

module.exports = { postaiClinicalAnalysis, getaiHistoryUserId, getlogsLatestUserId };
