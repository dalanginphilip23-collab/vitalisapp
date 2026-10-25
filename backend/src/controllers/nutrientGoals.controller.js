// Nutrient goals — thin controller. Logic + DB live in services/nutrientGoals.service.js.
const service = require('../services/nutrientGoals.service');
const { validUserId } = require('../utils/ids');

const { ALLOWED, DEFAULTS } = service;

async function getUserId(req,res,next){
  try{
    const userId=validUserId(req.params.userId);
    if(!userId) return res.status(400).json({error:'Invalid user id'});
    const rows = await service.getGoals(userId);
    res.json({ goals: rows });
  }catch(e){ next(e); }
}

async function postUserId(req,res,next){
  try{
    const userId=validUserId(req.params.userId);
    if(!userId) return res.status(400).json({error:'Invalid user id'});
    let { nutrient, target_value } = req.body||{};
    nutrient=String(nutrient||'').trim().toUpperCase();
    if(!ALLOWED.includes(nutrient)) return res.status(400).json({error:`nutrient must be one of: ${ALLOWED.join(', ')}`});
    let target = target_value==null||target_value==='' ? null : Number(target_value);
    if(target==null) target = DEFAULTS[nutrient] ?? null;
    if(target!=null && (!Number.isFinite(target)||target<0||target>10000)) return res.status(400).json({error:'target_value must be 0-10000'});
    const rows = await service.upsertGoal(userId, nutrient, target);
    res.status(201).json({ success:true, goals: rows });
  }catch(e){ next(e); }
}

async function deleteUserIdNutrient(req,res,next){
  try{
    const userId=validUserId(req.params.userId);
    const nutrient=String(req.params.nutrient||'').trim().toUpperCase();
    if(!userId) return res.status(400).json({error:'Invalid user id'});
    if(!ALLOWED.includes(nutrient)) return res.status(400).json({error:'Invalid nutrient'});
    const rows = await service.deactivateGoal(userId, nutrient);
    res.json({ success:true, goals: rows });
  }catch(e){ next(e); }
}

module.exports={ getUserId, postUserId, deleteUserIdNutrient, ALLOWED };
