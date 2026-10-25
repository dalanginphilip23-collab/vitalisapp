// Training insights + adaptive suggestions — Module 5.
//
// RULES-BASED, NOT AI: deterministic rules over the user's own workout data.
// Design constraints (from the manuscript):
//   - The system NEVER auto-increases intensity. Upward suggestions require the
//     user to click Apply (POST /api/plans/adjust-from-goal).
//   - Downward / recovery-facing suggestions respect real capacity: low
//     completion, high difficulty self-reports, skipped sessions.
const db = require('../config/db');
const { AppError } = require('../utils/errors');
const { calcReadiness } = require('../utils/readiness');

const LOOKBACK_DAYS = 28;

// Small load-balancing delay removed by design; all queries run sequentially
// on one pooled connection (they're cheap — indexed on user_id + start_time).

async function collectStats(userId) {
  // Today's check-in (Module 8) — feeds readiness-aware tips. Pre-014
  // databases (no daily_checkins) degrade to null instead of failing —
  // `.catch` keeps the Promise.all from unravelling on the missing table.
  const checkinQuery = db
    .execute(
      `SELECT sleep_hours, sleep_quality, stress_level, soreness_level, energy_level
         FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE() LIMIT 1`,
      [userId]
    )
    .catch((e) => {
      if (e?.code !== 'ER_NO_SUCH_TABLE' && e?.errno !== 1054) console.warn('[insights] checkin query failed:', e?.message);
      return [[{ skip: true }]];
    });
  const [[statusRows], [durationRows], [ratingRows], [vol14], [volPrev14], [dayRows], [weeklyMins], [weekBucketRows], [checkinRows]] = await Promise.all([
    db.execute(
      `SELECT status, COUNT(*) AS n FROM workout_logs
        WHERE user_id = ? AND start_time >= NOW() - INTERVAL ? DAY
        GROUP BY status`,
      [userId, LOOKBACK_DAYS]
    ),
    db.execute(
      `SELECT AVG(duration_seconds) AS avg_secs FROM workout_logs
        WHERE user_id = ? AND status = 'completed'
          AND start_time >= NOW() - INTERVAL 7 DAY`,
      [userId]
    ),
    db.execute(
      `SELECT difficulty_rating, start_time FROM workout_logs
        WHERE user_id = ? AND status = 'completed' AND difficulty_rating IS NOT NULL
        ORDER BY start_time DESC LIMIT 3`,
      [userId]
    ),
    db.execute(
      `SELECT ROUND(SUM(ws.weight_kg * ws.reps)) AS vol FROM workout_sets ws
         JOIN workout_logs wl ON ws.workout_log_id = wl.id
        WHERE wl.user_id = ? AND ws.reps IS NOT NULL
          AND wl.start_time >= NOW() - INTERVAL 14 DAY`,
      [userId]
    ),
    db.execute(
      `SELECT ROUND(SUM(ws.weight_kg * ws.reps)) AS vol FROM workout_sets ws
         JOIN workout_logs wl ON ws.workout_log_id = wl.id
        WHERE wl.user_id = ? AND ws.reps IS NOT NULL
          AND wl.start_time <  NOW() - INTERVAL 14 DAY
          AND wl.start_time >= NOW() - INTERVAL 28 DAY`,
      [userId]
    ),
    db.execute(
      `SELECT DISTINCT DATE(start_time) AS d FROM workout_logs
        WHERE user_id = ? AND start_time >= NOW() - INTERVAL 14 DAY
        ORDER BY d DESC LIMIT 10`,
      [userId]
    ),
    db.execute(
      `SELECT COALESCE(SUM(
          GREATEST(0, ROUND(
            ( COALESCE(duration_seconds, TIMESTAMPDIFF(SECOND, start_time, end_time))
              - COALESCE(paused_seconds, 0)
            ) / 60
          ))
        ), 0) AS secs FROM workout_logs
        WHERE user_id = ? AND status = 'completed'
          AND start_time >= NOW() - INTERVAL 7 DAY`,
      [userId]
    ),
    // Module 6 — ISO-week active-minute buckets (8 weeks). Paused time is
    // excluded so the trend reflects real exercise time, not wall clock.
    db.query(
      `SELECT YEARWEEK(start_time, 3) AS yw,
              COALESCE(SUM(GREATEST(0, ROUND(
                ( COALESCE(duration_seconds, TIMESTAMPDIFF(SECOND, start_time, end_time))
                  - COALESCE(paused_seconds, 0)
                ) / 60
              ))), 0) AS mins
       FROM workout_logs
       WHERE user_id = ? AND status = 'completed'
         AND start_time >= NOW() - INTERVAL 56 DAY
       GROUP BY yw ORDER BY yw DESC LIMIT 8`,
      [userId]
    ),
    checkinQuery,
  ]);

  const status = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)]));
  const completed = status.completed ?? 0;
  const cancelled = status.cancelled ?? 0;
  const active = status.active ?? 0;
  const paused = status.paused ?? 0;
  const totalSessions = Object.values(status).reduce((a, b) => a + b, 0);

  const avgMinutes7d = durationRows.avg_secs != null ? Math.round(Number(durationRows.avg_secs) / 60) : null;

  const recentRatings = ratingRows.map((r) => Number(r.difficulty_rating));
  const avgRating = recentRatings.length
    ? Math.round(recentRatings.reduce((a, b) => a + b, 0) * 100 / recentRatings.length) / 100
    : null;

  const volLast = Number(vol14.vol ?? 0);
  const volPrev = Number(volPrev14.vol ?? 0);

  // Consecutive-day streak (completed or in-progress days count as showing
  // up; cancelled doesn't). A streak ending yesterday still counts — today's
  // session simply hasn't happened yet.
  const dayList = dayRows.filter((r) => r.d != null).map((r) => new Date(r.d));
  let streak = 0;
  if (dayList.length > 0) {
    const DAY = 24 * 60 * 60 * 1000;
    const todayMid = new Date(new Date().toLocaleDateString('en-CA'));
    let anchor = todayMid.getTime();
    if (Math.abs(dayList[0].getTime() - anchor) > DAY / 2) anchor -= DAY; // yesterday-first
    for (let i = 0; i < dayList.length; i += 1) {
      const expected = anchor - i * DAY;
      const d = dayList[i].getTime();
      if (Math.abs(d - expected) <= DAY / 2) streak += 1;
      else break;
    }
  }

  const minutesThisWeek = Math.round(Number(weeklyMins.secs ?? 0) / 60);

  // Module 6 — weekly active-minute trend from real buckets. Mean of the
  // latest 2 weeks vs the 2 before that (%). Paused time excluded upstream.
  const weekMins = (weekBucketRows || []).map((r) => Number(r.mins || 0)); // newest first
  const recent2 = weekMins.slice(0, 2);
  const prior2 = weekMins.slice(2, 4);
  const weeklyMinsRecent = recent2.length ? Math.round(recent2.reduce((a, b) => a + b, 0) / recent2.length) : 0;
  const weeklyMinsPrior = prior2.length ? Math.round(prior2.reduce((a, b) => a + b, 0) / prior2.length) : 0;
  let weeklyMinsChangePct = null;
  if (weeklyMinsPrior >= 30 && weeklyMinsRecent > 0) {
    weeklyMinsChangePct = Math.round(((weeklyMinsRecent - weeklyMinsPrior) / weeklyMinsPrior) * 100);
  } else if (weeklyMinsPrior >= 30 && weeklyMinsRecent === 0) {
    weeklyMinsChangePct = -100;
  }

  const completionRate = totalSessions > 0
    ? Math.round(((completed + paused + active) / totalSessions) * 100)
    : null;

  // Readiness (Module 8) — check-in only. Activity fallbacks would rate
  // lazy-but-healthy days as low readiness and nag falsely, so no check-in
  // means no readiness signal at all.
  const checkin = (checkinRows?.[0] && !checkinRows[0].skip) ? checkinRows[0] : null;
  const readinessData = checkin ? calcReadiness({ checkin }) : null;

  return { lookbackDays: LOOKBACK_DAYS, completed, cancelled, active, paused, totalSessions, completionRate, avgMinutes7d, avgRating, recentRatings, volumeLast14: volLast, volumePrev14: volPrev, streak, minutesThisWeek, weeklyMinsRecent, weeklyMinsPrior, weeklyMinsChangePct, readiness: readinessData?.readiness ?? null, readinessNote: readinessData?.recommendation ?? null };
}

/**
 * Pure rule engine (exported for unit tests). Input is the stats object
 * from collectStats; output is an ordered tips list, most relevant first.
 * action = 'shorter' | 'gentle' | null (null = informational only).
 */
function buildTips(stats) {
  const { completed, cancelled, totalSessions, completionRate, avgRating, recentRatings, volumeLast14, volumePrev14, streak, minutesThisWeek, weeklyMinsRecent, weeklyMinsPrior, weeklyMinsChangePct } = stats;
  const tips = [];

  // 0) Readiness guard (Module 8) — today's check-in says the body is
  //    degraded. Shown before everything else: the first recommendation is
  //    rest or a shorter day, never a push. Upward steps via 'gentle' are
  //    suppressed while readiness is low (also enforced by rule 4's
  //    easy-rating requirement — a degraded day won't rate Easy).
  if (stats.readiness != null && stats.readiness < 50) {
    tips.push({
      type: 'low_readiness',
      action: 'shorter',
      title: 'Low readiness today',
      message: `Readiness ${stats.readiness}/100 — ${stats.readinessNote || 'recovery signals are degraded'}. Take a full rest day, or apply the shorter-session adaptation instead of a full push.`,
    });
  }

  const ratedRecent = recentRatings.length >= 2;
  const hardStreak = ratedRecent && recentRatings.slice(0, 3).every((r) => r >= 4);
  const easyStreak = ratedRecent && recentRatings.slice(0, 3).every((r) => r <= 2);

  // 1) Struggling — high difficulty / falling volume, capped load.
  if (hardStreak) {
    tips.push({
      type: 'no_progression',
      action: null,
      title: 'Keep intensity steady',
      message:
        'Your last sessions were rated Challenging or Very hard. Do not increase reps or weight yet — repeat the same work for the next week and let your body recover.',
    });
    tips.push({
      type: 'recovery',
      action: 'shorter',
      title: 'Consider shorter sessions',
      message:
        'Hard sessions back-to-back can overreach. Fit your plan days to 20–30 minutes and prioritise sleep and a rest day between sessions.',
    });
  }

  // 2) Frequent cancellations / low completion → sessions too long or too heavy.
  if (totalSessions >= 2 && (cancelled / totalSessions) >= 0.4) {
    tips.push({
      type: 'suggest_shorter',
      action: 'shorter',
      title: 'Sessions may be too long',
      message:
        `${cancelled} of ${totalSessions} recent sessions were skipped. Shorter sessions are easier to keep — this adapts your plan to 20–30 minute days.`,
    });
  } else if (completionRate !== null && completed >= 2 && completionRate < 50 && cancelled >= 1) {
    tips.push({
      type: 'suggest_shorter',
      action: 'shorter',
      title: 'Low completion rate',
      message:
        `You're completing ${completionRate}% of sessions. Try fitting days to your available time instead of pushing a full session.`,
    });
  }

  // 3) Overuse — many days without rest.
  if (streak >= 5 && minutesThisWeek >= 150) {
    tips.push({
      type: 'recovery',
      action: null,
      title: 'Schedule a rest day',
      message:
        `${streak} training days in a row this week. Recovery is where adaptation happens — take at least one full rest day.`,
    });
  }

  // 4) Consistently "too easy" AND strong adherence → user may grow. Still
  //    explicit, one-click, never automatic.
  if (easyStreak && (completionRate === null || completionRate >= 70)) {
    tips.push({
      type: 'suggest_gentle',
      action: 'gentle',
      title: 'Ready for a small step up (optional)',
      message:
        'You rated your last sessions Easy or Too easy with strong completion. If you feel ready, this adds one set per exercise and slightly longer holds — apply only when you want it.',
    });
  }

  // 5) Volume trend info (informational, no action).
  if (volumeLast14 > 0 && volumePrev14 > 0) {
    const pct = Math.round(((volumeLast14 - volumePrev14) / volumePrev14) * 100);
    if (Math.abs(pct) >= 15) {
      tips.push({
        type: 'info',
        action: null,
        title: pct > 0 ? 'Volume trending up' : 'Volume trending down',
        message:
          `Training weight volume ${pct > 0 ? 'increased' : 'decreased'} ~${Math.abs(pct)}% versus the previous two weeks (${
            volumeLast14.toLocaleString() } vs ${volumePrev14.toLocaleString()} kg·reps). ${
            pct < 0 ? 'Keep sessions consistent and let scheduling — not load jumps — do the work.' : 'Nice progression without a jump in set counts.'}`,
      });
    }
  }

  // 5b) Module 6 — ACTIVITY trend from real active minutes (paused time not
  //     counted). A drop ≥50% suggests capacity/friction issues → gentle
  //     shorter-days restart, one click, never automatic. A rise ≥20% is pure
  //     reinforcement. Never auto-increases on a rise.
  if (weeklyMinsChangePct != null && weeklyMinsChangePct <= -50) {
    tips.push({
      type: 'activity_drop',
      action: 'shorter',
      title: 'Activity dipped',
      message:
        `Active training time averaged ~${weeklyMinsRecent} min/week versus ~${weeklyMinsPrior} the two weeks before (−${Math.abs(weeklyMinsChangePct)}%). If schedule friction is the cause, shorter 20–30 minute days are the easiest way back.`,
    });
  } else if (weeklyMinsChangePct != null && weeklyMinsChangePct >= 20) {
    tips.push({
      type: 'info',
      action: null,
      title: 'Activity climbing',
      message:
        `Active training time is up ~${weeklyMinsChangePct}% week-over-week (≈${weeklyMinsRecent} min/week). Consistency like this compounds — keep the same cadence.`,
    });
  }

  // 6) Positive reinforcement when steady and completed.
  if (tips.length === 0 && completed >= 1) {
    tips.push({
      type: 'info',
      action: null,
      title: 'Plan is on track',
      message:
        `No adjustments suggested — ${completed} completed session${completed !== 1 ? 's' : ''} logged. Keep showing up and rate your sessions so recommendations can sharpen.`,
    });
  }

  return tips;
}

/** GET service: stats + tips for the authed user. */
async function getInsights(userId) {
  const stats = await collectStats(userId);
  return { stats, tips: buildTips(stats) };
}

// planAdjust lives in plans.service (POST /api/plans/adjust-from-goal) — kept
// there because it writes plan tables and reuses their ownership checks.
function assertMode(mode) {
  if (!['shorter', 'gentle'].includes(mode)) {
    throw new AppError("mode must be 'shorter' or 'gentle'", 400, 'INVALID_ADJUST_MODE');
  }
}

module.exports = { LOOKBACK_DAYS, buildTips, collectStats, getInsights, assertMode };
