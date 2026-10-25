const express=require('express');
const router=express.Router();
const verifyUser=require('../middleware/verifyUser');
const controller=require('../controllers/workoutLogs.controller');

router.post('/start', verifyUser, controller.poststart);
// 'manual' must be registered before '/:id/...' POSTs so the literal wins.
router.post('/manual', verifyUser, controller.postManual);
router.patch('/:id/end', verifyUser, controller.patchIdEnd);
// Module 5 — pause/resume keeps the wall clock honest on long sessions.
// Feedback + detail power post-workout self-report and history sets.
// NOTE: '/:id' routes must stay below '/start' so the literal path wins.
router.post('/:id/pause', verifyUser, controller.postPause);
router.post('/:id/resume', verifyUser, controller.postResume);
router.patch('/:id/feedback', verifyUser, controller.patchFeedback);
router.get('/:id', verifyUser, controller.getId);
router.get('/', verifyUser, controller.get);

module.exports=router;
