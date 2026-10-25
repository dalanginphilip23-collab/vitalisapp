const service = require('../services/security.service');

// GET /api/security - fetch all sessions for the logged in user
async function get(req,res,next){
  try{
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    
        try {
            const rows = await service.getSessions(userId);
    
            res.json(rows);
    
        } catch (err) {
            console.error('fetch sessions error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

async function deleteSessionId(req,res,next){
  try{
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });
        const sessionId = Number(req.params.sessionId);
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
          return res.status(400).json({ error: 'Invalid session id' });
        }
    
        try {
            // user_id check makes sure you can only delete your own sessions.
            // Honesty note: JWTs are stateless — deleting the row removes the
            // device from the list, but its cookie token stays valid until
            // expiry or a token_version bump (logout / password change / reset).
            // The response message below says exactly that (no false "logged out").
            const deleted = await service.deleteSession(sessionId, userId);
            if (!deleted) {
              return res.status(404).json({ error: 'Session not found' });
            }

            res.json({ success: true, message: 'Session removed from list. That device stays signed in until its token expires or you log out / change password.' });
    
        } catch (err) {
            console.error('delete session error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

module.exports = { get, deleteSessionId };
