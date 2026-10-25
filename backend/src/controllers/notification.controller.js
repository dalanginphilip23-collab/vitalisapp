// Notifications — thin controller. DB access lives in
// services/notification.service.js; SSE fan-out stays here.
const notificationService = require('../services/notification.service');
// One entry per tab/device: a user may stream from phone + desktop at once.
const clients = new Map(); // userId -> Set<res>

function addClient(userKey, res) {
  let set = clients.get(userKey);
  if (!set) { set = new Set(); clients.set(userKey, set); }
  // Cap tabs per user so one browser can't leak FDs forever.
  const MAX_PER_USER = 5;
  if (set.size >= MAX_PER_USER) {
    const oldest = [...set][0];
    try { oldest.end(); } catch (_) {}
    set.delete(oldest);
  }
  // Global safety valve across all users.
  if (clientCount() >= 1000) {
    throw new Error('Too many SSE connections');
  }
  set.add(res);
  return set;
}

function removeClient(userKey, res) {
  const set = clients.get(userKey);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userKey);
}

function broadcast(userKey, payload) {
  const set = clients.get(userKey);
  if (!set) return;
  for (const res of [...set]) {
    try { res.write(`data: ${JSON.stringify(payload)}\n\n`); }
    catch (_) { removeClient(userKey, res); }
  }
}

function clientCount() {
  let n = 0;
  for (const set of clients.values()) n += set.size;
  return n;
}

async function stream(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
    if (userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const userKey = String(userId);
    res.setHeader('Content-Type', 'text/event-stream');
    // no-transform: gateways must not buffer/compress the stream. No `Connection`
    // header — it is illegal in HTTP/2 and tunnel gateways RST streams that carry it.
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    // First bytes immediately: tells EventSource its retry backoff and proves
    // to proxies/gateways the stream is alive (no buffering, no 504 on connect).
    res.write('retry: 3000\n\n');
    res.write(': connected\n\n');
    addClient(userKey, res);
    if (process.env.NODE_ENV !== 'production') console.log(`SSE connected: user ${userId} (total: ${clientCount()})`);
    // Real data-frame heartbeat (not a comment): H2/tunnel idle timers only count
    // body bytes, so `: comment` keepalives alone still get reaped mid-stream.
    const heartbeat = setInterval(() => { try { res.write(`event: ping\ndata: {"t":${Date.now()}}\n\n`); } catch (_) { clearInterval(heartbeat); } }, 25000);
    // Idle timeout: close streams silent for 10 min so dead tabs can't linger.
    const idleTimer = setTimeout(() => { try { res.end(); } catch (_) {} }, 10 * 60 * 1000);
    req.on('close', () => {
      clearInterval(heartbeat);
      clearTimeout(idleTimer);
      removeClient(userKey, res);
      if (process.env.NODE_ENV !== 'production') console.log(`SSE disconnected: user ${userId} (total: ${clientCount()})`);
    });
  } catch (e) { next(e); }
}

async function getUserId(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
    if (userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const data = await notificationService.getNotifications(userId);
    res.json(data);
  } catch (err) { next(err); }
}

async function post(req, res, next) {
  try {
    const user_id = Number(req.body?.user_id);
    if (!Number.isInteger(user_id) || user_id <= 0) return res.status(400).json({ error: 'Valid user_id is required' });
    if (user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    const { message, type = 'info', category = 'SYSTEM' } = req.body;
    // Send-guard: never store meaningless notifications (e.g. zero-rep sessions)
    const text = String(message || '').trim();
    if (!text) return res.status(400).json({ error: 'Notification message is required' });
    if (text.length > 500) return res.status(400).json({ error: 'Notification too long (max 500 chars)' });
    if (/\b0 reps?\b/i.test(text) && !/goal|target/i.test(text)) {
      return res.status(422).json({ error: 'Empty workout — notification suppressed' });
    }
    const { category: cat } = await notificationService.createNotification(user_id, text, type, category);
    const clientKey = String(user_id);
    broadcast(clientKey, { message: text, type, category: cat });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function putIdRead(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid notification id' });
    const updated = await notificationService.markRead(id, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function putreadAllUserId(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'Invalid user id' });
    if (userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await notificationService.markAllRead(userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// Cross-module helper: persist a notification AND push it live over SSE in one
// call. Used by other domains (messenger/friends, plans, …) so they don't have
// to know about the SSE client registry. Best-effort — never throws.
async function notifyUser(userId, { message, type = 'info', category = 'SYSTEM' } = {}) {
  const text = String(message || '').trim();
  if (!text) return false;
  try {
    const { category: cat } = await notificationService.createNotification(
      userId, text, type, category
    );
    broadcast(String(userId), { message: text, type, category: cat });
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[notify] failed:', err.message);
    }
    return false;
  }
}

module.exports = { stream, getUserId, post, putIdRead, putreadAllUserId, notifyUser };
module.exports.clients = clients;
module.exports.broadcast = broadcast;
