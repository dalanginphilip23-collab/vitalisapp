// Admin — thin controller. Logic + DB live in services/admin.service.js.
// Every handler assumes `verifyUser, requireAdmin` already ran (mounted at the
// router level) — req.user is the signed-in admin.
const service = require("../services/admin.service");

// GET /api/admin/overview — dashboard counters.
async function getOverview(req, res, next) {
  try {
    res.json(await service.getOverview());
  } catch (e) {
    next(e);
  }
}

// GET /api/admin/users?q=&role=&status=&limit=&offset=
async function getUsers(req, res, next) {
  try {
    const { q, role, status, limit, offset } = req.query;
    res.json(await service.listUsers({ q, role, status, limit, offset }));
  } catch (e) {
    next(e);
  }
}

// GET /api/admin/users/:id — full detail (profile, goal, counts, sessions).
async function getUserDetail(req, res, next) {
  try {
    res.json(await service.getUserDetail(req.user.id, req.params.id));
  } catch (e) {
    next(e);
  }
}

// POST /api/admin/users/:id/role — body { role: 'member'|'admin' }
async function postUserRole(req, res, next) {
  try {
    const { role } = req.body || {};
    res.json(await service.changeUserRole(req.user.id, req.params.id, role));
  } catch (e) {
    next(e);
  }
}

// POST /api/admin/users/:id/status — body { status: 'active'|'deactivated', reason? }
async function postUserStatus(req, res, next) {
  try {
    const { status, reason } = req.body || {};
    res.json(await service.setUserStatus(req.user.id, req.params.id, status, reason));
  } catch (e) {
    next(e);
  }
}

// POST /api/admin/users/:id/signout — force sign-out everywhere.
async function postUserSignout(req, res, next) {
  try {
    res.json(await service.forceSignout(req.user.id, req.params.id));
  } catch (e) {
    next(e);
  }
}

// DELETE /api/admin/users/:id — HARD delete (all data cascades).
async function deleteUser(req, res, next) {
  try {
    res.json(await service.deleteUser(req.user.id, req.params.id));
  } catch (e) {
    next(e);
  }
}

// GET /api/admin/plans?limit=&offset= — catalog oversight (read-only).
async function getPlans(req, res, next) {
  try {
    const { limit, offset } = req.query;
    res.json(await service.listPlans({ limit, offset }));
  } catch (e) {
    next(e);
  }
}

// GET /api/admin/community/posts?tag=&limit=&offset=
async function getCommunityPosts(req, res, next) {
  try {
    const { tag, limit, offset } = req.query;
    res.json(await service.listCommunityPosts({ tag, limit, offset }));
  } catch (e) {
    next(e);
  }
}

// DELETE /api/admin/community/posts/:id — moderation removal.
async function deleteCommunityPost(req, res, next) {
  try {
    res.json(await service.deleteCommunityPost(req.user.id, req.params.id));
  } catch (e) {
    next(e);
  }
}

// GET /api/admin/ai-usage?days=14&limit=&offset= — ledger (per-day + top users).
async function getAiUsage(req, res, next) {
  try {
    const { days, limit, offset } = req.query;
    res.json(await service.getAiUsageLedger({ days, limit, offset }));
  } catch (e) {
    next(e);
  }
}

// GET /api/admin/audit?limit=&offset= — audit trail (most recent first).
async function getAudit(req, res, next) {
  try {
    const { limit, offset } = req.query;
    res.json(await service.listAudit({ limit, offset }));
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getOverview,
  getUsers,
  getUserDetail,
  postUserRole,
  postUserStatus,
  postUserSignout,
  deleteUser,
  getPlans,
  getCommunityPosts,
  deleteCommunityPost,
  getAiUsage,
  getAudit,
};
