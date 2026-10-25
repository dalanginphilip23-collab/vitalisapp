// Feedback — thin controller over the email service.
const { sendFeedbackEmail } = require("../services/email.service");
const { mailConfigured } = require("../config/mailer");

async function post(req, res, next) {
  try {
    const { name, email, message } = req.body || {};

    // VALIDATION (trim-first so whitespace-only is rejected)
    const tName = typeof name === "string" ? name.trim() : "";
    const tEmail = typeof email === "string" ? email.trim() : "";
    const tMessage = typeof message === "string" ? message.trim() : "";
    if (!tName || !tEmail || !tMessage) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (tName.length > 100 || tEmail.length > 254 || tMessage.length > 5000) {
      return res.status(400).json({ error: "Feedback fields too long." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tEmail)) {
      return res.status(400).json({ error: "Invalid email address." });
    }

    const recipient = process.env.RECEIVER_EMAIL || process.env.FEEDBACK_EMAIL;
    if (!mailConfigured() || !recipient) {
      return res
        .status(503)
        .json({ error: "Feedback service is not configured. Try again later." });
    }

    try {
      await sendFeedbackEmail({ name: tName, email: tEmail, message: tMessage });
      res.json({ success: true, message: "Feedback sent successfully." });
    } catch (err) {
      console.error("Feedback Error:", err.code || err.message);
      // SMTP/auth failures are config issues, not client errors — 503 so the
      // UI can show "try again later".
      if (
        err.code === "EAUTH" ||
        err.code === "ECONNECTION" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ESOCKET"
      ) {
        return res.status(503).json({
          error: "Feedback service is temporarily unavailable. Please try again later.",
        });
      }
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

module.exports = { post };
