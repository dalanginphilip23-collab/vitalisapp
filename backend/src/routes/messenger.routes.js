const express=require('express');
const router=express.Router();
const verifyUser=require('../middleware/verifyUser');
const { requireOwner }=require('../utils/owner');
const { messageLimiter, writeLimiter }=require('../middleware/rateLimits');
const controller=require('../controllers/messenger.controller');

router.get('/contacts/:userId', verifyUser, requireOwner('userId'), controller.getcontactsUserId);
router.get('/messages/:userId/:contactId', verifyUser, requireOwner('userId'), controller.getmessagesUserIdContactId);
router.post('/messages', verifyUser, messageLimiter(), controller.postmessages);
router.get('/users/search', verifyUser, controller.getusersSearch);
router.post('/friends/add', verifyUser, writeLimiter(), controller.postfriendsAdd);
router.post('/friends/request', verifyUser, writeLimiter(), controller.postfriendsRequest);
router.get('/friends/requests/:userId', verifyUser, requireOwner('userId'), controller.getfriendsRequests);
router.post('/friends/accept', verifyUser, writeLimiter(), controller.postfriendsAccept);
router.post('/friends/decline', verifyUser, writeLimiter(), controller.postfriendsDecline);
router.get('/friends/status', verifyUser, controller.getfriendsStatus);

module.exports=router;
