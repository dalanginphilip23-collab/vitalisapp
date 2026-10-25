// Settings — thin controller. Logic + DB live in services/settings.service.js.
const service = require('../services/settings.service');
const { z } = require('zod');

const { ALLOWED_UNITS, ALLOWED_THEMES, DEFAULTS } = service;

const putSettingsSchema = z.object({
  units: z.enum(ALLOWED_UNITS).optional(),
  step_goal: z.coerce.number().int().min(1000).max(30000).optional(),
  theme: z.enum(ALLOWED_THEMES).optional(),
}).refine((o) => o.units !== undefined || o.step_goal !== undefined || o.theme !== undefined, {
  message: 'At least one of units, step_goal, theme is required.',
});

// GET /api/settings — JWT user only (no :userId, avoids IDOR by design)
async function get(req, res, next) {
  try {
    const rows = await service.getSettings(req.user.id);
    if (!rows.length) return res.json({ settings: { ...DEFAULTS } });
    res.json({ settings: rows[0] });
  } catch (e) { next(e); }
}

// PUT /api/settings {units?, step_goal?, theme?} — upsert (validated by Zod)
async function put(req, res, next) {
  try {
    const { units, step_goal, theme } = req.body;
    const settings = await service.upsertSettings(req.user.id, { units, step_goal, theme });
    res.json({ success: true, settings });
  } catch (e) { next(e); }
}

module.exports = { get, put, ALLOWED_UNITS, ALLOWED_THEMES, putSettingsSchema };
