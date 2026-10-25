// Admin — Module 7 business logic + DB access. Backend only (no UI yet).
// HTTP concerns stay in admin.controller.js. EVERY function here assumes the
// caller passed `verifyUser, requireAdmin` — nothing re-checks admin-ness.
//
// Safety rails (decided with the user):
//   - Admins cannot act on themselves via admin endpoints (own account uses
//     the normal Profile flows — deactivation, sign-out, etc.).
//   - Admins cannot demote, deactivate or delete ANOTHER admin. That removes
//     the "two admins fight" footgun; promote/demote of members is free.
//   - Every mutating action is audited (fail-soft: if migration 039 hasn't
//     run yet the action still succeeds and the audit write logs to console).
const db = require("../config/db");
const { AppError } = require("../utils/errors");

const ROLES = ["member", "admin"];
const STATUSES = ["active", "deactivated"];

// ─── AUDIT (fail-soft) ─────────────────────────────────────────────────
async function writeAudit(adminId, action, targetUserId, details) {
  try {
    await db.execute(
      "INSERT INTO admin_actions (admin_user_id, action, target_user_id, details) VALUES (?, ?, ?, ?)",
      [adminId, action, targetUserId ?? null, details ? String(details).slice(0, 500) : null],
    );
  } catch (err) {
    // ER_NO_SUCH_TABLE = migration 039 not run yet — never block the action.
    console.error("[admin-audit] write failed:", err.code || err.message, "→", action, targetUserId ?? "");
  }
}

async function listAudit({ limit = 50, offset = 0 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);
  const [rows] = await db.query(
    `SELECT a.id, a.action, a.details, DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i') AS created_at,
            a.admin_user_id, au.name AS admin_name, au.email AS admin_email,
            a.target_user_id, tu.name AS target_name, tu.email AS target_email
     FROM admin_actions a
     JOIN users au ON au.id = a.admin_user_id
     LEFT JOIN users tu ON tu.id = a.target_user_id
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ${cap} OFFSET ${off}`,
  );
  const [[countRow]] = await db.execute("SELECT COUNT(*) AS total FROM admin_actions");
  return { records: rows, total: countRow?.total ?? 0 };
}

// ─── 1. OVERVIEW STATS ─────────────────────────────────────────────────
async function getOverview() {
  const [[u]] = await db.execute(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'deactivated' THEN 1 ELSE 0 END) AS deactivated,
            SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins,
            SUM(CASE WHEN is_verified = 0 THEN 1 ELSE 0 END) AS unverified,
            SUM(CASE WHEN onboarding_completed = 0 THEN 1 ELSE 0 END) AS onboarding_incomplete,
            SUM(CASE WHEN created_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS new7d,
            SUM(CASE WHEN created_at >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS new30d
     FROM users`,
  );
  const [[w]] = await db.execute(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN start_time >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS last7d,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
     FROM workout_logs`,
  );
  const [[f]] = await db.execute(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN logged_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS last7d
     FROM food_logs`,
  );
  const [[p]] = await db.execute(
    `SELECT (SELECT COUNT(*) FROM plans) AS plans,
            (SELECT COUNT(*) FROM user_plans) AS enrollments
     FROM DUAL`,
  );
  // personal_plans (migration 032) may not be applied on every environment —
  // count it best-effort so the overview never 500s over an optional table.
  let personalPlans = 0;
  try {
    const [[pp]] = await db.execute("SELECT COUNT(*) AS n FROM personal_plans");
    personalPlans = Number(pp.n);
  } catch (e) {
    if (e.code !== "ER_NO_SUCH_TABLE") throw e;
  }
  const [[ai]] = await db.execute(
    `SELECT COALESCE(SUM(count), 0) AS total,
            COALESCE(SUM(CASE WHEN usage_day = UTC_DATE() THEN count END), 0) AS today
     FROM ai_daily_usage`,
  );
  const [[s]] = await db.execute(
    // No expires_at column (revocation is token_version-based) — "active"
    // means a known device login in the last 30 days.
    `SELECT COUNT(*) AS activeSessions FROM user_sessions
     WHERE created_at >= NOW() - INTERVAL 30 DAY`,
  );
  const [[c]] = await db.execute(
    `SELECT (SELECT COUNT(*) FROM community_posts) AS posts,
            (SELECT COUNT(*) FROM progress_photos) AS photos,
            (SELECT COUNT(*) FROM body_measurements) AS measurements,
            (SELECT COUNT(DISTINCT visit_date) FROM landing_visits) AS landingDays
     FROM DUAL`,
  );
  return {
    users: {
      total: Number(u.total), active: Number(u.active), deactivated: Number(u.deactivated),
      admins: Number(u.admins), unverified: Number(u.unverified),
      onboardingIncomplete: Number(u.onboarding_incomplete),
      newLast7d: Number(u.new7d), newLast30d: Number(u.new30d),
    },
    workouts: { total: Number(w.total), last7d: Number(w.last7d), completed: Number(w.completed) },
    meals: { total: Number(f.total), last7d: Number(f.last7d) },
    plans: { catalog: Number(p.plans), enrollments: Number(p.enrollments), personal: personalPlans },
    ai: { totalCalls: Number(ai.total), callsToday: Number(ai.today), activeSessions: Number(s.activeSessions) },
    content: { communityPosts: Number(c.posts), progressPhotos: Number(c.photos), bodyMeasurements: Number(c.measurements), landingDays: Number(c.landingDays) },
  };
}

// ─── 2. USER MANAGEMENT ────────────────────────────────────────────────
async function listUsers({ q, role, status, limit = 30, offset = 0 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const where = [];
  const params = [];
  if (q && String(q).trim()) {
    where.push("(u.name LIKE ? OR u.email LIKE ?)");
    const like = `%${String(q).trim().slice(0, 80)}%`;
    params.push(like, like);
  }
  if (role && ROLES.includes(role)) { where.push("u.role = ?"); params.push(role); }
  if (status && STATUSES.includes(status)) { where.push("u.status = ?"); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // db.query (not execute) — LIMIT/OFFSET placeholders rejected by server-side
  // prepares on some MySQL versions (house pattern from foodLogs.service).
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.is_verified, u.is_online,
            u.onboarding_completed, u.accepted_terms_at, u.accepted_terms_version,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS created_at
     FROM users u
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT ${cap} OFFSET ${off}`,
    params,
  );
  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
    params,
  );
  return { records: rows, total: countRow?.total ?? 0, limit: cap, offset: off };
}

async function _getTargetUser(userId) {
  const [rows] = await db.execute(
    `SELECT id, name, email, role, status, is_verified, onboarding_completed, token_version
     FROM users WHERE id = ?`,
    [userId],
  );
  if (rows.length === 0) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  return rows[0];
}

function assertMutableAdmin(adminId, target, verb) {
  if (Number(target.id) === Number(adminId)) {
    throw new AppError(`You cannot ${verb} your own account — use Profile instead`, 400, "SELF_ACTION");
  }
  if (target.role === "admin") {
    throw new AppError(
      "Admins cannot act on other admins — demote them via the DB or scripts/set-admin.js first",
      400,
      "TARGET_IS_ADMIN",
    );
  }
}

async function getUserDetail(adminId, userId) {
  const user = await _getTargetUser(userId);
  const [[profile]] = await db.execute(
    `SELECT height_cm, weight_kg, avatar_url IS NOT NULL AS has_avatar
     FROM user_profiles WHERE user_id = ?`,
    [userId],
  );
  const [[counts]] = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM workout_logs WHERE user_id = ?) AS workouts,
       (SELECT COUNT(*) FROM food_logs WHERE user_id = ?) AS meals,
       (SELECT COUNT(*) FROM progress_photos WHERE user_id = ?) AS photos,
       (SELECT COUNT(*) FROM body_measurements WHERE user_id = ?) AS measurements,
       (SELECT COUNT(*) FROM user_plans WHERE user_id = ?) AS planEnrollments,
       (SELECT COUNT(*) FROM community_posts WHERE user_id = ?) AS posts,
       (SELECT COALESCE(SUM(count),0) FROM ai_daily_usage WHERE user_id = ?) AS aiCalls,
       (SELECT COUNT(*) FROM user_sessions WHERE user_id = ? AND created_at >= NOW() - INTERVAL 30 DAY) AS activeSessions`,
    [userId, userId, userId, userId, userId, userId, userId, userId],
  );
  // Optional table (migration 032 may not be applied everywhere).
  let personalPlans = 0;
  try {
    const [[pp]] = await db.execute(
      "SELECT COUNT(*) AS n FROM personal_plans WHERE user_id = ?",
      [userId],
    );
    personalPlans = Number(pp.n);
  } catch (e) {
    if (e.code !== "ER_NO_SUCH_TABLE") throw e;
  }
  const [[goal]] = await db.execute(
    `SELECT goal_type, status, daily_kcal, protein_g, carbs_g, fat_g, target_weight_kg
     FROM fitness_goals WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    [userId],
  );
  const [lastSessions] = await db.execute(
    `SELECT device, browser, ip_address, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at
     FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
    [userId],
  );
  return {
    user: {
      ...user,
      is_verified: Boolean(user.is_verified),
      onboarding_completed: Boolean(user.onboarding_completed),
    },
    profile: profile || null,
    goal: goal || null,
    counts: {
      workouts: Number(counts.workouts), meals: Number(counts.meals),
      photos: Number(counts.photos), measurements: Number(counts.measurements),
      planEnrollments: Number(counts.planEnrollments), personalPlans,
      posts: Number(counts.posts), aiCalls: Number(counts.aiCalls),
      activeSessions: Number(counts.activeSessions),
    },
    recentSessions: lastSessions,
  };
}

// POST /api/admin/users/:id/role — body { role }
async function changeUserRole(adminId, userId, role) {
  if (!ROLES.includes(role)) {
    throw new AppError("role must be 'member' or 'admin'", 400, "BAD_ROLE");
  }
  const target = await _getTargetUser(userId);
  if (target.role === role) {
    return { success: true, unchanged: true, role };
  }
  // Promoting a member to admin is allowed; demoting an admin is blocked
  // (assertMutableAdmin) — a second admin must demote themselves via DB.
  assertMutableAdmin(adminId, target, role === "admin" ? "promote" : "demote");
  await db.execute("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
  await writeAudit(adminId, "role_change", userId, `${target.email}: ${target.role} → ${role}`);
  return { success: true, role };
}

// POST /api/admin/users/:id/status — body { status, reason? }
async function setUserStatus(adminId, userId, status, reason) {
  if (!STATUSES.includes(status)) {
    throw new AppError("status must be 'active' or 'deactivated'", 400, "BAD_STATUS");
  }
  const target = await _getTargetUser(userId);
  if (target.status === status) {
    return { success: true, unchanged: true, status };
  }
  assertMutableAdmin(adminId, target, status === "deactivated" ? "deactivate" : "reactivate");
  if (status === "deactivated") {
    // Same mechanics as self-deactivation: token_version bump kills every
    // issued session; data untouched; login offers one-click reactivation.
    await db.execute(
      "UPDATE users SET status = 'deactivated', token_version = token_version + 1, is_online = 0 WHERE id = ?",
      [userId],
    );
  } else {
    await db.execute("UPDATE users SET status = 'active', is_online = 0 WHERE id = ?", [userId]);
  }
  await writeAudit(adminId, status === "deactivated" ? "deactivate" : "reactivate", userId,
    `${target.email}${reason ? ` — reason: ${reason}` : ""}`);
  return { success: true, status };
}

// POST /api/admin/users/:id/signout — force sign-out everywhere.
async function forceSignout(adminId, userId) {
  const target = await _getTargetUser(userId);
  if (Number(target.id) === Number(adminId)) {
    throw new AppError("Use your own logout for that", 400, "SELF_ACTION");
  }
  await db.execute("UPDATE users SET token_version = token_version + 1, is_online = 0 WHERE id = ?", [userId]);
  await writeAudit(adminId, "force_signout", userId, `${target.email}: token_version bumped`);
  return { success: true };
}

// DELETE /api/admin/users/:id — HARD delete (FK cascades wipe all data).
async function deleteUser(adminId, userId) {
  const target = await _getTargetUser(userId);
  assertMutableAdmin(adminId, target, "delete");
  // Snapshot before the cascade erases everything.
  await writeAudit(adminId, "delete_user", userId,
    `${target.email} (name: ${target.name}) — account and all data permanently deleted`);
  await db.execute("DELETE FROM users WHERE id = ?", [userId]);
  return { success: true, deletedEmail: target.email };
}

// ─── 3. CONTENT OVERSIGHT ──────────────────────────────────────────────
async function listPlans({ limit = 30, offset = 0 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const [rows] = await db.query(
    `SELECT pl.id, pl.title, pl.name, pl.tag, pl.difficulty, pl.intensity, pl.duration_days,
            (SELECT COUNT(*) FROM user_plans up WHERE up.plan_id = pl.id) AS enrolled,
            (SELECT COUNT(*) FROM plan_contents pc WHERE pc.plan_id = pl.id) AS dayCount
     FROM plans pl
     ORDER BY enrolled DESC, pl.id ASC
     LIMIT ${cap} OFFSET ${off}`,
  );
  const [[countRow]] = await db.execute("SELECT COUNT(*) AS total FROM plans");
  return { records: rows, total: countRow?.total ?? 0, limit: cap, offset: off };
}

async function listCommunityPosts({ limit = 30, offset = 0, tag } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const where = [];
  const params = [];
  if (tag && String(tag).trim()) { where.push("p.tag = ?"); params.push(String(tag).trim().slice(0, 40)); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.query(
    `SELECT p.id, p.user_id, u.name AS author_name, u.email AS author_email, u.role AS author_role,
            p.author_name AS display_name, p.text, p.tag, DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS created_at,
            (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS likes,
            (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) AS comments
     FROM community_posts p
     JOIN users u ON u.id = p.user_id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ${cap} OFFSET ${off}`,
    params,
  );
  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM community_posts p ${whereSql}`,
    params,
  );
  return { records: rows, total: countRow?.total ?? 0, limit: cap, offset: off };
}

// DELETE /api/admin/community/posts/:id — moderation removal.
async function deleteCommunityPost(adminId, postId) {
  const [rows] = await db.execute("SELECT id, user_id, author_name FROM community_posts WHERE id = ?", [postId]);
  if (rows.length === 0) throw new AppError("Post not found", 404, "POST_NOT_FOUND");
  await db.execute("DELETE FROM community_posts WHERE id = ?", [postId]);
  await writeAudit(adminId, "delete_post", rows[0].user_id,
    `community post #${postId} by ${rows[0].author_name} removed`);
  return { success: true };
}

// ─── 4. ACTIVITY & AI LEDGER ───────────────────────────────────────────
async function getAiUsageLedger({ days = 14, limit = 30, offset = 0 } = {}) {
  const window = Math.min(Math.max(Number(days) || 14, 1), 90);
  const [perDay] = await db.query(
    `SELECT usage_day, COALESCE(SUM(count),0) AS calls, COUNT(*) AS users
     FROM ai_daily_usage
     WHERE usage_day >= UTC_DATE() - INTERVAL ${window} DAY
     GROUP BY usage_day ORDER BY usage_day DESC`,
  );
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const [topUsers] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, COALESCE(SUM(a.count),0) AS totalCalls
     FROM ai_daily_usage a JOIN users u ON u.id = a.user_id
     WHERE a.usage_day >= UTC_DATE() - INTERVAL ${window} DAY
     GROUP BY u.id ORDER BY totalCalls DESC
     LIMIT ${cap} OFFSET ${off}`,
  );
  const [[countRow]] = await db.execute(
    `SELECT COUNT(DISTINCT user_id) AS total FROM ai_daily_usage
     WHERE usage_day >= UTC_DATE() - INTERVAL ${window} DAY`,
  );
  return { windowDays: window, perDay, topUsers: { records: topUsers, total: countRow?.total ?? 0 } };
}

module.exports = {
  ROLES,
  STATUSES,
  writeAudit,
  listAudit,
  getOverview,
  listUsers,
  getUserDetail,
  changeUserRole,
  setUserStatus,
  forceSignout,
  deleteUser,
  listPlans,
  listCommunityPosts,
  deleteCommunityPost,
  getAiUsageLedger,
};
