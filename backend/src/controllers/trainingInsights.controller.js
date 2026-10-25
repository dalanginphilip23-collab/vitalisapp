// Training insights — thin controller. Rules + DB in services/trainingInsights.service.js.
const svc = require('../services/trainingInsights.service');

async function get(req, res, next) {
  try {
    const data = await svc.getInsights(req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { get };
