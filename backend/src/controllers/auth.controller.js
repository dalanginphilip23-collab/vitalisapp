// Auth — thin controller. Logic + DB live in services/auth.service.js.
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { COOKIE_NAME, getCookieOptions, getClearCookieOptions } = require("../utils/cookies");
const service = require("../services/auth.service");
const emailService = require("../services/email.service");
const notificationController = require("./notification.controller");

const { normEmail, DEV_VERIFY_FALLBACK } = service;

// ─── COOKIE HELPER (single source: src/utils/cookies.js) ───
function setSessionCookie(res, userId, email, req, tv = 0) {
  const { signSession } = require("../config/jwt");
  const token = signSession(jwt, { id: userId, email, tv });
  const opts = getCookieOptions(req);
  res.cookie(COOKIE_NAME, token, opts);
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[cookie] set uid=${userId} secure=${opts.secure} sameSite=${opts.sameSite} ` +
        `partitioned=${Boolean(opts.partitioned)} proto=${req.headers?.["x-forwarded-proto"] || "-"}`,
    );
  }
  return token;
}

// IP-based brute-force guard (primary) — per-email Map in the service is layer 2.
const loginIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a minute." },
});

// ─── VALIDATION SCHEMAS ───
const registerSchema = z.object({
  name: z.string().trim().min(2, "Name too short").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  // Module 1 — explicit consent flag must survive schema validation.
  agreed: z.boolean().optional().default(false),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

const googleLoginSchema = z.object({
  code: z.string().trim().min(1, "Google auth code is required").max(4096),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(128),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(128),
  newEmail: z.string().trim().toLowerCase().email("Invalid new email address"),
});

// ─── GET /api/auth/me ───
// Session probe. Returns 401 (not 200-null) for missing/dead sessions so the
// frontend 401-funnel fires and stale cookies are dropped.
async function getme(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    // Codes distinguish "browser never sent the cookie" (NO_COOKIE) from
    // "cookie sent but dead" (INVALID_SESSION).
    if (!token) {
      if (process.env.NODE_ENV !== "production") {
        const h = req.headers || {};
        console.log(
          `[me] NO_COOKIE origin=${h.origin || "-"} referer=${String(h.referer || "-").slice(0, 80)} ` +
            `cookieHeader=${req.headers.cookie ? `present(${req.headers.cookie.length}c)` : "absent"}`,
        );
      }
      return res.status(401).json({ error: "Unauthorized", code: "NO_COOKIE", user: null });
    }

    try {
      const { verifySession } = require("../config/jwt");
      const decoded = verifySession(jwt, token);

      const user = await service.getMe(decoded.id);

      if (!user) {
        res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
        return res
          .status(401)
          .json({ error: "Invalid session", code: "INVALID_SESSION", user: null });
      }

      // Revocation gate (mirrors verifyUser). is_verified is intentionally NOT
      // enforced — unverified users get 200 with isVerified:false.
      if (Number(user.token_version || 0) !== Number(decoded.tv || 0)) {
        res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
        return res.status(401).json({
          error: "Session revoked. Please sign in again.",
          code: "SESSION_REVOKED",
          user: null,
        });
      }
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          goal: user.fitness_goal,
          isVerified: Boolean(user.is_verified),
          onboardingCompleted: Boolean(user.onboarding_completed),
          // Module 1 — governance fields surfaced to the Profile page.
          role: user.role,
          status: user.status,
          acceptedTermsAt: user.accepted_terms_at,
          acceptedTermsVersion: user.accepted_terms_version,
        },
      });
    } catch (err) {
      res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
      return res
        .status(401)
        .json({ error: "Invalid session", code: "INVALID_SESSION", user: null });
    }
  } catch (e) {
    next(e);
  }
}

async function postregister(req, res, next) {
  try {
    const { name, password } = req.body;
    // Normalize email BEFORE any DB touch — never trust raw casing.
    const email = normEmail(req.body?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    // Module 1 — consent is a hard requirement, recorded server-side with a
    // version stamp; the client checkbox alone is not an audit trail.
    if (req.body?.agreed !== true) {
      return res.status(400).json({ error: "You must accept the Terms of Use and Privacy Policy" });
    }

    try {
      const { link, emailed, autoVerified, user } = await service.register({
        name,
        email,
        password,
      });

      // Soft verification (Option A) — register IS sign in: issue the session
      // immediately and let the app route straight to onboarding/dashboard.
      // The verify email still goes out and flips is_verified when clicked;
      // until then the app shows an in-app reminder instead of a wall.
      setSessionCookie(res, user.id, user.email, req, user.token_version);
      await service.logUserSession(req, user.id);

      /** @type {{ success: boolean, message: string, id: number, name: string, email: string, avatar: string|null, goal: string, isVerified: boolean, onboardingCompleted: boolean, role: string, status: string, acceptedTermsAt: string|null, acceptedTermsVersion: number|null, needsVerification: boolean, devVerificationLink?: string }} */
      const payload = {
        success: true,
        message: autoVerified
          ? "Account created. You can sign in now."
          : "Account created. You're signed in — check your inbox to confirm your email.",
        // Same shape /login and /me return so AuthContext stays consistent.
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar_url || null,
        goal: user.fitness_goal,
        isVerified: Boolean(user.is_verified),
        onboardingCompleted: Boolean(user.onboarding_completed),
        role: user.role,
        status: user.status,
        acceptedTermsAt: user.accepted_terms_at,
        acceptedTermsVersion: user.accepted_terms_version,
        needsVerification: !autoVerified,
      };
      if (payload.needsVerification && !emailed && DEV_VERIFY_FALLBACK) {
        payload.devVerificationLink = link;
      }
      res.status(201).json(payload);
    } catch (err) {
      if (err.isOperational) return res.status(err.status).json({ error: err.message });
      console.error("Register error:", err.code || err.message);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postlogin(req, res, next) {
  try {
    const { password } = req.body;
    const email = normEmail(req.body?.email);

    try {
      const { user, latestAvatar } = await service.login({ email, password });

      setSessionCookie(res, user.id, user.email, req, user.token_version);
      await service.logUserSession(req, user.id);

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: latestAvatar,
        goal: user.fitness_goal,
        isVerified: Boolean(user.is_verified),
        onboardingCompleted: Boolean(user.onboarding_completed),
        // Module 1 — keep the auth-context user shape identical to /me.
        role: user.role,
        status: user.status,
        acceptedTermsAt: user.accepted_terms_at,
        acceptedTermsVersion: user.accepted_terms_version,
      });
    } catch (err) {
      if (err.isOperational) {
        const body = { error: err.message };
        if (err.code === "RATE_LIMITED" && err.details?.retryAfter) {
          body.retryAfter = err.details.retryAfter;
        }
        if (err.code === "NEEDS_VERIFICATION") {
          body.code = "NEEDS_VERIFICATION";
          body.email = err.details?.email;
        }
        if (err.code === "ACCOUNT_DEACTIVATED") {
          body.code = "ACCOUNT_DEACTIVATED";
        }
        return res.status(err.status).json(body);
      }
      console.error("Login error:", err.code || err.message);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postgoogleLogin(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
      const { user, latestAvatar } = await service.googleLogin(code);

      setSessionCookie(res, user.id, user.email, req, user.token_version);
      await service.logUserSession(req, user.id);

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: latestAvatar,
        goal: user.fitness_goal,
        isVerified: true,
        onboardingCompleted: Boolean(user.onboarding_completed),
      });
    } catch (err) {
      // Known provider states keep their specific message; anything else is
      // masked so tokens/audience details never leak to the client.
      if (err.isOperational && err.code !== "GOOGLE_AUTH_FAILED") {
        return res.status(err.status).json({ error: err.message });
      }
      console.error("Google Login Error:", err.code || err.message);
      return res
        .status(401)
        .json({ error: "Google authentication failed", code: "GOOGLE_AUTH_FAILED" });
    }
  } catch (e) {
    next(e);
  }
}

async function postchangePassword(req, res, next) {
  try {
    // verifyUser middleware already populated req.user — use it as source of truth.
    const userId = req.user?.id || null;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    try {
      const result = await service.changePassword(userId, currentPassword, newPassword);
      const changedAt = new Date().toISOString();

      // Keep THIS device signed in: re-issue the session cookie with the fresh
      // token_version (all other devices were just revoked by the bump).
      setSessionCookie(res, userId, result.email, req, result.tokenVersion);

      // 1) In-app notification — fail-soft, never blocks the response.
      try {
        await notificationController.notifyUser(userId, {
          message: "Your password was changed. All other devices were signed out — if this wasn't you, secure your account now.",
          type: "warning",
          category: "SYSTEM",
        });
      } catch (notifErr) {
        console.error("[change-password] notification failed:", notifErr.message);
      }

      // 2) Security-alert email — distinct reusable template; fail-soft so a
      // mail hiccup can never undo a completed password change.
      let emailSent = false;
      try {
        await emailService.sendPasswordChangedEmail(
          result.email,
          result.name,
          service.frontendUrl(),
          changedAt,
        );
        emailSent = true;
      } catch (mailErr) {
        console.error("[change-password] security email failed:", mailErr.message);
      }

      res.json({
        success: true,
        message: "Password updated — other devices were signed out",
        emailSent,
      });
    } catch (err) {
      if (err.isOperational) return res.status(err.status).json({ error: err.message });
      console.error("Change Password Error:", err.code || err.message);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postlogout(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (token) {
      try {
        const { verifySession } = require("../config/jwt");
        const decoded = verifySession(jwt, token);
        if (decoded?.id) await service.logout(decoded.id);
      } catch (_) {}
    }

    res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
    res.json({ success: true, message: "User logged out." });
  } catch (e) {
    next(e);
  }
}

// ─── POST /api/auth/send-verification { email } — (re)send verification link
async function postsendVerification(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const normalized = String(email).toLowerCase().trim();

    // Anti-enumeration: identical response whether or not the account exists.
    const generic = {
      success: true,
      message: "If that account exists, a verification email was sent.",
      email: normalized,
    };

    const result = await service.resendVerification(normalized);
    if (!result) return res.json(generic);

    /** @type {{ success: boolean, message: string, email: string, devVerificationLink?: string }} */
    const payload = { ...generic };
    if (!result.emailed && DEV_VERIFY_FALLBACK) payload.devVerificationLink = result.link;
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

// ─── GET /api/auth/verify-email?token=... — activate account via link
async function getverifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Verification token is required" });
    try {
      await service.verifyEmail(token);
      res.json({
        success: true,
        message: "Email verified. Your Vitalis account is now active.",
      });
    } catch (err) {
      if (err.isOperational) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

// ─── PATCH /api/auth/change-email — fix a typo before verifying
async function patchchangeEmail(req, res, next) {
  try {
    const { email, password, newEmail } = req.body;
    if (!email || !password || !newEmail) {
      return res
        .status(400)
        .json({ error: "Current email, password and new email are required" });
    }

    try {
      const { normalized, link, emailed } = await service.changeEmail({
        email,
        password,
        newEmail,
      });
      /** @type {{ success: boolean, message: string, email: string, devVerificationLink?: string }} */
      const payload = {
        success: true,
        message: "Email updated. Check your new inbox to verify.",
        email: normalized,
      };
      if (!emailed && DEV_VERIFY_FALLBACK) payload.devVerificationLink = link;
      res.json(payload);
    } catch (err) {
      if (err.isOperational) return res.status(err.status).json({ error: err.message });
      console.error("Change Email Error:", err.code || err.message);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

// ─── POST /api/auth/complete-onboarding — mark onboarding done
async function postcompleteOnboarding(req, res, next) {
  try {
    // Body may carry the wizard's allergy list; absent/{} means "don't touch it".
    const { allergies } = req.body || {};
    await service.completeOnboarding(req.user.id, allergies);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// ─── MODULE 1 — ACCOUNT GOVERNANCE ───
// POST /api/auth/deactivate — password-confirmed soft deactivation. The server
// bumps token_version so every session (this device included) dies instantly;
// the cookie is cleared so the browser drops the session too. Data is kept.
async function postDeactivate(req, res, next) {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Password confirmation is required" });
    }
    await service.deactivateAccount(req.user.id, password);
    // Session is already revoked server-side — drop the cookie client-side.
    res.clearCookie(COOKIE_NAME, getClearCookieOptions(req));
    res.json({
      success: true,
      message: "Account deactivated. Your data is safe — sign in again to reactivate.",
    });
  } catch (err) {
    if (err.isOperational) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

// POST /api/auth/reactivate — credential-verified flip back to active. Does
// NOT log the user in; the client follows up with a normal login so session
// logging/cookies stay on the happy path.
async function postReactivate(req, res, next) {
  try {
    const { email: rawEmail, password } = req.body || {};
    if (!rawEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    await service.reactivateAccount({ email: normEmail(rawEmail), password });
    res.json({ success: true, message: "Account reactivated. Sign in to continue." });
  } catch (err) {
    if (err.isOperational) {
      const body = { error: err.message, code: err.code };
      return res.status(err.status).json(body);
    }
    next(err);
  }
}

// ─── GET /api/auth/allergies — read the saved allergy list (read-only).
// Lets Profile > Personalization show current allergies; writes still go
// through POST /complete-onboarding (setAllergies = whole-list replace).
async function getallergies(req, res, next) {
  try {
    const allergies = await service.getAllergies(req.user.id);
    res.json({ allergies });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getme,
  postregister,
  postlogin,
  postgoogleLogin,
  postchangePassword,
  postlogout,
  postsendVerification,
  getverifyEmail,
  patchchangeEmail,
  postcompleteOnboarding,
  getallergies,
  postDeactivate,
  postReactivate,
  registerSchema,
  loginSchema,
  googleLoginSchema,
  changePasswordSchema,
  changeEmailSchema,
  loginIpLimiter,
};
