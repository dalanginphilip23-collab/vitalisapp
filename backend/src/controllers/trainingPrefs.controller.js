// Training preferences — thin controller. Logic in services/trainingPrefs.service.js.
const svc = require('../services/trainingPrefs.service');

const { EQUIPMENT_OPTIONS, LOCATION_OPTIONS, DAY_NAMES } = svc;

async function get(req, res, next) {
  try {
    const prefs = await svc.get(req.user.id);
    res.json({ preferences: prefs, options: { equipment: EQUIPMENT_OPTIONS, locations: LOCATION_OPTIONS, days: DAY_NAMES } });
  } catch (e) {
    next(e);
  }
}

async function put(req, res, next) {
  try {
    const preferences = await svc.save(req.user.id, req.body || {});
    res.json({ preferences });
  } catch (e) {
    next(e);
  }
}

module.exports = { get, put };
