const express=require('express');
const router=express.Router();
const verifyUser=require('../middleware/verifyUser');
const controller=require('../controllers/trainingPrefs.controller');

// One user's training preferences: identity from JWT, never the body.
router.get('/', verifyUser, controller.get);
router.put('/', verifyUser, controller.put);

module.exports=router;
