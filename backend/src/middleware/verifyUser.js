const jwt = require('jsonwebtoken');
const { COOKIE_NAME, getClearCookieOptions } = require('../utils/cookies');
const { verifySession } = require('../config/jwt');

function clearSessionCookie(req, res) {
  // Clear stale cookie with the same options so the browser actually drops it
  try {
    res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
  } catch (_) {}
}

const verifyUser = async (req, res, next) => {
  // Cookie-only (no Bearer fallback) so XSS can't steal a token from storage.
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let decoded;
  try {
    decoded = verifySession(jwt, token);
    if (!decoded?.id) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Invalid session' });
    }
  } catch (err) {
    clearSessionCookie(req, res);
    return res.status(401).json({ error: 'Invalid session' });
  }

  // Enforces token_version (logout/password change revokes cookies) + soft-
  // deactivation gate (Module 1: a deactivated account loses all routes).
  // Verification is soft (Option A): unverified sessions are valid — the app
  // shows a reminder banner. is_verified rides on req.user for any endpoint
  // that needs to treat it as advisory.
  try {
    const db = require('../config/db');
    const [rows] = await db.execute(
      'SELECT id, email, is_verified, token_version, status, role, accepted_terms_at, accepted_terms_version FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    if (rows.length === 0) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Invalid session' });
    }
    const u = rows[0];
    if (u.status === 'deactivated') {
      clearSessionCookie(req, res);
      return res.status(403).json({ error: 'Account deactivated', code: 'ACCOUNT_DEACTIVATED' });
    }
    if (Number(u.token_version || 0) !== Number(decoded.tv || 0)) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Session revoked. Please sign in again.', code: 'SESSION_REVOKED' });
    }
    req.user = {
      id: u.id,
      email: u.email,
      is_verified: Boolean(u.is_verified),
      role: u.role || 'member',
      status: u.status,
      accepted_terms_at: u.accepted_terms_at,
      accepted_terms_version: u.accepted_terms_version,
    };
    next();
  } catch (e) {
    next(e);
  }
};

// Module 1 — admin gate for governance endpoints (Module 7 builds the panel
// on this). Reads the role already loaded by verifyUser — zero extra queries.
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN_ADMIN' });
  }
  next();
}

// Role middleware — member-only gate. Mirror of requireAdmin: an admin hitting
// a member-app endpoint (dashboard, logs, plans, meal tracker…) is bounced
// with 403 so the admin role can't spray member endpoints directly. The
// frontend counterpart (MemberRoute / AdminRoute) is what handles the
// redirect-to-own-dashboard UX; this is the API-level enforcement.
function requireMember(req, res, next) {
  if (req.user?.role === 'admin') {
    return res.status(403).json({
      error: 'This is a member-only endpoint. Admins use /api/admin.',
      code: 'FORBIDDEN_MEMBER',
    });
  }
  next();
}

// Generic variant for future role needs (e.g. moderator). Valid roles only —
// fails closed for anything the verifyUser role column doesn't carry.
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: `Role '${role}' required`, code: 'FORBIDDEN_ROLE' });
    }
    next();
  };
}

module.exports = verifyUser;
module.exports.COOKIE_NAME = COOKIE_NAME;
module.exports.requireAdmin = requireAdmin;
module.exports.requireMember = requireMember;
module.exports.requireRole = requireRole;