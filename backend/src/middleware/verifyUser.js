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
  } catch {
    clearSessionCookie(req, res);
    return res.status(401).json({ error: 'Invalid session' });
  }

  // Enforces verification + token_version (logout/password change revokes cookies).
  try {
    const db = require('../config/db');
    const [rows] = await db.execute(
      'SELECT id, email, is_verified, token_version FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    if (rows.length === 0) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Invalid session' });
    }
    const u = rows[0];
    if (!u.is_verified) {
      return res.status(403).json({ error: 'Email verification required.', code: 'NEEDS_VERIFICATION' });
    }
    if (Number(u.token_version || 0) !== Number(decoded.tv || 0)) {
      clearSessionCookie(req, res);
      return res.status(401).json({ error: 'Session revoked. Please sign in again.', code: 'SESSION_REVOKED' });
    }
    req.user = { id: u.id, email: u.email };
    next();
  } catch (e) {
    next(e);
  }
};

module.exports = verifyUser;
module.exports.COOKIE_NAME = COOKIE_NAME;