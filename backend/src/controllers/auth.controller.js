const db = require('../config/db');
const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const { z }      = require('zod');
const { COOKIE_NAME, getClearCookieOptions } = require('../utils/cookies');
const { sendVerificationEmail } = require('../config/mailer');
const log = require('../utils/logger');
const { normEmail, checkRateLimit, recordFailedAttempt, clearAttempts } = require('../services/loginThrottle');
const { DEV_VERIFY_FALLBACK, createVerificationToken } = require('../services/verification');
const { googleClient } = require('../services/googleAuth');
const { setSessionCookie, logUserSession } = require('../services/session');

// IP-based brute-force guard (primary) — per-email Map in services/loginThrottle is the second layer
const loginIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a minute.' },
});

// ─── VALIDATION SCHEMAS ───
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name too short').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  fitness_goal: z.string().trim().max(100).optional().default('general fitness'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(128),
});

const googleLoginSchema = z.object({
  code: z.string().trim().min(1, 'Google auth code is required').max(4096),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required').max(128),
  newEmail: z.string().trim().toLowerCase().email('Invalid new email address'),
});

// ─── GET /api/auth/me ───

// Session probe. Returns 401 (not 200-null) for missing/dead sessions so the
// frontend 401-funnel (apiClient → vitalis:unauthorized → logout) actually
// fires and stale cookies are dropped instead of lingering forever.
async function getme(req,res,next){
  try{
      const token = req.cookies?.[COOKIE_NAME];

      // Codes let the frontend/console distinguish "browser never sent the
      // cookie" (NO_COOKIE — cross-site/tunnel issue) from "cookie sent but
      // dead" (INVALID_SESSION) without leaking anything sensitive.
      if (!token) {
        if (process.env.NODE_ENV !== 'production') {
          const h = req.headers || {};
          log.debug(
            `[me] NO_COOKIE origin=${h.origin || '-'} referer=${String(h.referer || '-').slice(0, 80)} ` +
            `cookieHeader=${req.headers.cookie ? `present(${req.headers.cookie.length}c)` : 'absent'}`
          );
        }
        return res.status(401).json({ error: 'Unauthorized', code: 'NO_COOKIE', user: null });
      }

      try {
        const { verifySession } = require('../config/jwt');
        const decoded = verifySession(jwt, token);

        const [rows] = await db.execute(`
          SELECT
            u.id,
            u.name,
            u.email,
            u.fitness_goal,
            u.is_verified,
            u.onboarding_completed,
            u.token_version,
            p.avatar_url AS avatar
          FROM users u
          LEFT JOIN user_profiles p ON p.user_id = u.id
          WHERE u.id = ?
        `, [decoded.id]);

        if (rows.length === 0) {
          res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
          return res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION', user: null });
        }

        const user = rows[0];
        // Revocation gate (mirrors verifyUser): logout / password change /
        // password reset bump token_version — cookies minted before that must
        // die here too, not linger for the JWT's full 12h.
        // NOTE: is_verified is intentionally NOT enforced — unverified users
        // get 200 with isVerified:false so the frontend routes them to
        // /check-email instead of logging them out.
        if (Number(user.token_version || 0) !== Number(decoded.tv || 0)) {
          res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
          return res.status(401).json({ error: 'Session revoked. Please sign in again.', code: 'SESSION_REVOKED', user: null });
        }
        res.json({
          user: {
            id:     user.id,
            name:   user.name,
            email:  user.email,
            avatar: user.avatar,
            goal:   user.fitness_goal,
            isVerified:          Boolean(user.is_verified),
            onboardingCompleted: Boolean(user.onboarding_completed),
          },
        });
      } catch {
        res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
        return res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION', user: null });
      }
  }catch(e){ next(e); }
}

async function postregister(req,res,next){
  try{
      const { name, password, fitness_goal = 'general fitness' } = req.body;
      // Normalize email BEFORE any DB touch — schemas lowercase, but the
      // validate() middleware can be bypassed, so never trust raw casing.
      const email = normEmail(req.body?.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
    
      try {
        const [existing] = await db.execute(
          'SELECT email FROM users WHERE email = ?', [email]
        );
        if (existing.length > 0) {
          return res.status(400).json({ error: 'Email already registered in Vitalis labs.' });
        }
    
        const salt     = await bcrypt.genSalt(10);
        const hashedPw = await bcrypt.hash(password, salt);

        const [insertResult] = await db.execute(
          'INSERT INTO users (name, email, password, fitness_goal, is_online, is_verified, onboarding_completed) VALUES (?, ?, ?, ?, ?, 0, 0)',
          [name, email, hashedPw, fitness_goal, 0]
        );
        const newUserId = insertResult.insertId;

        // Email verification (link-based). Never block registration on SMTP.
        const { link } = await createVerificationToken(newUserId);
        let emailed = false;
        try {
          await sendVerificationEmail(email, link);
          emailed = true;
        } catch (mailErr) {
          log.error('Verification email failed (SMTP?):', mailErr.message);
        }

        const payload = { success: true, message: 'Account created. Check your email to verify.', needsVerification: true, email };
        if (!emailed && DEV_VERIFY_FALLBACK) payload.devVerificationLink = link;
        res.status(201).json(payload);
      } catch (err) {
        log.error('Register error:', err.code || err.message);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Email already registered in Vitalis labs.' });
        }
        next(err);
      }
  }catch(e){ next(e); }
}

async function postlogin(req,res,next){
  try{
      const { password } = req.body;
      const email = normEmail(req.body?.email);
    
      const lockStatus = checkRateLimit(email);
      if (lockStatus) {
        return res.status(429).json({
          error:    lockStatus.error,
          retryAfter: lockStatus.retryAfter,
        });
      }
    
      try {
        const [users] = await db.execute(
          'SELECT id, name, email, password, fitness_goal, avatar_url, is_verified, onboarding_completed, is_online, token_version FROM users WHERE email = ?', [email]
        );
    
        if (users.length === 0) {
          recordFailedAttempt(email);
          return res.status(401).json({ error: 'Invalid credentials' });
        }
    
        const user    = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
    
        if (!isMatch) {
          const attempts = recordFailedAttempt(email);
    
          let hint = 'Invalid credentials';
          if (attempts >= 20) hint = 'Too many failed attempts. Try again in 30 minutes.';
          else if (attempts >= 10) hint = 'Too many failed attempts. Try again in 30 seconds.';
    
          return res.status(401).json({ error: hint });
        }
    
        clearAttempts(email);

        if (!user.is_verified) {
          return res.status(403).json({
            error: 'Please verify your email before signing in. Check your inbox for the verification link.',
            code: 'NEEDS_VERIFICATION',
            email: user.email,
          });
        }

        await db.execute('UPDATE users SET is_online = 1 WHERE id = ?', [user.id]);
    
        const [profileRows] = await db.execute(
          'SELECT avatar_url FROM user_profiles WHERE user_id = ?', [user.id]
        );
        const latestAvatar = profileRows[0]?.avatar_url || user.avatar_url || null;
    
        setSessionCookie(res, user.id, user.email, req, user.token_version);
        await logUserSession(req, user.id);

        res.json({
          id:     user.id,
          name:   user.name,
          email:  user.email,
          avatar: latestAvatar,
          goal:   user.fitness_goal,
          isVerified:          Boolean(user.is_verified),
          onboardingCompleted: Boolean(user.onboarding_completed),
        });
      } catch (err) {
        log.error('Login error:', err.code || err.message);
        next(err);
      }
  }catch(e){ next(e); }
}

async function postgoogleLogin(req,res,next){
  try{
      const { code } = req.body;
    
      if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' });
      }
    
      try {
        // Exchange auth code for tokens
        const { tokens } = await googleClient.getToken({
          code,
          redirect_uri: 'postmessage',
        });
    
        if (!tokens.id_token) {
          return res.status(401).json({ error: 'No ID token returned from Google' });
        }
    
        // Verify the ID token
        const ticket = await googleClient.verifyIdToken({
          idToken:  tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
    
        const payload                  = ticket.getPayload();
        const { name, picture } = payload;
        const email = normEmail(payload.email);
    
        if (!email) {
          return res.status(401).json({ error: 'Google account has no email' });
        }
    
        // Check if user exists
        const [users] = await db.execute(
          'SELECT id, name, email, password, fitness_goal, avatar_url, is_verified, onboarding_completed, is_online, token_version FROM users WHERE email = ?', [email]
        );
    
        let user;
    
if (users.length === 0) {
          // Create new user. Password is a random bcrypt secret (never known,
          // never used for login) — account recovery goes through the
          // email-OTP forgot-password flow, which overwrites it.
          const salt           = await bcrypt.genSalt(10);
          const randomHashedPw = await bcrypt.hash(
            crypto.randomBytes(16).toString('hex'), salt
          );
          const defaultGoal = 'Unspecified (Google Auth)';

          const [insertResult] = await db.execute(
            'INSERT INTO users (name, email, password, fitness_goal, is_online, avatar_url, is_verified, onboarding_completed) VALUES (?, ?, ?, ?, ?, ?, 1, 0)',
            [name, email, randomHashedPw, defaultGoal, 1, picture]
          );

          const [newUsers] = await db.execute(
            'SELECT id, name, email, fitness_goal, avatar_url, is_verified, onboarding_completed, token_version FROM users WHERE id = ?', [insertResult.insertId]
          );
          user = newUsers[0];
        } else {
          user = users[0];
          // Google-verified email counts as verified
          await db.execute('UPDATE users SET is_online = 1, is_verified = 1 WHERE id = ?', [user.id]);
          user.is_verified = 1;
        }
    
        const [profileRows] = await db.execute(
          'SELECT avatar_url FROM user_profiles WHERE user_id = ?', [user.id]
        );
        const latestAvatar = profileRows[0]?.avatar_url || user.avatar_url || picture;
    
        setSessionCookie(res, user.id, user.email, req, user.token_version);
        await logUserSession(req, user.id);
    
        res.json({
          id:     user.id,
          name:   user.name,
          email:  user.email,
          avatar: latestAvatar,
          goal:   user.fitness_goal,
          isVerified:          true,
          onboardingCompleted: Boolean(user.onboarding_completed),
        });
      } catch (err) {
        log.error('Google Login Error:', err.code || err.message);
        // Don't leak provider internals (tokens, audience mismatches) to the client
        return res.status(401).json({ error: 'Google authentication failed', code: 'GOOGLE_AUTH_FAILED' });
      }
  }catch(e){ next(e); }
}

async function postchangePassword(req,res,next){
  try{
      // verifyUser middleware already populated req.user — use it as source of truth.
      // Cookie-only: no Bearer fallback.
      let userId = req.user?.id || null;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const decoded = { id: userId };
    
      const { currentPassword, newPassword } = req.body;
    
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
    
      try {
        const [rows] = await db.execute(
          'SELECT password FROM users WHERE id = ?', [decoded.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
        const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!isMatch) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
    
        const salt    = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);
        // Bump token_version: every previously issued cookie is rejected by
        // verifyUser from this point on (true revocation, not just flags).
        await db.execute('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?', [newHash, decoded.id]);
        await db.execute('UPDATE user_sessions SET is_current = 0 WHERE user_id = ?', [decoded.id]);

        res.json({ success: true, message: 'Password updated' });
      } catch (err) {
        log.error('Change Password Error:', err.code || err.message);
        next(err);
      }
  }catch(e){ next(e); }
}

async function postlogout(req,res,next){
  try{
      const token = req.cookies?.[COOKIE_NAME];
    
      if (token) {
        try {
          const { verifySession } = require('../config/jwt');
          const decoded = verifySession(jwt, token);
          if (decoded?.id) {
            // Bump token_version so the logged-out cookie can never be replayed.
            await db.execute('UPDATE users SET is_online = 0, token_version = token_version + 1 WHERE id = ?', [decoded.id]);
            await db.execute('UPDATE user_sessions SET is_current = 0 WHERE user_id = ?', [decoded.id]);
          }
        } catch (_) {}
      }
    
      res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
      res.json({ success: true, message: 'User logged out.' });
  }catch(e){ next(e); }
}

// ─── POST /api/auth/send-verification { email } — (re)send verification link
async function postsendVerification(req,res,next){
  try{
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const normalized = String(email).toLowerCase().trim();
      const [users] = await db.execute(
        'SELECT id, name, is_verified FROM users WHERE email = ?', [normalized]
      );
      // Anti-enumeration: identical response whether account exists or not,
      // and whether already verified or not.
      const generic = { success: true, message: 'If that account exists, a verification email was sent.', email: normalized };
      if (users.length === 0) return res.json(generic);
      const user = users[0];
      if (user.is_verified) return res.json(generic);

      const { link } = await createVerificationToken(user.id);
      let emailed = false;
      try {
        await sendVerificationEmail(normalized, link);
        emailed = true;
      } catch (mailErr) {
        log.error('Verification email failed (SMTP?):', mailErr.message);
      }
      const payload = { ...generic };
      if (!emailed && DEV_VERIFY_FALLBACK) payload.devVerificationLink = link;
      res.json(payload);
  }catch(e){ next(e); }
}

// ─── GET /api/auth/verify-email?token=... — activate account via link
async function getverifyEmail(req,res,next){
  try{
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: 'Verification token is required' });
      const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
      const [rows] = await db.execute(
        `SELECT id, user_id FROM email_verifications
         WHERE token_hash = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
        [tokenHash]
      );
      if (rows.length === 0) {
        return res.status(400).json({ error: 'This verification link is invalid or expired. Request a new one.' });
      }
      await db.execute('UPDATE email_verifications SET used = 1 WHERE id = ?', [rows[0].id]);
      await db.execute('UPDATE users SET is_verified = 1 WHERE id = ?', [rows[0].user_id]);
      res.json({ success: true, message: 'Email verified. Your Vitalis account is now active.' });
  }catch(e){ next(e); }
}

// ─── PATCH /api/auth/change-email { email, password, newEmail } — fix a typo before verifying
async function patchchangeEmail(req,res,next){
  try{
      const { email, password, newEmail } = req.body;
      if (!email || !password || !newEmail) {
        return res.status(400).json({ error: 'Current email, password and new email are required' });
      }
      const genericFail = { error: 'Invalid credentials or account state.' };
      const [users] = await db.execute('SELECT id, email, password, is_verified FROM users WHERE email = ?', [String(email).toLowerCase()]);
      if (users.length === 0) return res.status(400).json(genericFail);
      const user = users[0];
      if (user.is_verified) return res.status(400).json(genericFail);
      const isMatch = await bcrypt.compare(password, user.password);
      // Anti-enumeration: wrong password returns the same generic 400 as
      // unknown account / already-verified, so attackers can't probe which
      // emails exist. Typo-fix flow stays unauthenticated by design (unverified
      // users can't pass verifyUser which 403s NEEDS_VERIFICATION) — password
      // check + 5/15m limiter + old-inbox notice is the guard.
      if (!isMatch) return res.status(400).json(genericFail);

      const normalized = String(newEmail).toLowerCase().trim();
      const oldEmail = String(user.email).toLowerCase();
      if (normalized === oldEmail) return res.status(400).json(genericFail);
      try {
        await db.execute('UPDATE users SET email = ? WHERE id = ?', [normalized, user.id]);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'That email is already registered.' });
        throw err;
      }
      // Typo-fix flow is unverified-only + password-checked, but a stolen
      // session could still swap the address: notify the OLD inbox best-effort
      // (typo address may bounce — never fail the request on it).
      try {
        const { getTransporter } = require('../config/mailer');
        await getTransporter().sendMail({
          from: process.env.EMAIL_USER,
          to: oldEmail,
          subject: 'Your Vitalis email was changed',
          html: `<p>Your Vitalis account email was changed to ${normalized}. If this wasn't you, reset your password immediately.</p>`,
        });
      } catch (noticeErr) {
        log.warn('Change-email notice to old address failed:', noticeErr.message);
      }
      const { link } = await createVerificationToken(user.id);
      let emailed = false;
      try {
        await sendVerificationEmail(normalized, link);
        emailed = true;
      } catch (mailErr) {
        log.error('Verification email failed (SMTP?):', mailErr.message);
      }
      const payload = { success: true, message: 'Email updated. Check your new inbox to verify.', email: normalized };
      if (!emailed && DEV_VERIFY_FALLBACK) payload.devVerificationLink = link;
      res.json(payload);
  }catch(e){ next(e); }
}

// ─── POST /api/auth/complete-onboarding — mark onboarding done (verified users)
async function postcompleteOnboarding(req,res,next){
  try{
      await db.execute('UPDATE users SET onboarding_completed = 1 WHERE id = ?', [req.user.id]);
      res.json({ success: true });
  }catch(e){ next(e); }
}

module.exports = { getme, postregister, postlogin, postgoogleLogin, postchangePassword, postlogout, postsendVerification, getverifyEmail, patchchangeEmail, postcompleteOnboarding, registerSchema, loginSchema, googleLoginSchema, changePasswordSchema, changeEmailSchema, loginIpLimiter };
