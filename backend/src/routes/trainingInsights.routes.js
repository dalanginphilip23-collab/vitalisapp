const express=require('express');
const router=express.Router();
const verifyUser=require('../middleware/verifyUser');
const controller=require('../controllers/trainingInsights.controller');

router.get('/', verifyUser, controller.get);

module.exports=router;
