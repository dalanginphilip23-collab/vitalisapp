
const profileService = require('../services/profile.service');

const MAX_AVATAR_CHARS = 200 * 1024; // 200KB — base64 data-URLs bigger than this risk max_allowed_packet

function cleanStr(v, max) {
  if (v === undefined || v === null) return { value: null };
  if (typeof v !== 'string') return { error: 'must be a string' };
  const t = v.trim();
  if (t.length > max) return { error: `must be at most ${max} chars` };
  return { value: t === '' ? null : t };
}
// PUT /api/profile/update

async function putupdate(req,res,next){
  try{
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });
        const { fullName, contact, bio, avatar_url } = req.body || {};
    
        if (typeof fullName !== 'string' || !fullName.trim()) {
            return res.status(400).json({ error: 'Full name is required' });
        }
        if (fullName.trim().length > 100) {
            return res.status(400).json({ error: 'Full name too long (max 100 chars)' });
        }
        const cContact = cleanStr(contact, 50);
        const cBio = cleanStr(bio, 1000);
        if (cContact.error) return res.status(400).json({ error: `contact ${cContact.error}` });
        if (cBio.error) return res.status(400).json({ error: `bio ${cBio.error}` });
        let avatar = null;
        if (avatar_url !== undefined && avatar_url !== null && avatar_url !== '') {
          if (typeof avatar_url !== 'string') return res.status(400).json({ error: 'avatar_url must be a string' });
          if (avatar_url.length > MAX_AVATAR_CHARS) {
            return res.status(400).json({ error: 'Avatar too large (max 200KB). Use a smaller image or URL.' });
          }
          avatar = avatar_url;
        }
    
        try {
            const updated = await profileService.updateProfile(userId, {
                fullName: fullName.trim(),
                contact: cContact.value,
                bio: cBio.value,
                avatar,
            });
            if (!updated) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ success: true, message: 'Profile Synchronized' });
    
        } catch (err) {
            console.error('profile update error:', err.code, err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

async function getUserId(req,res,next){
  try{
        const userId = Number(req.params.userId);
    
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
    
        try {
            const profile = await profileService.getProfile(userId);
            if (!profile) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(profile);
    
        } catch (err) {
            console.error('profile fetch error:', err.message);
            next(err);
        }
  }catch(e){ next(e); }
}

module.exports = { putupdate, getUserId };
