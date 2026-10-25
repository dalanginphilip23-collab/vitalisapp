const express=require('express');
const router=express.Router();
const verifyUser=require('../middleware/verifyUser');
const { requireOwner }=require('../utils/owner');
const { validate }=require('../middleware/validate');
const controller=require('../controllers/plans.controller');

router.post('/', verifyUser, validate(controller.createPersonalSchema), controller.postCreate);
router.post('/auto-from-goal', verifyUser, controller.postAutoFromGoal);
// 'adjust-from-goal' must sit before '/:planId' routes for the literal to win.
router.post('/adjust-from-goal', verifyUser, controller.postAdjust);
router.patch('/:planId', verifyUser, validate(controller.updatePersonalSchema), controller.patchPlanId);
router.delete('/:planId', verifyUser, controller.deletePlanId);
router.post('/enroll', verifyUser, validate(controller.enrollSchema), controller.postenroll);
router.post('/progress/complete', verifyUser, validate(controller.progressCompleteSchema), controller.postprogressComplete);
router.get('/goal-status/:userId', verifyUser, requireOwner('userId'), controller.getGoalStatusUserId);
router.get('/progress/:userId/:planId', verifyUser, requireOwner('userId'), controller.getprogressUserIdPlanId);
router.get('/content/:planId', verifyUser, controller.getcontentPlanId);
router.get('/:userId', verifyUser, requireOwner('userId'), controller.getUserId);

module.exports=router;
