// Landing page needs REAL numbers (athletes, active users, workouts, meals,
// posts, plans, site visits, modules, manual-first %) without leaking any
// PII. Only COUNT(*) + public plan catalog rows. Clauses are hardcoded
// (never user input). Short in-memory cache (60s) so the landing can't
// hammer the DB.
const crypto = require('crypto');
const db = require('../config/db');
const { MODULE_COUNT } = require('../constants/landingModules');

const CACHE_TTL_MS = 60 * 1000;
let cache = { at: 0, payload: null };

async function safeCount(table) {
  try {
    const [[row]] = await db.execute(`SELECT COUNT(*) AS n FROM \`${table}\``);
    return Number(row?.n || 0);
  } catch {
    return 0;
  }
}

// Active users = verified accounts (past email verification, actually able to
// use the system). Hardcoded clause — never built from request input.
async function safeActiveUserCount() {
  try {
    const [[row]] = await db.execute(
      'SELECT COUNT(*) AS n FROM `users` WHERE `is_verified` = 1'
    );
    return Number(row?.n || 0);
  } catch {
    return 0;
  }
}

// "Manual-first logging" stat — the share of user entries (workouts, activities,
// sleep, check-ins, meals) that were typed by hand. The only assisted path is
// the AI food-photo scan, which persists the preview as a `data:` URI in
// food_logs.image_url (manual saves use a hosted URL or NULL).
// Returns 100 when nothing has been logged yet — no data to contradict it.
async function safeManualLogPct() {
  const totalTables = ['workout_logs', 'activity_logs', 'sleep_logs', 'daily_checkins', 'food_logs'];
  let total = 0;
  for (const table of totalTables) total += await safeCount(table);
  if (total <= 0) return 100;
  try {
    const [[row]] = await db.execute(
      "SELECT COUNT(*) AS n FROM `food_logs` WHERE `image_url` LIKE 'data:%'"
    );
    const assisted = Number(row?.n || 0);
    const manual = Math.max(total - assisted, 0);
    return Math.round((manual / total) * 100);
  } catch {
    return 100;
  }
}

// Public landing aggregates (cached 60s).
async function getLandingStats() {
  if (cache.payload && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.payload;
  }

  const [athletes, activeUsers, plans, workouts, activities, meals, posts, checkins, visits, manualLogPct] = await Promise.all([
    safeCount('users'),
    safeActiveUserCount(),
    safeCount('plans'),
    safeCount('workout_logs'),
    safeCount('activity_logs'),
    safeCount('food_logs'),
    safeCount('community_posts'),
    safeCount('daily_checkins'),
    safeCount('landing_visits'),
    safeManualLogPct(),
  ]);

  let featuredPlans = [];
  try {
    const [rows] = await db.execute(
      'SELECT id, COALESCE(title, name) AS title, tag, difficulty, duration_days FROM plans ORDER BY id ASC LIMIT 6'
    );
    featuredPlans = rows;
  } catch {
    featuredPlans = [];
  }

  const payload = {
    stats: {
      athletes,
      activeUsers,
      plans,
      workouts,
      activities,
      meals,
      posts,
      checkins,
      visits,
      modules: MODULE_COUNT,
      manualLogPct,
    },
    plans: featuredPlans,
    time: new Date().toISOString(),
  };
  cache = { at: Date.now(), payload };
  return payload;
}

// Record one unique-per-day site visit for the given raw client IP.
// Privacy-friendly: only a salted SHA-256 of the client IP + current date is
// stored (UNIQUE(ip_hash, visit_date) dedupes refreshes / repeat views).
// Returns the running total so the landing can show a real visitor count.
async function recordVisit(rawIp) {
  // Dedicated salt first (set IP_HASH_SALT in prod); fallback keeps old hashes working.
  const salt = String(process.env.IP_HASH_SALT || process.env.JWT_SECRET || 'vitalis-visit-salt').slice(0, 32);
  const ipHash = crypto.createHash('sha256').update(`${rawIp}|${salt}`).digest('hex');
  try {
    await db.execute(
      'INSERT IGNORE INTO `landing_visits` (`ip_hash`, `visit_date`) VALUES (?, CURDATE())',
      [ipHash]
    );
  } catch {
    // Table missing (migration not run yet) — still return a usable payload.
  }
  const visits = await safeCount('landing_visits');
  // Visit writes change the total — bust the stats cache so the next
  // landing-stats fetch includes this visit.
  cache = { at: 0, payload: null };
  return visits;
}

module.exports = { getLandingStats, recordVisit };
