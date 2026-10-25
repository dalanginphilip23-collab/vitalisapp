// ─────────────────────────────────────────────────────────────────────────────
// Mail transport — single source of truth for SMTP configuration.
//
// Default provider: BREVO (transactional SMTP relay).
//   BREVO_SMTP_LOGIN  → your Brevo SMTP login (usually the account email)
//   BREVO_SMTP_KEY    → your Brevo SMTP key ("master password")
//   BREVO_SMTP_HOST   → optional, defaults to smtp-relay.brevo.com
//   BREVO_SMTP_PORT   → optional, defaults to 587 (STARTTLS). Use 465 for SSL.
//   MAIL_FROM         → optional From address, defaults to BREVO_SMTP_LOGIN
//   MAIL_FROM_NAME    → optional display name, defaults to "Vitalis"
//
// Legacy fallback (kept so existing deployments don't hard-fail mid-migration):
// if BREVO_* is absent but EMAIL_USER/EMAIL_PASS are set, we fall back to Gmail.
//
// This module only owns the transport. Message building lives in
// services/email.service.js + templates/email.templates.js; the send helpers
// are re-exported here (lazily) for backward compatibility.
// ─────────────────────────────────────────────────────────────────────────────

try {
  require("dotenv").config();
} catch {
  /* dotenv optional */
}

const nodemailer = require("nodemailer");

const DEFAULT_BREVO_HOST = "smtp-relay.brevo.com";

function smtpSettings() {
  const brevoLogin = process.env.BREVO_SMTP_LOGIN;
  const brevoKey = process.env.BREVO_SMTP_KEY;
  if (brevoLogin && brevoKey) {
    const port = parseInt(process.env.BREVO_SMTP_PORT, 10) || 587;
    return {
      provider: "brevo",
      host: process.env.BREVO_SMTP_HOST || DEFAULT_BREVO_HOST,
      port,
      secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user: brevoLogin, pass: brevoKey },
    };
  }
  // Legacy Gmail fallback (pre-Brevo deployments).
  const gmailUser = process.env.EMAIL_USER;
  const gmailPass = process.env.EMAIL_PASS;
  if (gmailUser && gmailPass) {
    return { provider: "gmail", service: "gmail", auth: { user: gmailUser, pass: gmailPass } };
  }
  return { provider: "none" };
}

const settings = smtpSettings();

function mailConfigured() {
  return settings.provider !== "none";
}

// Address emails are sent from, resolved from the active provider.
function fromAddress() {
  if (settings.provider === "brevo") {
    return process.env.MAIL_FROM || process.env.BREVO_SMTP_LOGIN;
  }
  if (settings.provider === "gmail") {
    return process.env.MAIL_FROM || process.env.EMAIL_USER;
  }
  return process.env.MAIL_FROM || "no-reply@vitalis.local";
}

function fromHeader() {
  const name = process.env.MAIL_FROM_NAME || "Vitalis";
  return `"${name}" <${fromAddress()}>`;
}

if (!mailConfigured()) {
  console.warn(
    "[mailer] No provider configured — set BREVO_SMTP_LOGIN/BREVO_SMTP_KEY " +
      "(or legacy EMAIL_USER/EMAIL_PASS). Outbound email will fail gracefully (logged, not thrown).",
  );
} else if (settings.provider === "gmail") {
  console.warn(
    "[mailer] Brevo not configured — falling back to legacy Gmail transport. " +
      "Set BREVO_SMTP_LOGIN/BREVO_SMTP_KEY to migrate.",
  );
} else {
  console.log(`[mailer] Brevo SMTP transport active (${settings.host}:${settings.port})`);
}

// Build the transport lazily-ish but expose a single shared instance.
const transportOptions = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  ...(settings.service ? { service: settings.service } : {}),
  ...(settings.host ? { host: settings.host } : {}),
  ...(settings.port ? { port: settings.port, secure: settings.secure } : {}),
  auth: settings.auth || {},
  // Dev-only escape hatch for self-signed/dev SMTP boxes.
  ...(process.env.NODE_ENV !== "production" && process.env.MAILER_INSECURE_TLS === "1"
    ? { tls: { rejectUnauthorized: false } }
    : {}),
};

const transporter = nodemailer.createTransport(transportOptions);

module.exports = {
  transporter,
  getTransporter: () => transporter,
  mailConfigured,
  fromAddress,
  fromHeader,
  provider: settings.provider,
  escapeHtml: require("../templates/email.templates").escapeHtml,
  // Lazy re-exports (backward compat) — require inside the wrapper avoids the
  // mailer ↔ email.service cycle at module-load time.
  get sendMealSummaryEmail() {
    return require("../services/email.service").sendMealSummaryEmail;
  },
  get sendPasswordResetEmail() {
    return require("../services/email.service").sendPasswordResetEmail;
  },
  get sendPasswordResetOtpEmail() {
    return require("../services/email.service").sendPasswordResetOtpEmail;
  },
  get sendWelcomeEmail() {
    return require("../services/email.service").sendWelcomeEmail;
  },
  get sendVerificationEmail() {
    return require("../services/email.service").sendVerificationEmail;
  },
  get sendFeedbackEmail() {
    return require("../services/email.service").sendFeedbackEmail;
  },
  get sendEmailChangedNotice() {
    return require("../services/email.service").sendEmailChangedNotice;
  },
};
