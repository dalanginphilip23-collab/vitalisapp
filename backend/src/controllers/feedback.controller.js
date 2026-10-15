
// Reuse canonical mailer transport — single source of truth
const log = require('../utils/logger');
const { getTransporter, escapeHtml } = require('../config/mailer');

async function post(req,res,next){
  try{
        try {
    
            const { name, email, message, rating } = req.body || {};

            // VALIDATION (trim-first so whitespace-only is rejected)
            const tName = typeof name === 'string' ? name.trim() : '';
            const tEmail = typeof email === 'string' ? email.trim() : '';
            const tMessage = typeof message === 'string' ? message.trim() : '';
            const tRating = typeof rating === 'string' && rating.trim() !== '' ? Number(rating) : rating;
            if (!Number.isInteger(tRating) || tRating < 1 || tRating > 5) {
                return res.status(400).json({
                    error: 'A star rating from 1 to 5 is required.'
                });
            }
            if (!tName || !tEmail || !tMessage) {
                return res.status(400).json({
                    error: 'All fields are required.'
                });
            }
            if (tName.length > 100 || tEmail.length > 254 || tMessage.length > 5000) {
                return res.status(400).json({ error: 'Feedback fields too long.' });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tEmail)) {
                return res.status(400).json({ error: 'Invalid email address.' });
            }

            if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.RECEIVER_EMAIL) {
                return res.status(503).json({ error: 'Feedback service is not configured. Try again later.' });
            }
    
            // TRANSPORTER (singleton)
            const transporter = getTransporter();

            // Plain, human-looking note — no banners, no gradients. The stars
            // are the only accent; low ratings get a muted red flag.
            const stars = `${'★'.repeat(tRating)}${'☆'.repeat(5 - tRating)}`;
            const needsAttention = tRating <= 2;
            const receivedAt = new Date().toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
            });

            // EMAIL
            await transporter.sendMail({

                from: process.env.EMAIL_USER,

                replyTo: tEmail,

                to: process.env.RECEIVER_EMAIL,

                subject: `New Feedback ${stars} (${tRating}/5)${needsAttention ? ' — needs attention' : ''}`,

                text:
                    `New feedback\n` +
                    `Rating: ${stars} (${tRating}/5)${needsAttention ? ' — NEEDS ATTENTION' : ''}\n` +
                    `Name: ${tName}\n` +
                    `Email: ${tEmail}\n` +
                    `Date: ${receivedAt}\n\n` +
                    `Message:\n${tMessage}\n`,

                html: `
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #222; max-width: 560px;">

                        <p style="margin: 0 0 12px; font-size: 16px; font-weight: bold;">New feedback</p>

                        <p style="margin: 0 0 6px;">
                            <strong>Rating:</strong> <span style="color: #8a6d1b;">${stars}</span> (${tRating}/5)${needsAttention ? ' <span style="color: #b3261e; font-weight: bold;">&middot; needs attention</span>' : ''}
                        </p>

                        <p style="margin: 0 0 6px;">
                            <strong>Name:</strong> ${escapeHtml(tName)}
                        </p>

                        <p style="margin: 0 0 6px;">
                            <strong>Email:</strong> ${escapeHtml(tEmail)}
                        </p>

                        <p style="margin: 0 0 6px;">
                            <strong>Message:</strong>
                        </p>

                        <div style="border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; margin: 0 0 6px;">
                            ${escapeHtml(tMessage).replace(/\n/g, '<br>')}
                        </div>

                        <p style="margin: 16px 0 0; font-size: 12px; color: #888;">
                            ${receivedAt} &middot; Sent from Vitalis Feedback. Reply to this email to reach the user directly.
                        </p>

                    </div>
                `
            });
    
            res.json({
                success: true,
                message: 'Feedback sent successfully.'
            });
    
        } catch (err) {

            log.error('Feedback Error:', err.code || err.message);

            // SMTP/auth failures (e.g. bad Gmail app password) are config issues,
            // not client errors — report 503 so the UI can show "try again later".
            if (err.code === 'EAUTH' || err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') {
                return res.status(503).json({ error: 'Feedback service is temporarily unavailable. Please try again later.' });
            }

            next(err);

        }
  }catch(e){ next(e); }
}

module.exports = { post };
