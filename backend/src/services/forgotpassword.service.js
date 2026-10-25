// Password reset (email OTP) — business logic + DB access.
// Flow: POST /send-otp → POST /verify-otp → POST /reset-password
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { AppError } = require("../utils/errors");
const { sendPasswordResetOtpEmail } = require("./email.service");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_LOCK_AFTER = 10;
const OTP_LOCK_MS = 15 * 60 * 1000;

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Per-email OTP brute-force guard (second layer behind IP rate-limit).
// 6-digit OTP must not be guessable by rotating IPs.
const otpFailures = new Map();

function checkOtpLock(email) {
  const rec = otpFailures.get(normEmail(email));
  if (!rec) return null;
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    return Math.ceil((rec.lockedUntil - Date.now()) / 1000);
  }
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) otpFailures.delete(normEmail(email));
  return null;
}

function recordOtpFailure(email) {
  const key = normEmail(email);
  const rec = otpFailures.get(key) || { count: 0 };
  rec.count += 1;
  if (rec.count >= OTP_LOCK_AFTER) rec.lockedUntil = Date.now() + OTP_LOCK_MS;
  otpFailures.set(key, rec);
}

function clearOtpFailures(email) {
  otpFailures.delete(normEmail(email));
}

// Anti-enumeration: unknown emails behave exactly like a successful send.
// Returns the (existing) recipient email or null when nothing was sent.
async function requestResetCode(email) {
  const [users] = await db.execute("SELECT id, name FROM users WHERE email = ?", [email]);
  if (users.length === 0) return null;

  const user = users[0];

  // Invalidate any existing unused OTPs for this user
  await db.execute("UPDATE password_reset_otps SET used = 1 WHERE user_id = ? AND used = 0", [
    user.id,
  ]);

  // Generate 6-digit OTP with a CSPRNG
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hash(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.execute(
    "INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES (?, ?, ?)",
    [user.id, otpHash, expiresAt],
  );

  // Throws → caller surfaces 500; the OTP row stays valid for retry.
  await sendPasswordResetOtpEmail(email, user.name, otp);

  return email;
}

// Verifies the OTP and swaps its hash for a short-lived reset token (5 min).
async function verifyResetCode(email, otp) {
  const lockedSecs = checkOtpLock(email);
  if (lockedSecs) {
    throw new AppError(
      `Too many incorrect codes. Try again in ${Math.ceil(lockedSecs / 60)} minutes.`,
      429,
      "OTP_LOCKED",
    );
  }

  const [users] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (users.length === 0) {
    recordOtpFailure(email);
    // Identical message as wrong-code path (anti-enumeration)
    throw new AppError("Invalid or expired code.", 400, "INVALID_CODE");
  }

  const user = users[0];
  const [otps] = await db.execute(
    `SELECT id FROM password_reset_otps
     WHERE user_id = ? AND otp_hash = ? AND used = 0 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [user.id, hash(otp)],
  );

  if (otps.length === 0) {
    recordOtpFailure(email);
    throw new AppError("Invalid or expired code.", 400, "INVALID_CODE");
  }
  clearOtpFailures(email);

  // The row stays usable until reset consumes it (used = 1), so one OTP
  // yields one password reset.
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpiry = new Date(Date.now() + RESET_TTL_MS);

  await db.execute(
    "UPDATE password_reset_otps SET otp_hash = ?, expires_at = ?, used = 0 WHERE id = ? AND used = 0",
    [hash(resetToken), resetExpiry, otps[0].id],
  );

  return resetToken;
}

async function resetPassword(email, resetToken, newPassword) {
  const [users] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (users.length === 0) {
    throw new AppError("Invalid request.", 400, "INVALID_REQUEST");
  }

  const user = users[0];
  const [otps] = await db.execute(
    `SELECT id FROM password_reset_otps
     WHERE user_id = ? AND otp_hash = ? AND used = 0 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [user.id, hash(resetToken)],
  );

  if (otps.length === 0) {
    throw new AppError("Reset session expired. Please start over.", 400, "RESET_EXPIRED");
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);

  // Bump token_version: a password reset kills every existing session.
  await db.execute(
    "UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?",
    [hashed, user.id],
  );

  // Consume the reset token
  await db.execute("UPDATE password_reset_otps SET used = 1 WHERE id = ?", [otps[0].id]);

  // Invalidate all active sessions
  await db.execute("UPDATE user_sessions SET is_current = 0 WHERE user_id = ?", [user.id]);
}

module.exports = {
  normEmail,
  requestResetCode,
  verifyResetCode,
  resetPassword,
  // exposed for tests / introspection
  checkOtpLock,
  recordOtpFailure,
  clearOtpFailures,
};
