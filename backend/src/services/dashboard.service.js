// Dashboard — business logic + DB access.
const db = require('../config/db');
const { AppError } = require('../utils/errors');
const { calcReadiness } = require('../utils/readiness');
const { getStreakSummary } = require('./streaks.service');

async function getDashboard(userId) {
  // Independent selects run concurrently — ~3x faster than sequential awaits.
  const [statsRes, userRes, sleepRes, waterRes, streakRes] = await Promise.all([
    db.execute(
      `SELECT calories_burned, steps, workout_duration_mins
       FROM daily_stats 
       WHERE user_id = ? AND stat_date = CURDATE()`,
      [userId]
    ),
    db.execute(
      `SELECT u.name, u.fitness_goal, COALESCE(p.avatar_url, u.avatar_url) AS avatar_url
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = ?`,
      [userId]
    ),
    db.execute(
      `SELECT DATE_FORMAT(recorded_at, '%H:%i') AS label, AVG(sleep_duration) AS value
       FROM sleep_logs
       WHERE user_id = ? AND recorded_at >= CURDATE() AND recorded_at < CURDATE() + INTERVAL 1 DAY
       GROUP BY label ORDER BY label ASC LIMIT 20`,
      [userId]
    ),
    db.execute(
      `SELECT COALESCE(SUM(water_intake_ml),0) AS water_ml, COALESCE(SUM(sleep_duration),0) AS sleep_h
       FROM sleep_logs WHERE user_id = ? AND recorded_at >= CURDATE() AND recorded_at < CURDATE() + INTERVAL 1 DAY`,
      [userId]
    ),
    // Engagement streak (workouts ∪ meals ∪ check-ins) rides the dashboard
    // payload — the Dashboard hook already fetches this endpoint, so the
    // streak section costs zero extra round-trips. Never fails the dashboard.
    getStreakSummary(userId).catch(() => null),
  ]);
  const [stats] = statsRes;
  const [user] = userRes;
  const [sleepData] = sleepRes;
  const [[waterRow]] = waterRes;

  // Readiness v2 (utils/readiness): check-in driven when present,
  // activity fallback otherwise, null when no data at all.
  // Degrades gracefully on pre-014 databases (no daily_checkins table).
  let checkins = [];
  try {
    [checkins] = await db.execute(
        `SELECT sleep_hours, sleep_quality, stress_level, soreness_level, soreness_level AS soreness, energy_level
         FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE() LIMIT 1`,
        [userId]
    );
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE' && err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    console.warn('[dashboard] daily_checkins schema mismatch — run db:migrate (014/016)');
  }
  const s = stats[0] || { calories_burned: 0, steps: 0, workout_duration_mins: 0 };
  const r = calcReadiness({
    checkin: checkins[0] || null,
    sleepCount: (sleepData || []).length,
    steps: s.steps || 0,
    calories: s.calories_burned || 0,
  });

  return {
    stats:    { ...s, water_intake_ml: Number(waterRow?.water_ml || 0),
                sleep_duration: Number(waterRow?.sleep_h || 0),
                readiness: r.readiness, readinessSource: r.source,
                readinessNote: r.recommendation },
    profile:  user[0]   || { name: "Guest" },
    checkin:  checkins[0] || null,
    sleep_trend: sleepData || [],
    streak:   streakRes || null, // { current, longest, activeToday, ... } | null
    hrv_data: sleepData || [] // deprecated alias, use sleep_trend
  };
}

async function searchUsers(q) {
  const escaped = String(q).replace(/[\\%_]/g, (c) => `\\${c}`);
  const [results] = await db.execute(
    "SELECT u.name, COALESCE(p.avatar_url, u.avatar_url) AS avatar_url FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.name LIKE ? ESCAPE '\\\\' LIMIT 5",
    [`%${escaped}%`]
  );
  return results;
}

module.exports = { getDashboard, searchUsers };

// ─── Week calendar (Module 7.5-ish dashboard addition) ────────────────
// The dashboard week card: Monday–Sunday of the CURRENT week, each day with
// lightweight markers (workout/meals/check-in) + totals. Future days are
// flagged so the UI can disable them; the day sheet fetches full detail below.

// String-based day math — avoids Date/timezone drift entirely (dates are
// YYYY-MM-DD throughout the API).
function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

async function getWeekCalendar(userId) {
  const [[wk]] = await db.execute(
    `SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), '%Y-%m-%d') AS monday,
            DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`,
  );
  const monday = wk.monday;
  const sunday = addDaysISO(monday, 7);

  const [workoutsRes, mealsRes, checkinsRes, statsRes] = await Promise.all([
    db.execute(
      `SELECT DATE_FORMAT(start_time, '%Y-%m-%d') AS d,
              COUNT(*) AS sessions,
              COALESCE(SUM(GREATEST(COALESCE(duration_seconds, 0) - COALESCE(paused_seconds, 0), 0)), 0) AS seconds,
              COALESCE(SUM(COALESCE(rep_count, 0)), 0) AS reps
       FROM workout_logs
       WHERE user_id = ? AND status <> 'cancelled'
         AND start_time >= ? AND start_time < ?
       GROUP BY d`,
      [userId, monday, sunday],
    ),
    db.execute(
      `SELECT DATE_FORMAT(logged_at, '%Y-%m-%d') AS d,
              COUNT(*) AS count,
              COALESCE(SUM(calories), 0) AS kcal
       FROM food_logs
       WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
       GROUP BY d`,
      [userId, monday, sunday],
    ),
    db.execute(
      `SELECT DATE_FORMAT(checkin_date, '%Y-%m-%d') AS d, energy_level, sleep_hours
       FROM daily_checkins
       WHERE user_id = ? AND checkin_date >= ? AND checkin_date < ?`,
      [userId, monday, sunday],
    ),
    db.execute(
      `SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS d, steps, calories_burned, workout_duration_mins
       FROM daily_stats
       WHERE user_id = ? AND stat_date >= ? AND stat_date < ?`,
      [userId, monday, sunday],
    ),
  ]);
  const byDate = (rows) => new Map(rows.map((r) => [r.d, r]));
  const workoutMap = byDate(workoutsRes[0]);
  const mealMap = byDate(mealsRes[0]);
  const checkinMap = byDate(checkinsRes[0]);
  const statsMap = byDate(statsRes[0]);

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysISO(monday, i);
    const wo = workoutMap.get(date);
    const fo = mealMap.get(date);
    const ci = checkinMap.get(date);
    const st = statsMap.get(date);
    days.push({
      date,
      isToday: date === wk.today,
      isFuture: date > wk.today,
      workouts: {
        sessions: Number(wo?.sessions || 0),
        minutes: Math.round(Number(wo?.seconds || 0) / 60),
        reps: Number(wo?.reps || 0),
      },
      meals: { count: Number(fo?.count || 0), kcal: Math.round(Number(fo?.kcal || 0)) },
      checkin: ci
        ? { energy: ci.energy_level || null, sleepHours: Number(ci.sleep_hours) || 0 }
        : null,
      steps: Number(st?.steps || 0),
    });
  }

  return {
    weekStart: monday,
    weekEnd: days[6].date,
    today: wk.today,
    days,
    totals: {
      sessions: days.reduce((s, d) => s + d.workouts.sessions, 0),
      minutes: days.reduce((s, d) => s + d.workouts.minutes, 0),
      kcal: days.reduce((s, d) => s + d.meals.kcal, 0),
      steps: days.reduce((s, d) => s + d.steps, 0),
    },
  };
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getDaySnapshot(userId, dateStr) {
  const date = String(dateStr || "");
  if (!ISO_DATE_RE.test(date)) {
    throw new AppError("date must be YYYY-MM-DD", 400, "BAD_DATE");
  }
  const [y, m, d] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new AppError("date is not a real calendar day", 400, "BAD_DATE");
  }
  const next = addDaysISO(date, 1);

  const [workouts, meals, checkins, stats, sleep, measurements, bmi] = await Promise.all([
    db.execute(
      `SELECT workout_type, status, rep_count, start_time, duration_seconds, paused_seconds, difficulty_rating
       FROM workout_logs
       WHERE user_id = ? AND status <> 'cancelled'
         AND start_time >= ? AND start_time < ?
       ORDER BY start_time ASC`,
      [userId, date, next],
    ),
    db.execute(
      `SELECT food_name, serving, meal_type, calories, protein, carbs, fat, logged_at
       FROM food_logs
       WHERE user_id = ? AND logged_at >= ? AND logged_at < ?
       ORDER BY logged_at ASC`,
      [userId, date, next],
    ),
    db.execute(
      `SELECT sleep_hours, sleep_quality, stress_level, soreness_level, energy_level
       FROM daily_checkins WHERE user_id = ? AND checkin_date = ? LIMIT 1`,
      [userId, date],
    ),
    db.execute(
      `SELECT steps, calories_burned, workout_duration_mins
       FROM daily_stats WHERE user_id = ? AND stat_date = ? LIMIT 1`,
      [userId, date],
    ),
    db.execute(
      `SELECT COALESCE(SUM(sleep_duration), 0) AS hours,
              COALESCE(SUM(water_intake_ml), 0) AS water_ml
       FROM sleep_logs
       WHERE user_id = ? AND recorded_at >= ? AND recorded_at < ?`,
      [userId, date, next],
    ),
    db.execute(
      `SELECT weight_kg, body_fat_pct, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm, notes
       FROM body_measurements WHERE user_id = ? AND recorded_at = ? LIMIT 1`,
      [userId, date],
    ).catch((e) => {
      if (e.code === "ER_NO_SUCH_TABLE") return [[]];
      throw e;
    }),
    db.execute(
      `SELECT weight_kg, bmi, bmi_category FROM bmi_records
       WHERE user_id = ? AND recorded_at >= ? AND recorded_at < ?
       ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      [userId, date, next],
    ),
  ]);

  const workoutRows = (workouts[0] || []).map((w) => ({
    type: w.workout_type,
    status: w.status,
    reps: Number(w.rep_count || 0),
    minutes: Math.round(
      Math.max(Number(w.duration_seconds || 0) - Number(w.paused_seconds || 0), 0) / 60,
    ),
    difficulty: w.difficulty_rating != null ? Number(w.difficulty_rating) : null,
    startTime: w.start_time,
    durationSeconds: Number(w.duration_seconds || 0),
  }));

  const mealRows = (meals[0] || []).map((f) => ({
    name: f.food_name,
    serving: f.serving,
    mealType: f.meal_type,
    kcal: Number(f.calories || 0),
    protein: Number(f.protein || 0),
    carbs: Number(f.carbs || 0),
    fat: Number(f.fat || 0),
    loggedAt: f.logged_at,
  }));

  const nutritionTotals = mealRows.reduce(
    (t, r) => ({
      kcal: t.kcal + r.kcal,
      protein: Math.round((t.protein + r.protein) * 10) / 10,
      carbs: Math.round((t.carbs + r.carbs) * 10) / 10,
      fat: Math.round((t.fat + r.fat) * 10) / 10,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const [[todayRow]] = await db.execute(
    "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today",
  );

  const measurementRow = measurements[0]?.[0] || null;
  const bmiRow = bmi[0]?.[0] || null;
  const checkinRow = checkins[0]?.[0] || null;
  const sleepRow = sleep[0]?.[0] || {};
  const statsRow = stats[0]?.[0] || {};
  const readiness = calcReadiness({
    checkin: checkinRow,
    sleepCount: Number(sleepRow.hours || 0) > 0 ? 1 : 0,
    steps: Number(statsRow.steps || 0),
    calories: Number(statsRow.calories_burned || 0),
  });

  return {
    date,
    isToday: date === todayRow.today,
    isFuture: date > todayRow.today,
    workouts: workoutRows,
    nutrition: { items: mealRows, totals: nutritionTotals },
    recovery: {
      checkin: checkinRow,
      sleepHours: Number(sleepRow.hours || 0),
      waterMl: Number(sleepRow.water_ml || 0),
      readiness: readiness.readiness,
      readinessNote: readiness.recommendation,
      readinessSource: readiness.source,
    },
    activity: {
      steps: Number(stats[0]?.[0]?.steps || 0),
      caloriesBurned: Number(stats[0]?.[0]?.calories_burned || 0),
      workoutMinutes: Number(stats[0]?.[0]?.workout_duration_mins || 0),
    },
    measurements: measurementRow,
    weight: {
      kg: measurementRow?.weight_kg != null
        ? Number(measurementRow.weight_kg)
        : bmiRow?.weight_kg != null ? Number(bmiRow.weight_kg) : null,
      bmi: bmiRow?.bmi != null ? Number(bmiRow.bmi) : null,
      bmiCategory: bmiRow?.bmi_category || null,
    },
  };
}

module.exports.getWeekCalendar = getWeekCalendar;
module.exports.getDaySnapshot = getDaySnapshot;
