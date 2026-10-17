const log = require('./logger');

function resolveFrontendUrl() {
  const raw = (process.env.FRONTEND_URL
    || (process.env.ALLOWED_ORIGINS || '').split(',')[0]
    || 'http://localhost:5173').trim();
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad proto');
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') {
      log.warn('[auth] FRONTEND_URL should be https in production:', raw);
    }
    return raw.replace(/\/$/, '');
  } catch {
    log.warn('[auth] Invalid FRONTEND_URL, falling back to http://localhost:5173:', raw);
    return 'http://localhost:5173';
  }
}

function frontendUrl() {
  return resolveFrontendUrl();
}

module.exports = { resolveFrontendUrl, frontendUrl };
