// Dashboard — thin controller. Logic + DB live in services/dashboard.service.js.
const dashboardService = require('../services/dashboard.service');

async function getdashboardUserId(req,res,next){
  try{
    const { userId } = req.params;
    try {
      const payload = await dashboardService.getDashboard(userId, req.query?.today);
      res.json(payload);
    } catch (e) {
      console.error('DASHBOARD ERROR:', e.message);
      next(e);
    }
  }catch(e){ next(e); }
}

async function getsearch(req,res,next){
  try{
    const raw = req.query.q;
    if (!raw) return res.json([]);
    const q = String(raw).trim().slice(0, 50);
    if (!q) return res.json([]);
    try {
      const results = await dashboardService.searchUsers(q);
      res.json(results);
    } catch (e) {
      console.error('SEARCH ERROR:', e.message);
      next(e);
    }
  }catch(e){ next(e); }
}

// Week calendar card + read-only day detail (current week, Mon–Sun).
// ?today=YYYY-MM-DD (the browser's local date) anchors "today" to the user's
// calendar instead of the server's timezone; validated in the service.
async function getWeekCalendar(req, res, next) {
  try {
    res.json(await dashboardService.getWeekCalendar(req.user.id, req.query?.today));
  } catch (e) {
    next(e);
  }
}

async function getDaySnapshot(req, res, next) {
  try {
    res.json(await dashboardService.getDaySnapshot(req.user.id, req.params.date));
  } catch (e) {
    next(e);
  }
}

module.exports = { getdashboardUserId, getsearch, getWeekCalendar, getDaySnapshot };
