// Landing stats — thin controller. Logic + DB live in services/public.service.js.
const service = require('../services/public.service');

// GET /api/public/landing-stats
async function getlandingStats(req, res, next) {
  try {
    const payload = await service.getLandingStats();
    res.json(payload);
  } catch (e) { next(e); }
}

// POST /api/public/landing-visit — record one unique-per-day site visit.
async function postVisit(req, res, next) {
  try {
    const rawIp = String(req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown').trim().slice(0, 128);
    const visits = await service.recordVisit(rawIp);
    res.json({ success: true, visits });
  } catch (e) { next(e); }
}

module.exports = { getlandingStats, postVisit };
