const express = require('express');
const router = express.Router();
const verifyUser = require('../middleware/verifyUser');
const { requireAdmin } = verifyUser;
const { writeLimiter, meLimiter } = require('../middleware/rateLimits');
const controller = require('../controllers/admin.controller');

// Module 7 — admin panel, backend only. EVERY route requires a verified
// session AND role='admin' (requireAdmin). Read endpoints use the light
// meLimiter; mutating endpoints use writeLimiter.
const read = meLimiter();

// 1. Overview stats.
router.get('/overview', verifyUser, requireAdmin, read, controller.getOverview);

// 2. User management.
router.get('/users', verifyUser, requireAdmin, read, controller.getUsers);
router.get('/users/:id', verifyUser, requireAdmin, read, controller.getUserDetail);
router.post('/users/:id/role', verifyUser, requireAdmin, writeLimiter(), controller.postUserRole);
router.post('/users/:id/status', verifyUser, requireAdmin, writeLimiter(), controller.postUserStatus);
router.post('/users/:id/signout', verifyUser, requireAdmin, writeLimiter(), controller.postUserSignout);
router.delete('/users/:id', verifyUser, requireAdmin, writeLimiter(), controller.deleteUser);

// 3. Content oversight (plans read-only, community moderation).
router.get('/plans', verifyUser, requireAdmin, read, controller.getPlans);
router.get('/community/posts', verifyUser, requireAdmin, read, controller.getCommunityPosts);
router.delete('/community/posts/:id', verifyUser, requireAdmin, writeLimiter(), controller.deleteCommunityPost);

// 4. Activity & AI usage ledger.
router.get('/ai-usage', verifyUser, requireAdmin, read, controller.getAiUsage);

// 5. Audit trail.
router.get('/audit', verifyUser, requireAdmin, read, controller.getAudit);

module.exports = router;
