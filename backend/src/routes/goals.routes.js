const express = require('express');
const router = express.Router();
const verifyUser = require('../middleware/verifyUser');
const { requireOwner } = require('../utils/owner');
const controller = require('../controllers/goals.controller');

router.post('/:userId', verifyUser, requireOwner('userId'), controller.postUserId);
router.patch('/active/:userId', verifyUser, requireOwner('userId'), controller.patchActiveUserId);
router.get('/active/:userId', verifyUser, requireOwner('userId'), controller.getactiveUserId);
router.post('/active/:userId/recalibrate', verifyUser, requireOwner('userId'), controller.postActiveRecalibrate);
router.patch('/:userId/change', verifyUser, requireOwner('userId'), controller.patchchangeUserId);

module.exports = router;
