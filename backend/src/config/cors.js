const log = require('../utils/logger');
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000,https://vitalisapp-eta.vercel.app"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Fail-closed: wildcard + credentials would leak sessions to any site.
if (ALLOWED_ORIGINS.includes("*")) {
  log.error(
    "[cors] ALLOWED_ORIGINS=* is forbidden with credentials:true — refusing to start",
  );
  process.exit(1);
}

// Additive to ALLOWED_ORIGINS. Example: ^https:\/\/preview-.*\.example\.com$
let originRegex = null;
try {
  if (process.env.ALLOWED_ORIGIN_REGEX) {
    originRegex = new RegExp(process.env.ALLOWED_ORIGIN_REGEX);
    // Broad patterns (.*) would expose credentialed CORS to any site.
    const src = process.env.ALLOWED_ORIGIN_REGEX;
    if (/^(\.\*|\.\+|\(\.\*\)|\(\.\+\)|\*)$/.test(src.trim()) || src.trim() === '.*') {
      log.error('[cors] ALLOWED_ORIGIN_REGEX is overly broad — refusing to start');
      process.exit(1);
    }
    // Unanchored patterns over-match (example.com matches evil-example.com).
    if (!(src.startsWith('^') && src.endsWith('$'))) {
      log.warn('[cors] ALLOWED_ORIGIN_REGEX should be anchored ^...$ to avoid over-matching');
    }
  }
} catch (e) {
  log.error('[cors] Invalid ALLOWED_ORIGIN_REGEX, ignoring:', e.message);
  originRegex = null;
}

function isAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (originRegex && originRegex.test(origin)) return true;
  if (
    process.env.NODE_ENV !== "production" &&
    /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.devtunnels\.ms$/i.test(origin)
  )
    return true;
  return false;
}

const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowed(origin)) return cb(null, true);
    log.warn("CORS blocked origin:", origin);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

module.exports = { corsOptions, ALLOWED_ORIGINS, isAllowed };
