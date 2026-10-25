// Auth — business logic + DB access.
// HTTP concerns (cookies, status codes) stay in auth.controller.js.
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const UAParser = require("ua-parser-js");
const { OAuth2Client } = require("google-auth-library");
const { AppError } = require("../utils/errors");
const { sendVerificationEmail, sendEmailChangedNotice } = require("./email.service");
const allergiesService = require("./allergies.service");

// ─── FRONTEND URL ───
function resolveFrontendUrl() {
  const raw = (
    process.env.FRONTEND_URL ||
    (process.env.ALLOWED_ORIGINS || "").split(",")[0] ||
    "http://localhost:5173"
  ).trim();
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad proto");
    if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
      console.warn("[auth] FRONTEND_URL should be https in production:", raw);
    }
    return raw.replace(/\/$/, "");
  } catch {
    console.warn("[auth] Invalid FRONTEND_URL, falling back to http://localhost:5173:", raw);
    return "http://localhost:5173";
  }
}
// Resolved per email so tunnel URLs take effect without a code change.
function frontendUrl() {
  return resolveFrontendUrl();
}

// ALLOW_DEV_LINKS=1 exposes links for local demo without SMTP (never in prod).
const DEV_VERIFY_FALLBACK =
  process.env.ALLOW_DEV_LINKS === "1" && process.env.NODE_ENV !== "production";

// Email verification is enforced ONLY in production. In development/test we
// auto-verify accounts so the app is usable with dummy emails and no SMTP.
// verifyUser + socket auth both read is_verified from the DB, so we persist it.
const VERIFICATION_REQUIRED = process.env.NODE_ENV === "production";

// ─── MODULE 1: consent audit + account governance ───
// Version stamp recorded with every acceptance — bump when the legal copy in
// Register/LegalModals materially changes (their "Last updated: September 2026"
// matches this value).
const CONSENT_VERSION = "2026-09";

// Seed rule: comma-separated emails auto-promoted to admin at account creation
// (e.g. ADMIN_EMAILS=admin@vitalis.io). Existing users can be promoted with
// `node scripts/set-admin.js <email> [admin|member]`.
function isSeedAdmin(email) {
  const list = String(process.env.ADMIN_EMAILS || "");
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(String(email || "").toLowerCase());
}

async function createVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.execute("UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0", [
    userId,
  ]);
  await db.execute(
    "INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt],
  );
  return { token, link: `${frontendUrl()}/verify-email?token=${token}` };
}

const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

// ─── PER-EMAIL LOGIN THROTTLE (second layer; IP limiter is primary) ───
const loginAttempts = new Map();
const ATTEMPT_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of loginAttempts) {
    if (rec.lockedUntil && rec.lockedUntil <= now) loginAttempts.delete(key);
    else if (!rec.lockedUntil && now - (rec.firstSeen || now) > ATTEMPT_TTL_MS)
      loginAttempts.delete(key);
  }
  if (loginAttempts.size > 5000) {
    const oldest = [...loginAttempts.keys()].slice(0, loginAttempts.size - 5000);
    for (const k of oldest) loginAttempts.delete(k);
  }
}, 10 * 60 * 1000).unref?.();

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getRateLimit(email) {
  const key = normEmail(email);
  if (!loginAttempts.has(key)) return { count: 0, lockedUntil: null, firstSeen: Date.now() };
  return loginAttempts.get(key);
}

function recordFailedAttempt(email) {
  const key = normEmail(email);
  const record = getRateLimit(key);
  const count = record.count + 1;

  let lockedUntil = null;
  if (count >= 20) {
    lockedUntil = Date.now() + 30 * 60 * 1000;
  } else if (count >= 10) {
    lockedUntil = Date.now() + 30 * 1000;
  }

  loginAttempts.set(key, { count, lockedUntil, firstSeen: record.firstSeen || Date.now() });
  return count;
}

function clearAttempts(email) {
  loginAttempts.delete(normEmail(email));
}

function checkRateLimit(email) {
  const record = getRateLimit(email);
  if (!record.lockedUntil) return null;

  const remaining = record.lockedUntil - Date.now();
  if (remaining <= 0) {
    loginAttempts.delete(normEmail(email));
    return null;
  }

  if (record.count >= 20) {
    const mins = Math.ceil(remaining / 60000);
    return {
      error: `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
      retryAfter: Math.ceil(remaining / 1000),
    };
  }
  const secs = Math.ceil(remaining / 1000);
  return {
    error: `Too many failed attempts. Try again in ${secs} second${secs !== 1 ? "s" : ""}.`,
    retryAfter: Math.ceil(remaining / 1000),
  };
}

// ─── SESSION LOGGING ───
async function logUserSession(req, userId) {
  let conn;
  try {
    const parser = new UAParser(req.headers["user-agent"]);
    const result = parser.getResult();

    const device = result.device.type || "Desktop";
    const browser = result.browser.name || "Unknown";
    const os = result.os.name || "Unknown";

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      req.ip ||
      "Unknown";

    const location = "Unknown";

    // Transaction so concurrent logins can't leave two is_current=true rows.
    conn = await db.getConnection();
    await conn.beginTransaction();
    await conn.execute("UPDATE user_sessions SET is_current = false WHERE user_id = ?", [userId]);

    await conn.execute(
      `INSERT INTO user_sessions
       (user_id, device, browser, os, ip_address, location, is_current)
       VALUES (?, ?, ?, ?, ?, ?, true)`,
      [userId, device, browser, os, ip, location],
    );
    await conn.commit();
  } catch (err) {
    try {
      await conn?.rollback();
    } catch (_) {}
    console.error("SESSION LOG ERROR:", err);
  } finally {
    try {
      conn?.release();
    } catch (_) {}
  }
}

// ─── ME ───
async function getMe(userId) {
  const [rows] = await db.execute(
    `SELECT
       u.id, u.name, u.email, u.fitness_goal, u.is_verified,
       u.onboarding_completed, u.token_version,
       u.accepted_terms_at, u.accepted_terms_version, u.status, u.role,
       COALESCE(p.avatar_url, u.avatar_url) AS avatar
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [userId],
  );
  return rows[0] || null;
}

// ─── ACCOUNT GOVERNANCE (Module 1) ───
// Soft deactivation: verify the password, flip status, and bump token_version
// so every issued session (any device) is dead the moment verifyUser next runs.
// Data is untouched — reactivate resumes exactly where life left off.
async function deactivateAccount(userId, password) {
  const [rows] = await db.execute("SELECT password, status FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) {
    throw new AppError("Account not found", 404, "USER_NOT_FOUND");
  }
  if (rows[0].status === "deactivated") {
    throw new AppError("This account is already deactivated", 400, "ALREADY_DEACTIVATED");
  }
  const isMatch = await bcrypt.compare(password || "", rows[0].password);
  if (!isMatch) {
    throw new AppError("Current password is incorrect", 401, "INVALID_PASSWORD");
  }
  await db.execute(
    "UPDATE users SET status = 'deactivated', token_version = token_version + 1, is_online = 0 WHERE id = ?",
    [userId],
  );
  return { success: true };
}

// Reactivation: same credential gate as login (never reveals whether the
// email exists). Only a deactivated account passes — active accounts get
// told to just sign in.
async function reactivateAccount({ email, password }) {
  const [users] = await db.execute("SELECT id, password, status FROM users WHERE email = ?", [email]);
  if (users.length === 0) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }
  const user = users[0];
  const isMatch = await bcrypt.compare(password || "", user.password);
  if (!isMatch) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }
  if (user.status !== "deactivated") {
    throw new AppError("This account is already active — just sign in", 400, "NOT_DEACTIVATED");
  }
  await db.execute(
    "UPDATE users SET status = 'active', is_online = 0 WHERE id = ?",
    [user.id],
  );
  return { success: true };
}

// ─── REGISTER ───
// Account creation only — fitness/goal data is collected later in onboarding
// (see goals.service), so it is never client-supplied at signup.
async function register({ name, email, password }) {
  const [existing] = await db.execute("SELECT email FROM users WHERE email = ?", [email]);
  if (existing.length > 0) {
    throw new AppError("Email already registered in Vitalis labs.", 400, "EMAIL_EXISTS");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPw = await bcrypt.hash(password, salt);

  let insertResult;
  try {
    [insertResult] = await db.execute(
      "INSERT INTO users (name, email, password, fitness_goal, is_online, is_verified, onboarding_completed, role, accepted_terms_at, accepted_terms_version) VALUES (?, ?, ?, ?, ?, 0, 0, ?, NOW(), ?)",
      [name, email, hashedPw, "general fitness", 0, isSeedAdmin(email) ? "admin" : "member", CONSENT_VERSION],
    );
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      throw new AppError("Email already registered in Vitalis labs.", 400, "EMAIL_EXISTS");
    }
    throw err;
  }
  const newUserId = insertResult.insertId;

  // Dev/test: auto-activate and skip the email loop entirely so dummy addresses
  // work with no inbox/SMTP. Production keeps the verify-before-login gate.
  if (!VERIFICATION_REQUIRED) {
    await db.execute("UPDATE users SET is_verified = 1 WHERE id = ?", [newUserId]);
    return { newUserId, link: null, emailed: false, autoVerified: true };
  }

  // Email verification (link-based). Never block registration on SMTP.
  const { link } = await createVerificationToken(newUserId);
  let emailed = false;
  try {
    await sendVerificationEmail(email, link);
    emailed = true;
  } catch (mailErr) {
    console.error("Verification email failed (SMTP?):", mailErr.message);
  }

  return { newUserId, link, emailed };
}

// ─── LOGIN ───
const LOGIN_USER_SELECT =
  "SELECT id, name, email, password, fitness_goal, avatar_url, is_verified, onboarding_completed, is_online, token_version, status, role FROM users WHERE email = ?";

async function login({ email, password }) {
  const lockStatus = checkRateLimit(email);
  if (lockStatus) {
    throw new AppError(lockStatus.error, 429, "RATE_LIMITED", {
      retryAfter: lockStatus.retryAfter,
    });
  }

  const [users] = await db.execute(LOGIN_USER_SELECT, [email]);
  if (users.length === 0) {
    recordFailedAttempt(email);
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const attempts = recordFailedAttempt(email);
    let hint = "Invalid credentials";
    if (attempts >= 20) hint = "Too many failed attempts. Try again in 30 minutes.";
    else if (attempts >= 10) hint = "Too many failed attempts. Try again in 30 seconds.";
    throw new AppError(hint, 401, "INVALID_CREDENTIALS");
  }

  clearAttempts(email);

  // Soft-deactivated accounts: the password is correct, but the login is
  // refused so stale sessions can't sneak back in. The login screen offers
  // one-click reactivation (POST /api/auth/reactivate + normal login).
  if (user.status === "deactivated") {
    throw new AppError(
      "This account is deactivated. Your data is safe — reactivate it to continue.",
      403,
      "ACCOUNT_DEACTIVATED",
      { email: user.email },
    );
  }

  if (!user.is_verified) {
    if (VERIFICATION_REQUIRED) {
      throw new AppError(
        "Please verify your email before signing in. Check your inbox for the verification link.",
        403,
        "NEEDS_VERIFICATION",
        { email: user.email },
      );
    }
    // Dev/test: auto-verify legacy unverified accounts on first login so the
    // session also passes verifyUser + socket auth (both read is_verified).
    await db.execute("UPDATE users SET is_verified = 1 WHERE id = ?", [user.id]);
    user.is_verified = 1;
  }

  await db.execute("UPDATE users SET is_online = 1 WHERE id = ?", [user.id]);

  const [profileRows] = await db.execute("SELECT avatar_url FROM user_profiles WHERE user_id = ?", [
    user.id,
  ]);
  let latestAvatar = profileRows[0]?.avatar_url || user.avatar_url || null;

  // Provider photos (Google/Microsoft/etc.) are only released during their own
  // OAuth sign-in — a typed email+password login can never fetch them. Gravatar
  // is the one public per-email avatar registry, so probe it for accounts that
  // have no stored avatar, and persist what it finds for every later session.
  if (!latestAvatar) {
    latestAvatar = await discoverGravatarAvatar(user.email, user.id);
  }

  return { user, latestAvatar };
}

// Gravatar discovery for email logins. d=404 makes Gravatar answer 404 (not a
// placeholder image) when the email has no registered avatar; only then is a
// displayable URL written back. The UPDATE is guarded by avatar_url IS NULL so
// a user-chosen avatar can never be overwritten by this best-effort probe.
async function discoverGravatarAvatar(email, userId) {
  try {
    const hash = crypto
      .createHash("md5")
      .update(String(email || "").trim().toLowerCase())
      .digest("hex");
    const probe = `https://gravatar.com/avatar/${hash}?d=404&s=1`;
    const res = await fetch(probe, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const url = `https://gravatar.com/avatar/${hash}?d=mp&s=256`;
    await db.execute(
      "UPDATE users SET avatar_url = ? WHERE id = ? AND avatar_url IS NULL",
      [url, userId],
    );
    return url;
  } catch (err) {
    // Network trouble must never block a login — initials fallback is fine.
    console.warn("[auth] Gravatar probe skipped:", err.message);
    return null;
  }
}

// ─── GOOGLE LOGIN ───
async function googleLogin(code) {
  const { tokens } = await googleClient.getToken({ code, redirect_uri: "postmessage" });
  if (!tokens.id_token) {
    throw new AppError("No ID token returned from Google", 401, "GOOGLE_AUTH_FAILED");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const { name, picture } = payload;
  const email = normEmail(payload.email);
  if (!email) {
    throw new AppError("Google account has no email", 401, "GOOGLE_AUTH_FAILED");
  }

  const [users] = await db.execute(LOGIN_USER_SELECT, [email]);

  let user;
  if (users.length === 0) {
    // Password is a random bcrypt secret (never known, never used for login) —
    // recovery goes through the email-OTP forgot-password flow.
    const salt = await bcrypt.genSalt(10);
    const randomHashedPw = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), salt);
    const defaultGoal = "Unspecified (Google Auth)";

    const [insertResult] = await db.execute(
      "INSERT INTO users (name, email, password, fitness_goal, is_online, avatar_url, is_verified, onboarding_completed, role, accepted_terms_at, accepted_terms_version) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, NOW(), ?)",
      [name, email, randomHashedPw, defaultGoal, 1, picture, isSeedAdmin(email) ? "admin" : "member", CONSENT_VERSION],
    );

    const [newUsers] = await db.execute(
      "SELECT id, name, email, fitness_goal, avatar_url, is_verified, onboarding_completed, token_version FROM users WHERE id = ?",
      [insertResult.insertId],
    );
    user = newUsers[0];
  } else {
    user = users[0];
    // Google-verified email counts as verified
    await db.execute("UPDATE users SET is_online = 1, is_verified = 1 WHERE id = ?", [user.id]);
    user.is_verified = 1;
  }

  const [profileRows] = await db.execute("SELECT avatar_url FROM user_profiles WHERE user_id = ?", [
    user.id,
  ]);
  const profileAvatar = profileRows[0]?.avatar_url || null;
  // Existing accounts created via email signup used to miss the Google photo:
  // the INSERT branch stored `picture`, but this branch only bumped online /
  // verified flags. Store it whenever the user has no profile avatar of their
  // own, so both login paths end up with a real image instead of initials.
  if (!profileAvatar && picture && user.avatar_url !== picture) {
    await db.execute("UPDATE users SET avatar_url = ? WHERE id = ?", [picture, user.id]);
    user.avatar_url = picture;
  }
  const latestAvatar = profileAvatar || user.avatar_url || picture;

  return { user, latestAvatar };
}

// ─── CHANGE PASSWORD ───
// Shared behavior with the forgot-password reset: same hashing, same
// token_version bump (revoke every previously issued cookie) and the same
// "sign out all devices" bookkeeping. Difference: the caller re-issues the
// CURRENT device's cookie afterwards, so this device stays signed in.
async function changePassword(userId, currentPassword, newPassword) {
  const [rows] = await db.execute("SELECT password FROM users WHERE id = ?", [userId]);
  if (rows.length === 0) throw new AppError("User not found", 404, "USER_NOT_FOUND");

  const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
  if (!isMatch) {
    throw new AppError("Current password is incorrect", 401, "INVALID_PASSWORD");
  }

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);
  // Bump token_version: every previously issued cookie is rejected by
  // verifyUser from this point on (true revocation, not just flags).
  await db.execute("UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?", [
    newHash,
    userId,
  ]);
  await db.execute("UPDATE user_sessions SET is_current = 0 WHERE user_id = ?", [userId]);

  // Fresh identity for the re-issued session cookie + the security email.
  const [[fresh]] = await db.execute(
    "SELECT name, email, token_version FROM users WHERE id = ?",
    [userId],
  );
  return { name: fresh.name, email: fresh.email, tokenVersion: Number(fresh.token_version) };
}

// ─── LOGOUT ───
async function logout(userId) {
  if (!userId) return;
  // Bump token_version so the logged-out cookie can never be replayed.
  await db.execute("UPDATE users SET is_online = 0, token_version = token_version + 1 WHERE id = ?", [
    userId,
  ]);
  await db.execute("UPDATE user_sessions SET is_current = 0 WHERE user_id = ?", [userId]);
}

// ─── RESEND VERIFICATION ───
// Returns null when nothing should be sent (unknown / already verified) so the
// controller can keep the response identical (anti-enumeration).
async function resendVerification(email) {
  const [users] = await db.execute("SELECT id, name, is_verified FROM users WHERE email = ?", [
    email,
  ]);
  if (users.length === 0) return null;
  const user = users[0];
  if (user.is_verified) return null;

  const { link } = await createVerificationToken(user.id);
  let emailed = false;
  try {
    await sendVerificationEmail(email, link);
    emailed = true;
  } catch (mailErr) {
    console.error("Verification email failed (SMTP?):", mailErr.message);
  }
  return { link, emailed };
}

// ─── VERIFY EMAIL ───
async function verifyEmail(token) {
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const [rows] = await db.execute(
    `SELECT id, user_id FROM email_verifications
     WHERE token_hash = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
    [tokenHash],
  );
  if (rows.length === 0) {
    throw new AppError(
      "This verification link is invalid or expired. Request a new one.",
      400,
      "INVALID_TOKEN",
    );
  }
  await db.execute("UPDATE email_verifications SET used = 1 WHERE id = ?", [rows[0].id]);
  await db.execute("UPDATE users SET is_verified = 1 WHERE id = ?", [rows[0].user_id]);
}

// ─── CHANGE EMAIL (typo fix, unverified accounts only) ───
async function changeEmail({ email, password, newEmail }) {
  const genericFail = () => new AppError("Invalid credentials or account state.", 400, "GENERIC_FAIL");

  const [users] = await db.execute(
    "SELECT id, email, password, is_verified FROM users WHERE email = ?",
    [String(email).toLowerCase()],
  );
  if (users.length === 0) throw genericFail();
  const user = users[0];
  if (user.is_verified) throw genericFail();

  const isMatch = await bcrypt.compare(password, user.password);
  // Anti-enumeration: wrong password returns the same generic 400 as
  // unknown account / already-verified.
  if (!isMatch) throw genericFail();

  const normalized = String(newEmail).toLowerCase().trim();
  const oldEmail = String(user.email).toLowerCase();
  if (normalized === oldEmail) throw genericFail();

  try {
    await db.execute("UPDATE users SET email = ? WHERE id = ?", [normalized, user.id]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      throw new AppError("That email is already registered.", 400, "EMAIL_EXISTS");
    }
    throw err;
  }

  // Notify the OLD inbox best-effort (typo address may bounce — never fail).
  try {
    await sendEmailChangedNotice(oldEmail, normalized);
  } catch (noticeErr) {
    console.warn("Change-email notice to old address failed:", noticeErr.message);
  }

  const { link } = await createVerificationToken(user.id);
  let emailed = false;
  try {
    await sendVerificationEmail(normalized, link);
    emailed = true;
  } catch (mailErr) {
    console.error("Verification email failed (SMTP?):", mailErr.message);
  }

  return { normalized, link, emailed };
}

// ─── COMPLETE ONBOARDING ───
// `allergies` (optional array from the onboarding wizard) replaces the user's
// allergy list. It is auxiliary data: if the table is missing (pre-migration)
// we log loudly instead of throwing, so the onboarding flag still gets set.
async function completeOnboarding(userId, allergies) {
  await db.execute("UPDATE users SET onboarding_completed = 1 WHERE id = ?", [userId]);
  if (Array.isArray(allergies)) {
    try {
      await allergiesService.setAllergies(userId, allergies);
    } catch (e) {
      console.error("[allergies] save failed — run db:migrate (033_user_allergies):", e.message);
    }
  }
}

// Read-only passthrough so Profile > Personalization can display current
// allergies. Best-effort by design: getAllergies returns [] on any DB failure.
async function getAllergies(userId) {
  return allergiesService.getAllergies(userId);
}

module.exports = {
  // helpers
  normEmail,
  resolveFrontendUrl,
  frontendUrl,
  DEV_VERIFY_FALLBACK,
  VERIFICATION_REQUIRED,
  createVerificationToken,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
  logUserSession,
  // handlers
  getMe,
  register,
  login,
  deactivateAccount,
  reactivateAccount,
  googleLogin,
  changePassword,
  logout,
  resendVerification,
  verifyEmail,
  changeEmail,
  completeOnboarding,
  getAllergies,
};
