// AI — business logic + DB access.
// (Pose form analysis, chat, fitness insights, real-time coach, insight
//  history, latest logs, run analysis.)
// HTTP concerns (status codes, response shapes) stay in ai.controller.js.
const db = require("../config/db");
const {
  genAI,
  callGeminiWithFallback,
  safeParseAI,
  withTimeout,
  AI_VISION_TIMEOUT_MS,
  getVisionModels,
  aiConfigured,
} = require("../config/gemini");
const { getGoalProfile, DEFAULT_GOAL_PROFILE } = require("../utils/goalProfile");
const { calcReadiness } = require("../utils/readiness");

// AI POSE ANALYSIS
async function analyzePose(base64, metadata) {
  // Cap metadata to bound prompt cost / injection surface
  const safeMetadata = typeof metadata === 'string' ? metadata.slice(0, 5000) : '';
  const visionModels = typeof getVisionModels === 'function' ? getVisionModels() : ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash"];
  let lastErr = null;
  for (const visionModel of visionModels) {
    try {
      const model = genAI.getGenerativeModel({ model: visionModel });
      const prompt = `
                Context: The user is exercising. 
                Skeletal Data: ${safeMetadata}
                Task: Using the image and the skeletal data, give a 1-sentence coach's correction. 
                If the form is perfect, say something encouraging. 
                Be very concise.
            `;
      const imageParts = [{ inlineData: { data: base64, mimeType: "image/jpeg" } }];
      const result = await withTimeout(
        model.generateContent([prompt, ...imageParts]),
        AI_VISION_TIMEOUT_MS,
        `${visionModel} vision (pose)`
      );
      const suggestion = result.response.text();
      if (suggestion) return { suggestion, degraded: false };
    } catch (e) {
      lastErr = e;
      if (process.env.NODE_ENV !== 'production') console.warn(`[analyze-pose] ${visionModel} failed:`, e.message);
    }
  }
  // All vision models failed — degrade to text fallback coach tip instead of 500 when possible
  try {
    if (typeof aiConfigured === 'function' && !aiConfigured()) {
      return { notConfigured: true };
    }
    const fallback = await callGeminiWithFallback(
      `You are a concise gym coach. Skeletal context: ${safeMetadata.slice(0, 1000)}. Give a 1-sentence form correction or encouragement.`
    );
    if (fallback && !fallback.toLowerCase().includes('high demand')) {
      return { suggestion: fallback, degraded: true };
    }
  } catch (_) { /* fall through to error below */ }
  throw lastErr || new Error('All vision providers failed');
}

async function fitnessAnalysis(userId, stats) {
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

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[VITALIS AI] ── SLEEP DB QUERY RESULT for user ${userId} ──`);
    console.log(`  Rows returned: ${sleepRows.length}`);
    console.log(`  Latest row   :`, sleepRows[0] || '⚠️ NO ROW FOUND IN DB');
  }

  const dbSleep = sleepRows[0] || {};
  if (process.env.NODE_ENV !== 'production') console.log(`[VITALIS AI] Stats from frontend:`, stats);

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

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[VITALIS AI] ── FINAL SLEEP OBJECT ──`);
    console.log(`  sleep_duration : ${sleep.sleep_duration}  ${sleep.sleep_duration === 0 ? '⚠️ ZERO' : '✅'}`);
    console.log(`  sleep_quality  : ${sleep.sleep_quality}   ${sleep.sleep_quality  === 0 ? '⚠️ ZERO' : '✅'}`);
    console.log(`  water_intake_ml: ${sleep.water_intake_ml} ${sleep.water_intake_ml === 0 ? '⚠️ ZERO' : '✅'}`);
    console.log(`[VITALIS AI] ── FINAL ACTIVITY OBJECT ──`);
    console.log(`  calories_burned      : ${activity.calories_burned}       ${activity.calories_burned       === 0 ? '⚠️ ZERO' : '✅'}`);
    console.log(`  steps                : ${activity.steps}                 ${activity.steps                 === 0 ? '⚠️ ZERO' : '✅'}`);
    console.log(`  workout_duration_mins: ${activity.workout_duration_mins} ${activity.workout_duration_mins === 0 ? '⚠️ ZERO' : '✅'}`);
  }

  // 5. Guard: If sleep data is still all zeros after DB fallback, return early
  if (sleep.sleep_duration === 0 && sleep.sleep_quality === 0 && sleep.water_intake_ml === 0) {
    if (process.env.NODE_ENV !== 'production') console.log(`[VITALIS AI] ⚠️ All sleep values are zero — returning early for user ${userId}`);
    return { kind: 'noSleep', firstName };
  }

  const today = new Date().toISOString().slice(0, 10); // e.g. "2025-05-02"
  const signature = `s${sleep.sleep_duration}-q${sleep.sleep_quality}-w${sleep.water_intake_ml}-c${activity.calories_burned}-st${activity.steps}-m${activity.workout_duration_mins}-u${userId}-d${today}`;

  if (process.env.NODE_ENV !== 'production') console.log(`[VITALIS AI] Cache signature: ${signature}`);

  const [cached] = await db.execute(
    'SELECT sleep_suggestion, activity_suggestion FROM ai_insight_cache WHERE user_id = ? AND data_signature = ? LIMIT 1',
    [userId, signature]
  );

  if (cached.length > 0) {
    if (process.env.NODE_ENV !== 'production') console.log(`[VITALIS AI] ✅ Cache HIT for user ${userId}`);
    let sleepCached = null; let activityCached = null;
    try { sleepCached = JSON.parse(cached[0].sleep_suggestion); } catch { sleepCached = { message: cached[0].sleep_suggestion }; }
    try { activityCached = JSON.parse(cached[0].activity_suggestion); } catch { activityCached = { message: cached[0].activity_suggestion }; }
    return { kind: 'cached', sleepCached, activityCached };
  }

  if (process.env.NODE_ENV !== 'production') console.log(`[VITALIS AI] Cache MISS for user ${userId} — calling Gemini`);

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
    return { kind: 'plainText', rawStr };
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

  return {
    kind: 'ok',
    firstName,
    sleepSuggestion: aiResult.sleep_suggestion,
    activitySuggestion: aiResult.activity_suggestion,
  };
}

async function coachTip(workoutType, landmarks) {
  // Whitelist mirrors coach.controller.js WORKOUT_TYPES. Unknown types
  // fall back to 'general' (same as /api/coach) — never 400, so no
  // caller breaks. No frontend calls this endpoint today (useAiCoach
  // uses /api/coach); this only tightens any direct API use.
  const KNOWN_TYPES = ['pushup', 'squat', 'plank', 'lunge', 'bicep_curl', 'overhead', 'crunch', 'situp', 'lateral_raise', 'calfraise', 'calf_raise', 'general'];
  const rawType = (workoutType || 'general').toString().toLowerCase().trim().slice(0, 32);
  const normalized = rawType === 'calf_raise' ? 'calfraise' : rawType;
  const safeType = KNOWN_TYPES.includes(normalized) ? normalized.toUpperCase() : 'GENERAL';
  const prompt = `
                    You are a real-time gym coach. Analyze these landmarks for a ${safeType} set.
                    Landmarks: ${JSON.stringify(landmarks).slice(0, 4000)}
                    Give ONE technical tip (max 10 words). 
                    - If PUSHUP: focus on "flat back" or "elbow angle".
                    - If SQUAT: focus on "depth" or "weight on heels".
                    - If PLANK: focus on "hips height".
                    Strict Rule: Only reply with the coaching tip text. No conversational filler.
                    `;
  const tip = (await callGeminiWithFallback(prompt)).trim().slice(0, 300);
  return { tip };
}

async function getHistory(userId) {
  const [rows] = await db.execute(
    `SELECT sleep_suggestion, activity_suggestion, created_at 
     FROM ai_insight_cache 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [userId]
  );
  const history = rows.map(row => {
    let s = {}; let a = {};
    try { s = JSON.parse(row.sleep_suggestion); } catch { s = { message: row.sleep_suggestion }; }
    try { a = JSON.parse(row.activity_suggestion); } catch { a = { message: row.activity_suggestion }; }
    return [
      { ...s, id: `sleep-${row.created_at}`, timestamp: new Date(row.created_at).toLocaleString() },
      { ...a, id: `activity-${row.created_at}`, timestamp: new Date(row.created_at).toLocaleString() },
    ];
  }).flat();
  return history;
}

async function getLatestLogs(userId) {
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

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[LATEST LOGS] ── DB RESULTS for user ${userId} ──`);
    console.log(`  latestLog  :`, latestLog[0]  || '⚠️ NO ROW RETURNED');
    console.log(`  latestSleep:`, latestSleep[0] || '⚠️ NO ROW RETURNED');
  }

  if (!latestLog.length && !latestSleep.length) {
    return null;
  }

  return {
    stats: {
      calories_burned:       latestLog[0]?.calories_burned       || 0,
      steps:                 latestLog[0]?.steps                 || 0,
      workout_duration_mins: latestLog[0]?.workout_duration_mins || 0,
      water_intake_ml:       latestSleep[0]?.water_intake_ml     || 0,
      sleep_duration:        latestSleep[0]?.sleep_duration      || 0,
      sleep_quality:         latestSleep[0]?.sleep_quality       || 0,
    },
    last_updated: latestLog[0]?.stat_date || latestSleep[0]?.recorded_at
  };
}

async function runAnalysis(userId, cleanRun) {
  // Fetch user profile
  const [userRows] = await db.execute(
    'SELECT name, fitness_goal FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const user = userRows[0] || { name: 'Athlete', fitness_goal: 'general fitness' };
  const firstName = user.name ? user.name.split(' ')[0] : 'Athlete';

  // Fetch last 7 runs for trend/predictive analysis
  const [runHistory] = await db.execute(
    `SELECT distance, duration, pace, calories, created_at
     FROM activity_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 7`,
    [userId]
  );

  const totalRuns     = runHistory.length;
  const avgDistance   = totalRuns > 0 ? (runHistory.reduce((s, r) => s + parseFloat(r.distance || 0), 0) / totalRuns).toFixed(2) : 0;
  const avgCalories   = totalRuns > 0 ? Math.round(runHistory.reduce((s, r) => s + (r.calories || 0), 0) / totalRuns) : 0;
  // Robust trend: avg of last 3 vs previous 3 (not single-point noisy compare).
  // Pace-aware: improving if distance up OR same distance at better pace.
  const parsePaceSec = (p) => {
    const m = String(p || '').match(/(\d+):(\d+)/);
    if (!m) return null;
    const s = Number(m[1]) * 60 + Number(m[2]);
    return Number.isFinite(s) && s > 0 && s < 3600 ? s : null;
  };
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  let isImproving = false;
  let trendDetail = 'not enough history';
  if (totalRuns >= 2) {
    const recent = runHistory.slice(0, 3);
    const prev = runHistory.slice(3, 6);
    const recentDist = avg(recent.map((r) => parseFloat(r.distance || 0)));
    const prevDist = prev.length ? avg(prev.map((r) => parseFloat(r.distance || 0))) : avg(recent.slice(1).map((r) => parseFloat(r.distance || 0)));
    const recentPace = avg(recent.map((r) => parsePaceSec(r.pace)).filter((v) => v != null));
    const prevPace = avg(runHistory.slice(1, 4).map((r) => parsePaceSec(r.pace)).filter((v) => v != null));
    const distUp = recentDist > prevDist * 1.02; // >2% to ignore GPS noise
    const paceBetter = recentPace && prevPace && recentPace < prevPace * 0.98;
    isImproving = Boolean(distUp || paceBetter);
    trendDetail = `recent ${recentDist.toFixed(2)}km vs prev ${prevDist.toFixed(2)}km${recentPace && prevPace ? `, pace ${Math.round(recentPace)}s vs ${Math.round(prevPace)}s` : ''}`;
  }
  const consistency   = totalRuns >= 5 ? 'very consistent' : totalRuns >= 3 ? 'building consistency' : 'just getting started';

  const prompt = `
                    You are Vitalis AI, a warm, friendly, and encouraging running coach embedded in a fitness app.
                    Your job is to give ${firstName} a personalized post-run analysis with a friendly tone — like a supportive coach who's genuinely proud              of them.

                    RUNNER PROFILE:
                    - Name: ${firstName}
                    - Fitness Goal: ${user.fitness_goal || 'general fitness'}
                    - Consistency Level: ${consistency} (${totalRuns} runs logged)

                    THIS RUN:
                    - Distance:  ${cleanRun.distance} km
                    - Duration:  ${cleanRun.duration} (hh:mm:ss)
                    - Pace:      ${cleanRun.pace} /km
                    - Calories:  ${cleanRun.calories} kcal
                    - Splits:    ${cleanRun.splits?.length > 0 ? cleanRun.splits.map(s => `KM ${s.km}: ${s.pace}`).join(', ') : 'No splits recorded'}

                    HISTORICAL AVERAGES (last ${totalRuns} runs):
                    - Avg Distance: ${avgDistance} km
                    - Avg Calories: ${avgCalories} kcal
                    - Trend: ${isImproving ? 'improving 📈' : 'steady — encourage consistency'} (${trendDetail})
                    NOTE: This is motivational coaching, not medical or physiological prediction.

                    INSTRUCTIONS:
                    1. Start with a warm, genuine reaction to this specific run — reference their exact numbers.
                    2. For summary: 2-3 sentences covering what they did well and one thing to watch.
                    3. For prediction: based on their history and consistency, predict what they could realistically achieve in 30 days if they keep it up.                 Be specific (e.g., "you could hit 5km runs" or "shave 30 seconds off your pace"). Make it exciting but realistic.
                    4. For tip: one specific, actionable tip for their next run based on their pace and splits.
                    5. Tone: warm, friendly, like a coach who genuinely cares — not robotic. Use their name naturally.
                    6. NEVER say "great job" or "keep it up" as opening words.

                    RESPONSE FORMAT (strict JSON only, no markdown, no extra text):
                    {
                    "summary": "...",
                    "prediction": "...",
                    "tip": "...",
                    "emoji_verdict": "🔥|💪|⚡|🏃|✨"
                    }`.trim();

  const raw = await callGeminiWithFallback(prompt);

  if (!raw || typeof raw !== 'string') {
    throw new Error("Invalid response from AI");
  }

  const { parsed: aiResult, raw: rawText } = safeParseAI(raw);
  if (!aiResult?.summary) {
    return { kind: 'plainText', firstName, rawText };
  }

  // Send notification
  try {
    await db.execute(
      'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
      [
        userId,
        `${aiResult.emoji_verdict} Run Analysis: ${aiResult.summary}`,
        'info'
      ]
    );
  } catch (notifErr) {
    console.error('Notification insert failed:', notifErr.message);
  }

  return {
    kind: 'ok',
    firstName,
    summary:       aiResult.summary,
    prediction:    aiResult.prediction,
    tip:           aiResult.tip,
    emoji_verdict: aiResult.emoji_verdict,
  };
}

// ─── Goal-aware daily summary ───────────────────────────────────────────────
// Powers the Dashboard "AI Summary" card. Combines the active onboarding goal,
// today's activity and the weight target into a short coaching summary.
// Always computes a deterministic rule-based summary first, then optionally
// enriches it with Gemini. If AI is disabled/unavailable the rule summary is
// returned — the card never breaks.

// Short-lived, bounded in-memory cache so dashboard reloads / focus events
// don't re-hit Gemini for the same data. No DB schema change required.
const SUMMARY_TTL_MS = 10 * 60 * 1000;
const SUMMARY_CACHE_MAX = 500;
const summaryCache = new Map();

function summaryCacheGet(key) {
  const hit = summaryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SUMMARY_TTL_MS) {
    summaryCache.delete(key);
    return null;
  }
  return hit.value;
}

function summaryCacheSet(key, value) {
  if (summaryCache.size >= SUMMARY_CACHE_MAX) {
    const oldest = summaryCache.keys().next().value;
    if (oldest !== undefined) summaryCache.delete(oldest);
  }
  summaryCache.set(key, { at: Date.now(), value });
}

async function getActiveGoalForSummary(userId) {
  const [rows] = await db.execute(
    `SELECT goal_type, daily_kcal, protein_g, carbs_g, fat_g, target_weight_kg, weight_kg
       FROM fitness_goals
      WHERE user_id = ? AND status = 'active'
      ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getSummaryMetrics(userId, goal) {
  const [foodRows] = await db.execute(
    `SELECT COALESCE(SUM(calories), 0) AS kcal,
            COALESCE(SUM(protein), 0)  AS protein,
            COALESCE(SUM(carbs), 0)    AS carbs,
            COALESCE(SUM(fat), 0)      AS fat
       FROM food_logs
      WHERE user_id = ? AND DATE(logged_at) = CURDATE()`,
    [userId]
  );
  const food = foodRows[0] || {};

  const [workRows] = await db.execute(
    `SELECT COUNT(*) AS sessions, COALESCE(SUM(duration_seconds), 0) AS secs
       FROM workout_logs
      WHERE user_id = ? AND DATE(start_time) = CURDATE() AND status <> 'cancelled'`,
    [userId]
  );
  const work = workRows[0] || {};

  // 7-day workout consistency — powers the projection engine.
  const [work7Rows] = await db.execute(
    `SELECT COUNT(DISTINCT DATE(start_time)) AS activeDays,
            COALESCE(SUM(duration_seconds), 0) AS totalSecs
       FROM workout_logs
      WHERE user_id = ? AND start_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        AND status <> 'cancelled'`,
    [userId]
  );
  const work7 = work7Rows[0] || {};

  const [sleepRows] = await db.execute(
    `SELECT sleep_duration, sleep_quality, water_intake_ml
       FROM sleep_logs
      WHERE user_id = ? AND (sleep_duration > 0 OR sleep_quality > 0 OR water_intake_ml > 0)
      ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );
  const sleep = sleepRows[0] || {};

  // Weight trend over 30 days — oldest → newest, for rate-of-change projection.
  const [weightRows] = await db.execute(
    `SELECT weight_kg, DATE(recorded_at) AS weighDate
       FROM bmi_records
      WHERE user_id = ? AND weight_kg > 0 AND recorded_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ORDER BY recorded_at ASC`,
    [userId]
  );
  const weightTrend = weightRows.map((r) => ({ weight: Number(r.weight_kg), date: r.weighDate }));

  const [bmiRows] = await db.execute(
    `SELECT weight_kg FROM bmi_records WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );
  const bmi = bmiRows[0] || {};

  // Today's check-in → readiness (Module 8). Pre-014 databases (no
  // daily_checkins table) degrade to "no readiness" instead of failing.
  let checkin = null;
  try {
    const [checkinRows] = await db.execute(
      `SELECT sleep_hours, sleep_quality, stress_level, soreness_level, energy_level
         FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE() LIMIT 1`,
      [userId]
    );
    checkin = checkinRows[0] || null;
  } catch (e) {
    if (e?.code !== 'ER_NO_SUCH_TABLE' && e?.errno !== 1054) {
      console.warn('[dailySummary] checkin query failed:', e?.message);
    }
  }
  const readinessData = calcReadiness({ checkin });

  return {
    kcalToday: Number(food.kcal) || 0,
    proteinToday: Number(food.protein) || 0,
    carbsToday: Number(food.carbs) || 0,
    fatToday: Number(food.fat) || 0,
    workoutSessionsToday: Number(work.sessions) || 0,
    workoutMinsToday: Math.round((Number(work.secs) || 0) / 60),
    workoutDaysLast7: Number(work7.activeDays) || 0,
    avgWorkoutMinsLast7: work7.activeDays > 0 ? Math.round((Number(work7.totalSecs) || 0) / 60 / work7.activeDays) : 0,
    sleepHours: sleep.sleep_duration != null ? Number(sleep.sleep_duration) : null,
    sleepQuality: sleep.sleep_quality != null ? Number(sleep.sleep_quality) : null,
    waterMl: sleep.water_intake_ml != null ? Number(sleep.water_intake_ml) : null,
    readiness: readinessData.readiness,
    readinessNote: readinessData.recommendation,
    currentWeightKg:
      bmi.weight_kg != null ? Number(bmi.weight_kg)
      : goal.weight_kg != null ? Number(goal.weight_kg)
      : null,
    targetWeightKg: goal.target_weight_kg != null ? Number(goal.target_weight_kg) : null,
    weightTrend,
  };
}

/** Deterministic headline from goal + today's numbers (no AI needed). */
function ruleHeadline(goal, metrics) {
  const kcalTarget = goal.daily_kcal != null ? Number(goal.daily_kcal) : null;
  const over = kcalTarget != null && metrics.kcalToday > kcalTarget * 1.05;
  const trained = metrics.workoutMinsToday > 0;
  switch (goal.goal_type) {
    case 'LOSE_WEIGHT':
      if (over) return 'Slightly over your deficit — balance the rest of today.';
      return trained ? 'Training plus a deficit — right on target.' : 'Keep the deficit and add some movement today.';
    case 'GAIN_WEIGHT':
      if (kcalTarget != null && metrics.kcalToday > 0 && metrics.kcalToday < kcalTarget) {
        return 'Eat a little more to hit your surplus.';
      }
      return 'Keep fueling and training for steady gains.';
    case 'BUILD_MUSCLE':
      return trained ? 'Solid session — now hit your protein.' : 'Lift today and keep protein high to build muscle.';
    case 'PERFORMANCE':
      return trained ? 'Nice work — fuel and recover to perform.' : 'Get a session in and keep recovery high.';
    default:
      return trained ? 'Balanced day — nice work.' : 'Stay consistent to maintain.';
  }
}

/** Deterministic 3–4 bullet summary built purely from data. */
function buildRuleSummary(profile, goal, metrics, firstName, nutrition, projection) {
  const bullets = [];
  const kcalTarget = goal.daily_kcal != null ? Number(goal.daily_kcal) : null;
  const proteinTarget = goal.protein_g != null ? Number(goal.protein_g) : null;

  if (kcalTarget) {
    const prot = proteinTarget
      ? ` · protein ${Math.round(metrics.proteinToday)}/${proteinTarget} g`
      : '';
    bullets.push(`Nutrition: ${Math.round(metrics.kcalToday).toLocaleString()} of ${kcalTarget.toLocaleString()} kcal today${prot}.`);
  } else {
    bullets.push('Nutrition: log meals to track against your goal.');
  }

  bullets.push(`Training: ${metrics.workoutMinsToday} min today — aim for ~${profile.workoutGoalMin} min.`);

  // Recovery + readiness in one bullet — readiness (Module 8) only shows when
  // today's check-in produced a score.
  const readinessTxt = metrics.readiness != null
    ? ` Readiness ${metrics.readiness}/100 (${metrics.readinessNote}).`
    : '';
  if (metrics.sleepHours != null) {
    bullets.push(`Recovery: ${metrics.sleepHours}h sleep.${readinessTxt} ${profile.recoveryEmphasis}`);
  } else if (readinessTxt) {
    bullets.push(`Recovery:${readinessTxt} ${profile.recoveryEmphasis}`);
  } else {
    bullets.push(`Recovery: ${profile.recoveryEmphasis}`);
  }

  if (projection?.available) {
    bullets.push(`Projection: ${projection.projectionNote}`);
  } else if (metrics.currentWeightKg != null && metrics.targetWeightKg != null) {
    bullets.push(`Progress: ${metrics.currentWeightKg} kg now → ${metrics.targetWeightKg} kg target.`);
  }

  return {
    headline: `${firstName ? firstName + ', ' : ''}${ruleHeadline(goal, metrics)}`,
    bullets: bullets.slice(0, 4),
    category: 'Daily Summary',
    nutrition: nutrition || null,
    projection: projection || null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   NUTRITION ENGINE — maps today's macro gaps to concrete food suggestions.
   Deterministic (no AI needed); adapts to goal type via the goal profile.
   ═══════════════════════════════════════════════════════════════════════════ */

// Per-goal food pools: [name, kcal, unit, protein_g, carbs_g, fat_g]
const FOOD_POOL = {
  protein: [
    ['Chicken breast', 165, '100 g', 31, 0, 3.6],
    ['Greek yogurt (0%)', 100, '170 g', 17, 6, 0.7],
    ['Eggs', 78, '1 large', 6, 0.6, 5],
    ['Canned tuna', 116, '100 g', 26, 0, 1],
    ['Cottage cheese', 98, '100 g', 11, 3.4, 4.3],
    ['Salmon fillet', 208, '100 g', 20, 0, 13],
    ['Lean ground turkey', 170, '100 g', 21, 0, 10],
    ['Whey protein scoop', 120, '1 scoop', 24, 3, 1.5],
  ],
  carb: [
    ['Oats', 150, '40 g dry', 5, 27, 3],
    ['Brown rice', 112, '100 g cooked', 2.6, 24, 0.9],
    ['Sweet potato', 86, '100 g', 1.6, 20, 0.1],
    ['Whole-wheat bread', 80, '1 slice', 4, 14, 1],
    ['Banana', 105, '1 medium', 1.3, 27, 0.4],
    ['Quinoa', 120, '100 g cooked', 4.4, 21, 1.9],
    ['Whole-wheat pasta', 130, '100 g cooked', 5, 25, 1.1],
  ],
  fat: [
    ['Avocado', 160, '½ fruit', 2, 9, 15],
    ['Mixed nuts', 170, '28 g', 6, 6, 15],
    ['Olive oil', 119, '1 tbsp', 0, 0, 14],
    ['Peanut butter', 94, '1 tbsp', 4, 3, 8],
    ['Cheese (cheddar)', 113, '28 g', 7, 0.4, 9],
    ['Dark chocolate (70%%)', 170, '28 g', 2, 13, 12],
  ],
};

/**
 * Build the nutrition section: how much is left today + 2–3 food picks
 * that close the biggest remaining macro gap.
 */
function buildNutritionSection(goal, metrics) {
  const kcalTarget = goal.daily_kcal != null ? Number(goal.daily_kcal) : null;
  const proteinTarget = goal.protein_g != null ? Number(goal.protein_g) : null;
  const carbTarget = goal.carbs_g != null ? Number(goal.carbs_g) : null;
  const fatTarget = goal.fat_g != null ? Number(goal.fat_g) : null;

  const gaps = {
    kcal: kcalTarget != null ? Math.max(0, kcalTarget - metrics.kcalToday) : null,
    protein: proteinTarget != null ? Math.max(0, proteinTarget - metrics.proteinToday) : null,
    carbs: carbTarget != null ? Math.max(0, carbTarget - metrics.carbsToday) : null,
    fat: fatTarget != null ? Math.max(0, fatTarget - metrics.fatToday) : null,
  };

  // Nothing logged yet → encourage first meal rather than list gaps.
  if (metrics.kcalToday === 0 && kcalTarget != null) {
    return {
      gaps,
      suggestions: FOOD_POOL.protein.slice(0, 2).map(([name, kcal, unit, p]) => ({ name, kcal, unit, protein: p })),
      note: 'Nothing logged yet — start with a high-protein meal to set the tone.',
    };
  }

  // Rank macro gaps by relative severity, pick the worst one to target.
  const ranked = [];
  if (gaps.protein != null && proteinTarget > 0) ranked.push({ macro: 'protein', gap: gaps.protein, pct: gaps.protein / proteinTarget });
  if (gaps.carbs != null && carbTarget > 0) ranked.push({ macro: 'carb', gap: gaps.carbs, pct: gaps.carbs / carbTarget });
  if (gaps.fat != null && fatTarget > 0) ranked.push({ macro: 'fat', gap: gaps.fat, pct: gaps.fat / fatTarget });
  ranked.sort((a, b) => b.pct - a.pct);

  const suggestions = [];
  const used = new Set();
  for (const entry of ranked) {
    const pool = FOOD_POOL[entry.macro] || [];
    // Pick 2 items from the worst-gap pool that haven't been used yet.
    for (const [name, kcal, unit, p, c, f] of pool) {
      if (used.has(name) || suggestions.length >= 3) continue;
      used.add(name);
      suggestions.push({ name, kcal, unit, protein: p, carbs: c, fat: f, closes: entry.macro });
    }
    if (suggestions.length >= 3) break;
  }

  // Goal-aware note.
  const note = goal.goal_type === 'LOSE_WEIGHT'
    ? `You have ${gaps.kcal != null ? Math.round(gaps.kcal) : '—'} kcal left — prioritize protein to stay full.`
    : goal.goal_type === 'BUILD_MUSCLE' || goal.goal_type === 'GAIN_WEIGHT'
    ? `A ${Math.round(gaps.kcal || 0)} kcal gap remains — eat now to support growth.`
    : gaps.kcal != null && gaps.kcal > 0
    ? `${Math.round(gaps.kcal)} kcal remaining — spread it across whole foods.`
    : 'Targets met — focus on hydration and whole foods.';

  return { gaps, suggestions: suggestions.slice(0, 3), note };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECTION ENGINE — estimates time-to-target from weight trend + habits.
   Pure math; adapts to the user's actual logged data.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Time-to-target projection. Needs the goal PROFILE (goalProfile registry) for
 * kcalDelta + workoutGoalMin — the DB fitness_goals row carries neither, so a
 * profile-less call silently degrades to the maintain-rate fallback.
 */
function buildProjection(goal, metrics, profile = null) {
  const { currentWeightKg, targetWeightKg, weightTrend, workoutDaysLast7, avgWorkoutMinsLast7 } = metrics;
  if (currentWeightKg == null || targetWeightKg == null) {
    return { available: false, note: 'Log your weight and set a target to unlock projections.' };
  }

  const weightDiffKg = targetWeightKg - currentWeightKg; // + = need to gain, − = need to lose

  // Estimate weekly rate of change from real weight history (≥ 2 weigh-ins ≥ 5 days apart).
  let weeklyRateKg = null;
  if (Array.isArray(weightTrend) && weightTrend.length >= 2) {
    const first = weightTrend[0];
    const last = weightTrend[weightTrend.length - 1];
    const days = (new Date(last.date) - new Date(first.date)) / 86_400_000;
    if (days >= 5) {
      weeklyRateKg = ((last.weight - first.weight) / days) * 7;
    }
  }

  // Fallback: goal-aware default rate when there isn't enough history.
  const kcalDelta = profile?.kcalDelta ?? goal.kcalDelta ?? null;
  const hasRealRate = weeklyRateKg != null && Math.abs(weeklyRateKg) >= 0.05;
  if (!hasRealRate) {
    weeklyRateKg = kcalDelta != null && kcalDelta < 0 ? -0.5
      : kcalDelta != null && kcalDelta > 0 ? 0.25
      : 0.1;
  }

  const weeksToTarget = Math.abs(weightDiffKg) < 0.5
    ? 0
    : Math.ceil(Math.abs(weightDiffKg / weeklyRateKg));

  // Consistency check — does the user's habit support the projected rate?
  // Target minutes come from the goal profile (60 for BUILD_MUSCLE/
  // PERFORMANCE, 45 for LOSE/GAIN, 30 for MAINTAIN) — not the generic 30.
  const goalMin = profile?.workoutGoalMin ?? goal.workoutGoalMin ?? 30;
  const avgMins = avgWorkoutMinsLast7 || 0;
  const consistencyScore = avgMins >= goalMin ? 'strong' : avgMins >= goalMin * 0.5 ? 'moderate' : 'low';

  const direction = weightDiffKg > 0 ? 'gain' : 'lose';
  const rateLabel = hasRealRate ? 'your recent pace' : 'a typical healthy pace';

  const projectionNote = weeksToTarget === 0
    ? `You're within 0.5 kg of your target — focus on maintaining.`
    : `At ${rateLabel}, you could reach ${targetWeightKg} kg in ~${weeksToTarget} week${weeksToTarget === 1 ? '' : 's'}.`;

  const consistencyNote = consistencyScore === 'strong'
    ? `Your ${workoutDaysLast7}-day workout streak (${avgMins} min avg) supports this pace.`
    : consistencyScore === 'moderate'
    ? `Averaging ${avgMins} min/day — hitting ${goalMin} min would accelerate progress.`
    : `More frequent training (target ${goalMin} min) would help you ${direction} weight faster.`;

  return {
    available: true,
    weeksToTarget,
    monthsToTarget: weeksToTarget > 0 ? Math.ceil(weeksToTarget / 4) : 0,
    weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
    weeklyRateIsReal: hasRealRate,
    weightDiffKg: Math.round(Math.abs(weightDiffKg) * 10) / 10,
    direction,
    consistencyScore,
    projectionNote,
    consistencyNote,
  };
}

/** Optional Gemini enrichment. Returns null on any failure so callers fall back. */
async function aiSummary(firstName, goal, profile, metrics, nutrition, projection) {
  const kcalTarget = goal.daily_kcal != null ? Number(goal.daily_kcal) : null;
  const proteinTarget = goal.protein_g != null ? Number(goal.protein_g) : null;
  const nutSection = nutrition
    ? `Remaining today: ${nutrition.gaps?.kcal ?? '—'} kcal, ${nutrition.gaps?.protein ?? '—'}g protein, ${nutrition.gaps?.carbs ?? '—'}g carbs, ${nutrition.gaps?.fat ?? '—'}g fat.`
    : '';
  const projSection = projection?.available
    ? `Weight trajectory: ${metrics.currentWeightKg} kg → ${metrics.targetWeightKg} kg target. Recent rate: ${projection.weeklyRateKg} kg/week. Workout consistency (7d): ${metrics.workoutDaysLast7} days, ${metrics.avgWorkoutMinsLast7} min avg.`
    : '';
  const prompt = `
                    You are Vitalis AI Coach. Write a SHORT, specific daily summary for ${firstName || 'the athlete'}.
                    Goal: ${profile.label} — ${profile.aiDirective}
                    Today's data:
                    - Calories: ${Math.round(metrics.kcalToday)}${kcalTarget ? ` of ${kcalTarget}` : ''} kcal
                    - Protein: ${Math.round(metrics.proteinToday)}${proteinTarget ? ` of ${proteinTarget}` : ''} g
                    - Workout: ${metrics.workoutMinsToday} min (target ~${profile.workoutGoalMin} min)
                    - Sleep: ${metrics.sleepHours != null ? metrics.sleepHours : 'no data'} h${metrics.sleepQuality ? `, quality ${metrics.sleepQuality}/10` : ''}
                    - Readiness: ${metrics.readiness != null ? `${metrics.readiness}/100 (${metrics.readinessNote})` : 'no check-in today'}
                    - Weight: ${metrics.currentWeightKg != null ? metrics.currentWeightKg : 'unknown'} kg${metrics.targetWeightKg != null ? ` (target ${metrics.targetWeightKg} kg)` : ''}
                    ${nutSection}
                    ${projSection}

                    Rules:
                    1. Reference exact numbers. Be supportive and actionable.
                    2. Exactly 3 bullets, each <= 90 characters.
                    3. Give general fitness info only — never diagnose, treat or prescribe.
                    4. Do NOT open with "Great job" or "Keep it up".
                    5. In one bullet, mention a specific food or meal idea that closes today's biggest macro gap.
                    6. In one bullet, reference the weight trajectory or a projection ("on pace for…").
                    7. If readiness is below 50, never suggest pushing hard today — steer toward recovery or a lighter session instead.

                    RESPONSE FORMAT (strict JSON only, no markdown):
                    {"headline":"...","bullets":["...","...","..."],"category":"Daily Summary"}`.trim();

  const raw = await callGeminiWithFallback(prompt);
  const { parsed } = safeParseAI(raw);
  if (parsed?.headline && Array.isArray(parsed.bullets)) {
    return {
      headline: String(parsed.headline).slice(0, 200),
      bullets: parsed.bullets.slice(0, 3).map((b) => String(b).slice(0, 160)),
      category: parsed.category ? String(parsed.category).slice(0, 60) : 'Daily Summary',
      nutrition: nutrition || null,
      projection: projection || null,
    };
  }
  return null;
}

async function dailySummary(userId) {
  const goal = await getActiveGoalForSummary(userId);
  if (!goal) {
    // No active goal → callers render the "finish onboarding" nudge instead.
    return { goal: null, profile: null, metrics: null, summary: null, source: 'none' };
  }

  const profile = getGoalProfile(goal.goal_type) || DEFAULT_GOAL_PROFILE;
  const metrics = await getSummaryMetrics(userId, goal);

  const signature = JSON.stringify({
    g: goal.goal_type,
    k: Math.round(metrics.kcalToday),
    p: Math.round(metrics.proteinToday),
    w: metrics.workoutMinsToday,
    s: metrics.sleepHours,
    r: metrics.readiness, // readiness-aware summary must not serve a stale cache
    cw: metrics.currentWeightKg,
  });
  const cacheKey = `${userId}:${signature}`;
  const cached = summaryCacheGet(cacheKey);
  if (cached) return cached;

  let firstName = '';
  try {
    const [[u]] = await db.execute('SELECT name FROM users WHERE id = ? LIMIT 1', [userId]);
    firstName = u?.name ? String(u.name).split(' ')[0] : '';
  } catch { /* name is optional */ }

  const nutrition = buildNutritionSection(goal, metrics);
  const projection = buildProjection(goal, metrics, profile);

  let summary = buildRuleSummary(profile, goal, metrics, firstName, nutrition, projection);
  let source = 'rule';

  if (typeof aiConfigured === 'function' && aiConfigured()) {
    try {
      const ai = await aiSummary(firstName, goal, profile, metrics, nutrition, projection);
      if (ai) {
        summary = ai;
        source = 'ai';
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[dailySummary] AI failed, using rule summary:', e?.message);
    }
  }

  const result = {
    goal: {
      goalType: goal.goal_type,
      dailyKcal: goal.daily_kcal != null ? Number(goal.daily_kcal) : null,
      proteinG: goal.protein_g != null ? Number(goal.protein_g) : null,
      carbsG: goal.carbs_g != null ? Number(goal.carbs_g) : null,
      fatG: goal.fat_g != null ? Number(goal.fat_g) : null,
      targetWeightKg: metrics.targetWeightKg,
      weightKg: goal.weight_kg != null ? Number(goal.weight_kg) : null,
    },
    profile: {
      key: profile.key,
      label: profile.label,
      icon: profile.icon,
      planTag: profile.planTag,
      focus: profile.focus,
      workoutGoalMin: profile.workoutGoalMin,
      trainingEmphasis: profile.trainingEmphasis,
      nutritionNote: profile.nutritionNote,
      recoveryEmphasis: profile.recoveryEmphasis,
    },
    metrics,
    summary,
    source,
  };

  summaryCacheSet(cacheKey, result);
  return result;
}

module.exports = {
  analyzePose,
  fitnessAnalysis,
  // Backward-compatible alias — older callers/tests still import clinicalAnalysis
  clinicalAnalysis: fitnessAnalysis,
  coachTip,
  getHistory,
  getLatestLogs,
  runAnalysis,
  dailySummary,
};
