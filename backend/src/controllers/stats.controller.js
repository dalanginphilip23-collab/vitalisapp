const service = require('../services/stats.service');
// GET /api/stats/daily/:userId

async function getdailyUserId(req,res,next){
  try{
      const { userId } = req.params;
    
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
    
      try {
        const data = await service.getDailyStats(userId);
        res.json(data);
      } catch (err) {
        console.error('daily stats fetch error:', err.message);
        next(err);
      }
  }catch(e){ next(e); }
}

// GET /api/stats/readiness/:userId — null when no data, never misleading 0%
async function getreadinessUserId(req,res,next){
  try{
      const { userId } = req.params;
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      try {
        const data = await service.getReadiness(userId);
        res.json(data);
      } catch (err) {
        console.error('readiness fetch error:', err.message);
        next(err);
      }
  }catch(e){ next(e); }
}

module.exports = { getdailyUserId, getreadinessUserId };
