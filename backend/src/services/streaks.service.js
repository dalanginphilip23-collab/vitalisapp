// Streak — engagement streak: a day counts when the user did ANY of
// (workout logged · meal logged · recovery check-in). Computed fresh from
// day keys, so there is no stored counter to drift out of sync — mirrors the
// week-calendar day-bucketing and the grace rule every existing client
// walkback uses ("a streak ending yesterday still shows").
const db = require("../config/db");
const { clientDateFromQuery } = require("../utils/clientDate");

// Ten years of history keeps a genuinely long streak from being capped, while
// the UI only renders the most recent 90 days. One window, no extra query.
const LOOKBACK_DAYS = 3650;
const HISTORY_DAYS = 90;

const shiftDay = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};

// Monday = 0 … Sunday = 6, matching the dashboard week card.
const weekdayIndex = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

// Day-key query helper. Each source degrades to an empty set on old schemas
// so a missing migration never takes the dashboard down (same policy as
// getDashboard's daily_checkins guard).
async function dayKeys(userId, sql, params) {
  try {
    const [rows] = await db.execute(sql, params);
    return new Set(rows.map((r) => r.d));
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_BAD_FIELD_ERROR") return new Set();
    throw err;
  }
}

// Computed on every dashboard request: one DB-clock read plus three indexed
// DISTINCT day queries is cheaper than a cache that can briefly disagree with
// a just-committed log.
async function getStreakSummary(userId, clientToday) {
  // "Today" follows the browser's local date when it says so (?today=…),
  // falling back to DB-local CURDATE (the same day boundary daily_stats and
  // readiness use) so old clients keep working. Without the client date the
  // server's timezone can disagree with the user's by a day around local
  // midnight — which lit the wrong tile in the streak week strip.
  const [[todayRow]] = await db.execute(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`,
  );
  const today = clientDateFromQuery({ today: clientToday }) || todayRow.today;

  const [workoutSet, mealSet, checkinSet] = await Promise.all([
    dayKeys(
      userId,
      `SELECT DISTINCT DATE_FORMAT(start_time, '%Y-%m-%d') AS d
       FROM workout_logs
       WHERE user_id = ? AND status <> 'cancelled'
         AND start_time >= DATE_SUB(CURDATE(), INTERVAL ${LOOKBACK_DAYS} DAY)`,
      [userId],
    ),
    dayKeys(
      userId,
      `SELECT DISTINCT DATE_FORMAT(logged_at, '%Y-%m-%d') AS d
       FROM food_logs
       WHERE user_id = ? AND logged_at >= DATE_SUB(CURDATE(), INTERVAL ${LOOKBACK_DAYS} DAY)`,
      [userId],
    ),
    dayKeys(
      userId,
      `SELECT DISTINCT DATE_FORMAT(checkin_date, '%Y-%m-%d') AS d
       FROM daily_checkins
       WHERE user_id = ? AND checkin_date >= DATE_SUB(CURDATE(), INTERVAL ${LOOKBACK_DAYS} DAY)`,
      [userId],
    ),
  ]);

  const union = new Set([...workoutSet, ...mealSet, ...checkinSet]);
  const sourcesFor = (date) => {
    const sources = [];
    if (workoutSet.has(date)) sources.push("workout");
    if (mealSet.has(date)) sources.push("meal");
    if (checkinSet.has(date)) sources.push("checkin");
    return sources;
  };

  // Current streak: consecutive union days ending today; if today has no
  // engagement yet, the streak that ended yesterday still counts (so a
  // morning visit shows yesterday's run, not 0).
  let anchor = today;
  if (!union.has(anchor)) anchor = shiftDay(today, -1);
  let current = 0;
  let cursor = anchor;
  while (union.has(cursor) && current < LOOKBACK_DAYS) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }

  // Longest within the window (sorted ISO strings → a single linear scan).
  const sorted = [...union].filter((d) => d <= today).sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // Current week (Mon–Sun) for the streak strip. Future days are flagged and
  // never marked active, even if a stray future-dated row exists.
  const monday = shiftDay(today, -weekdayIndex(today));
  const week = [];
  for (let i = 0; i < 7; i += 1) {
    const date = shiftDay(monday, i);
    const isFuture = date > today;
    const sources = isFuture ? [] : sourcesFor(date);
    week.push({
      date,
      active: sources.length > 0,
      isToday: date === today,
      isFuture,
      sources,
    });
  }

  // Secondary 90-day consistency grid (today last, oldest first).
  const historyStart = shiftDay(today, -(HISTORY_DAYS - 1));
  const history = [];
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    const date = shiftDay(historyStart, i);
    const sources = sourcesFor(date);
    history.push({
      date,
      active: sources.length > 0,
      count: sources.length,
      sources,
    });
  }

  const todaySources = sourcesFor(today);
  const value = {
    current,
    longest,
    activeToday: todaySources.length > 0,
    lastActiveDate: sorted.length ? sorted[sorted.length - 1] : null,
    workoutDays: workoutSet.size,
    mealDays: mealSet.size,
    checkinDays: checkinSet.size,
    today,
    todaySources,
    weekStart: monday,
    weekEnd: shiftDay(monday, 6),
    week,
    history,
  };
  return value;
}

module.exports = { getStreakSummary, LOOKBACK_DAYS, HISTORY_DAYS };
