// Password reset (email OTP) — thin controller.
const service = require("../services/forgotpassword.service");

async function postsendOtp(req, res, next) {
  try {
    const email = service.normEmail(req.body?.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    try {
      // null ⇒ unknown email; anti-enumeration: same response as a real send.
      await service.requestResetCode(email);
      res.json({ success: true, message: "If that email exists, a code was sent." });
    } catch (err) {
      console.error("SEND OTP ERROR:", err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postverifyOtp(req, res, next) {
  try {
    const email = service.normEmail(req.body?.email);
    const otp = req.body?.otp != null ? String(req.body.otp).trim() : "";

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and code are required." });
    }

    try {
      const resetToken = await service.verifyResetCode(email, otp);
      res.json({ success: true, resetToken });
    } catch (err) {
      if (err.isOperational) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error("VERIFY OTP ERROR:", err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

async function postresetPassword(req, res, next) {
  try {
    const email = service.normEmail(req.body?.email);
    const resetToken = req.body?.resetToken != null ? String(req.body.resetToken).trim() : "";
    const newPassword = req.body?.newPassword;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: "Password must be 8–128 characters." });
    }

    try {
      await service.resetPassword(email, resetToken, newPassword);
      res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
      if (err.isOperational) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error("RESET PASSWORD ERROR:", err);
      next(err);
    }
  } catch (e) {
    next(e);
  }
}

module.exports = { postsendOtp, postverifyOtp, postresetPassword };
