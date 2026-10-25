// ─────────────────────────────────────────────────────────────────────────────
// Email templates — single source of truth for outbound email markup.
//
// Design tokens mirror the frontend theme (frontend/src/index.css) so emails
// look like the app: deep green-black surfaces, electric-lime accent.
//   --bg-primary   #0a0e0b    --accent        #7cff6b
//   --bg-card      #141a15    --accent-dark   #43c85f
//   --text-primary #f1f5f1    --success       #7cff6b
//   --text-secondary #a8c0a8  --error         #f87171
//   --text-muted   #8fae9f    --warning       #fde68a
//   fonts: Manrope (display) + Inter (body)
//
// Email clients ignore flexbox/grid and often strip <style>, so everything is
// table-based with inline styles; the <style> block only adds niceties.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND = {
  bg: "#0a0e0b",
  bgSecondary: "#0e1310",
  card: "#141a15",
  surface: "#181f18",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.16)",
  accent: "#7cff6b",
  accentDark: "#43c85f",
  accentLight: "#a8ff9b",
  accentBg: "rgba(124,255,107,0.12)",
  accentBorder: "rgba(124,255,107,0.28)",
  textPrimary: "#f1f5f1",
  textSecondary: "#a8c0a8",
  textMuted: "#8fae9f",
  success: "#7cff6b",
  error: "#f87171",
  warning: "#fde68a",
  info: "#93c5fd",
  fontSans:
    "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  fontDisplay:
    "'Manrope','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
};

/**
 * Escape text so it is safe to interpolate into HTML.
 * @param {unknown} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

/**
 * Brand mark row: lime rounded square with a dark "V" + VITALIS wordmark.
 * @returns {string}
 */
function renderHeader() {
  return `
    <tr>
      <td style="padding:32px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <div style="width:36px;height:36px;background:${BRAND.accent};border-radius:9px;text-align:center;line-height:36px;font-family:${BRAND.fontDisplay};font-weight:800;font-size:18px;color:${BRAND.bg};">V</div>
            </td>
            <td style="vertical-align:middle;padding-left:12px;">
              <div style="font-family:${BRAND.fontDisplay};font-weight:800;font-size:18px;letter-spacing:0.18em;color:${BRAND.textPrimary};">VITALIS</div>
              <div style="font-family:${BRAND.fontSans};font-size:10px;letter-spacing:0.22em;color:${BRAND.textMuted};margin-top:2px;">PERFORMANCE OS</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Footer row with the copyright line.
 * @returns {string}
 */
function renderFooter() {
  return `
    <tr>
      <td style="padding:28px 32px 32px;">
        <div style="border-top:1px solid ${BRAND.border};padding-top:20px;text-align:center;">
          <p style="margin:0;font-family:${BRAND.fontSans};font-size:11px;line-height:1.6;color:${BRAND.textMuted};">
            You received this email from Vitalis Performance OS.<br/>
            &copy; ${new Date().getFullYear()} Vitalis. All rights reserved.
          </p>
        </div>
      </td>
    </tr>`;
}

/**
 * Wrap body content in the branded shell.
 * @param {{ title?: string, preheader?: string, bodyHtml?: string }} props
 * @returns {string}
 */
function renderLayout({ title = "Vitalis", preheader = "", bodyHtml = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap');
  body{margin:0;padding:0;background:${BRAND.bg};}
  a{color:${BRAND.accent};}
  @media (max-width:520px){
    .vitalis-card{border-radius:0 !important;}
    .vitalis-pad{padding-left:20px !important;padding-right:20px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;color:${BRAND.bg};">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="vitalis-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
          ${renderHeader()}
          <tr>
            <td class="vitalis-pad" style="padding:24px 32px 8px;">
              ${bodyHtml}
            </td>
          </tr>
          ${renderFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function renderHeading(text) {
  return `<h1 style="margin:0 0 8px;font-family:${BRAND.fontDisplay};font-weight:800;font-size:22px;line-height:1.25;color:${BRAND.textPrimary};">${text}</h1>`;
}

/**
 * @param {string} html
 * @returns {string}
 */
function renderParagraph(html) {
  return `<p style="margin:0 0 16px;font-family:${BRAND.fontSans};font-size:14px;line-height:1.65;color:${BRAND.textSecondary};">${html}</p>`;
}

/**
 * @param {{ href: string, label: string }} props
 * @returns {string}
 */
function renderButton({ href, label }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.accent}" style="border-radius:10px;">
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${BRAND.fontSans};font-size:15px;font-weight:700;letter-spacing:0.06em;color:${BRAND.bg};text-decoration:none;border-radius:10px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * Highlighted panel (used for the OTP code and info callouts).
 * @param {string} innerHtml
 * @param {{ accent?: boolean }} opts
 * @returns {string}
 */
function renderPanel(innerHtml, { accent = false } = {}) {
  const bg = accent ? BRAND.accentBg : BRAND.bgSecondary;
  const bd = accent ? BRAND.accentBorder : BRAND.border;
  return `<div style="background:${bg};border:1px solid ${bd};border-radius:12px;padding:20px;margin:0 0 24px;">${innerHtml}</div>`;
}

/**
 * @param {unknown} code
 * @returns {string}
 */
function renderCode(code) {
  return `
    <div style="text-align:center;">
      <div style="font-family:${BRAND.fontDisplay};font-size:40px;font-weight:800;letter-spacing:0.32em;color:${BRAND.accent};padding-left:0.32em;">${escapeHtml(code)}</div>
    </div>`;
}

/**
 * @param {Array<{ label: string, value: string | number, color?: string }>} rows
 * @returns {string}
 */
function renderKeyValueTable(rows) {
  const body = rows
    .map(
      (r, i) => `
      <tr style="background:${i % 2 === 0 ? BRAND.bgSecondary : BRAND.card};">
        <td style="padding:13px 16px;font-family:${BRAND.fontSans};font-size:13px;color:${BRAND.textMuted};">${escapeHtml(r.label)}</td>
        <td style="padding:13px 16px;font-family:${BRAND.fontDisplay};font-size:15px;font-weight:700;text-align:right;color:${r.color || BRAND.textPrimary};">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;margin:0 0 24px;">${body}</table>`;
}

/**
 * @param {string} html
 * @returns {string}
 */
function renderMutedNote(html) {
  return `<p style="margin:0 0 8px;font-family:${BRAND.fontSans};font-size:12px;line-height:1.6;color:${BRAND.textMuted};">${html}</p>`;
}

// ─── TEMPLATE BUILDERS ───────────────────────────────────────────────────────
// Each returns { subject, html }.

/**
 * @param {{ name?: string }} props
 * @returns {{ subject: string, html: string }}
 */
function welcomeEmail({ name } = {}) {
  const safeName = escapeHtml(name || "there");
  const features = [
    "AI-powered meal analysis",
    "Camera workout tracking",
    "Sleep &amp; recovery monitoring",
    "Vitalis AI health insights",
    "Activity map &amp; run analysis",
  ]
    .map(
      (f) =>
        `<p style="margin:7px 0;font-family:${BRAND.fontSans};font-size:13px;color:${BRAND.textSecondary};">&#9679;&nbsp;&nbsp;${f}</p>`,
    )
    .join("");
  const body = `
    ${renderHeading(`Welcome, ${safeName}!`)}
    ${renderParagraph("Your Vitalis account is ready. Start tracking your nutrition, workouts, sleep, and recovery — all in one place.")}
    ${renderPanel(
      `<p style="margin:0 0 12px;font-family:${BRAND.fontSans};font-size:13px;font-weight:700;color:${BRAND.accent};">What you can do</p>${features}`,
    )}
    ${renderMutedNote("Fuel your performance. Every rep, meal, and night of sleep counts.")}`;
  return {
    subject: "Welcome to Vitalis Performance OS",
    html: renderLayout({
      title: "Welcome to Vitalis",
      preheader: "Your Vitalis account is ready.",
      bodyHtml: body,
    }),
  };
}

/**
 * @param {{ link?: string }} props
 * @returns {{ subject: string, html: string }}
 */
function verificationEmail({ link } = {}) {
  const safeLink = escapeHtml(link || "#");
  const body = `
    ${renderHeading("Verify your email")}
    ${renderParagraph(`Confirm this address to activate your Vitalis account. This link expires in <strong style="color:${BRAND.textPrimary};">24 hours</strong>.`)}
    ${renderButton({ href: safeLink, label: "VERIFY EMAIL" })}
    ${renderMutedNote("If you didn't create this account, you can safely ignore this email.")}`;
  return {
    subject: "Verify Your Vitalis Account",
    html: renderLayout({
      title: "Verify your email",
      preheader: "Confirm your email to activate your Vitalis account.",
      bodyHtml: body,
    }),
  };
}

/**
 * @param {{ link?: string }} props
 * @returns {{ subject: string, html: string }}
 */
function passwordResetLinkEmail({ link } = {}) {
  const safeLink = escapeHtml(link || "#");
  const body = `
    ${renderHeading("Password reset")}
    ${renderParagraph(`We received a request to reset your password. This link expires in <strong style="color:${BRAND.textPrimary};">1 hour</strong>.`)}
    ${renderButton({ href: safeLink, label: "RESET PASSWORD" })}
    ${renderMutedNote("If you didn't request this, you can safely ignore this email — your password won't change.")}`;
  return {
    subject: "Reset Your Vitalis Password",
    html: renderLayout({
      title: "Reset your password",
      preheader: "Reset your Vitalis password.",
      bodyHtml: body,
    }),
  };
}

/**
 * @param {{ name?: string, otp?: string | number }} props
 * @returns {{ subject: string, html: string }}
 */
function passwordResetOtpEmail({ name, otp } = {}) {
  const safeName = escapeHtml(name || "there");
  const body = `
    ${renderHeading("Password reset")}
    ${renderParagraph(`Hey ${safeName}, use the code below to reset your password. It expires in <strong style="color:${BRAND.accent};">10 minutes</strong>.`)}
    ${renderPanel(renderCode(otp), { accent: true })}
    ${renderMutedNote("If you didn't request this, you can safely ignore this email. Never share this code with anyone.")}`;
  return {
    subject: "Your Vitalis Password Reset Code",
    html: renderLayout({
      title: "Your password reset code",
      preheader: `${otp} is your Vitalis password reset code.`,
      bodyHtml: body,
    }),
  };
}

/**
 * Security alert — the account's password was actually changed (Profile modal
 * or the forgot-password flow). Visually distinct from the reset templates:
 * amber security band + an event table instead of the green accent panel.
 * @param {{ name?: string, when?: string | Date, resetUrl?: string }} props
 * @returns {{ subject: string, html: string }}
 */
function passwordChangedEmail({ name, when, resetUrl } = {}) {
  const safeName = escapeHtml(name || "there");
  const changedAt = when ? new Date(when) : new Date();
  let dateText = changedAt.toISOString().slice(0, 10);
  let timeText = `${changedAt.toISOString().slice(11, 16)} UTC`;
  try {
    dateText = changedAt.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    timeText = changedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch (_) { /* fall back to ISO strings */ }

  const securityBand = `
    <div style="background:rgba(253,230,138,0.10);border:1px solid rgba(253,230,138,0.35);border-left:3px solid ${BRAND.warning};border-radius:10px;padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-family:${BRAND.fontSans};font-size:10px;font-weight:700;letter-spacing:0.24em;color:${BRAND.warning};">SECURITY ALERT</p>
      <p style="margin:4px 0 0;font-family:${BRAND.fontSans};font-size:12px;line-height:1.55;color:${BRAND.textSecondary};">This is an automatic notification about a change to your account.</p>
    </div>`;

  const body = `
    ${securityBand}
    ${renderHeading(`Password changed, ${safeName}`)}
    ${renderParagraph(`Your Vitalis password was just changed from your <strong style="color:${BRAND.textPrimary};">Profile page</strong>. You stay signed in on that device — every other signed-in device was logged out.`)}
    ${renderKeyValueTable([
      { label: "Changed", value: dateText },
      { label: "Time", value: timeText },
      { label: "This device", value: "Still signed in" },
      { label: "Other devices", value: "Signed out", color: BRAND.warning },
    ])}
    ${resetUrl
      ? renderButton({ href: escapeHtml(`${resetUrl}/reset-password`), label: "NOT YOU? SECURE YOUR ACCOUNT" })
      : ""}
    ${renderMutedNote("If this was you, you're all set — no action needed.")}
    ${renderMutedNote("Never share your password. Vitalis will never ask for it by email, chat, or phone.")}`;
  return {
    subject: "Security alert — your Vitalis password was changed",
    html: renderLayout({
      title: "Your password was changed",
      preheader: `Your Vitalis password was changed. Wasn't you? Secure your account.`,
      bodyHtml: body,
    }),
  };
}

/**
 * @param {{ summary?: { calories?: number | string, protein?: number | string, carbs?: number | string, fat?: number | string } }} props
 * @returns {{ subject: string, html: string }}
 */
function mealSummaryEmail({ summary } = {}) {
  const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  const s = {
    calories: n(summary?.calories),
    protein: n(summary?.protein),
    carbs: n(summary?.carbs),
    fat: n(summary?.fat),
  };
  const rows = [
    { label: "Calories", value: `${s.calories} kcal`, color: BRAND.accent },
    { label: "Protein", value: `${s.protein} g`, color: BRAND.info },
    { label: "Carbs", value: `${s.carbs} g`, color: BRAND.accent },
    { label: "Fat", value: `${s.fat} g`, color: BRAND.warning },
  ];
  const body = `
    ${renderHeading("Daily nutrition summary")}
    ${renderParagraph("Here's what you've consumed today. Keep fueling your performance!")}
    ${renderKeyValueTable(rows)}
    ${renderMutedNote("You received this because you logged a meal on Vitalis.")}`;
  return {
    subject: "Your Daily Nutrition Summary — Vitalis",
    html: renderLayout({
      title: "Daily nutrition summary",
      preheader: `${s.calories} kcal logged today.`,
      bodyHtml: body,
    }),
  };
}

/**
 * Internal notification to the Vitalis team (reply-to is the submitter).
 * @param {{ name?: string, email?: string, message?: string }} props
 * @returns {{ subject: string, html: string }}
 */
function feedbackEmail({ name, email, message } = {}) {
  const body = `
    ${renderHeading("New feedback")}
    ${renderParagraph("A user submitted feedback through the Vitalis app.")}
    ${renderKeyValueTable([
      { label: "Name", value: name || "—" },
      { label: "Email", value: email || "—" },
    ])}
    <p style="margin:0 0 8px;font-family:${BRAND.fontSans};font-size:12px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.08em;">Message</p>
    ${renderPanel(
      `<div style="font-family:${BRAND.fontSans};font-size:14px;line-height:1.65;color:${BRAND.textPrimary};white-space:pre-wrap;">${escapeHtml(message || "")}</div>`,
    )}`;
  return {
    subject: `New Feedback from ${name || "a user"}`,
    html: renderLayout({
      title: "New feedback",
      preheader: `Feedback from ${name || "a user"}.`,
      bodyHtml: body,
    }),
  };
}

/**
 * @param {{ newEmail?: string }} props
 * @returns {{ subject: string, html: string }}
 */
function emailChangedNoticeEmail({ newEmail } = {}) {
  const body = `
    ${renderHeading("Your email was changed")}
    ${renderParagraph(`Your Vitalis account email was changed to <strong style="color:${BRAND.textPrimary};">${escapeHtml(newEmail || "")}</strong>.`)}
    ${renderPanel(
      `<p style="margin:0;font-family:${BRAND.fontSans};font-size:13px;line-height:1.6;color:${BRAND.error};">If this wasn't you, reset your password immediately.</p>`,
    )}`;
  return {
    subject: "Your Vitalis email was changed",
    html: renderLayout({
      title: "Your email was changed",
      preheader: "Your Vitalis account email address was changed.",
      bodyHtml: body,
    }),
  };
}

module.exports = {
  BRAND,
  escapeHtml,
  renderLayout,
  renderHeading,
  renderParagraph,
  renderButton,
  renderPanel,
  renderCode,
  renderKeyValueTable,
  renderMutedNote,
  welcomeEmail,
  verificationEmail,
  passwordResetLinkEmail,
  passwordResetOtpEmail,
  passwordChangedEmail,
  mealSummaryEmail,
  feedbackEmail,
  emailChangedNoticeEmail,
};
