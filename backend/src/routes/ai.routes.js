const express=require('express');
const { makeLimiter }=require('../middleware/rateLimits');
const router=express.Router();
const verifyUser=require('../middleware/verifyUser');
const { requireOwner }=require('../utils/owner');
const aiQuota=require('../middleware/aiQuota');
const controller=require('../controllers/ai.controller');

// AI cost guard: 30 AI calls per 5 min per IP (global 300/15m still applies)
const aiRouteLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  message: 'AI is busy. Slow down and try again in a bit.',
});

router.post('/analyze-pose', verifyUser, aiRouteLimiter, aiQuota, controller.postanalyzePose);
router.post('/ai/analysis', verifyUser, aiRouteLimiter, aiQuota, controller.postaiFitnessAnalysis);
// Backward-compatible alias — older clients still call the clinical-analysis path
router.post('/ai/clinical-analysis', verifyUser, aiRouteLimiter, aiQuota, controller.postaiFitnessAnalysis);
router.post('/ai/coach', verifyUser, aiRouteLimiter, aiQuota, controller.postaiCoach);
router.get('/ai/history/:userId', verifyUser, requireOwner('userId'), controller.getaiHistoryUserId);
router.get('/logs/latest/:userId', verifyUser, requireOwner('userId'), controller.getlogsLatestUserId);
router.post('/ai/run-analysis', verifyUser, aiRouteLimiter, aiQuota, controller.postaiRunAnalysis);
router.get('/ai/summary', verifyUser, controller.getaiDailySummary);

module.exports=router;
