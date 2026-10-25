// Notifications — business logic + DB access.
// SSE fan-out (client registry, broadcast, stream) stays in the controller.
const db = require('../config/db');

const CATEGORIES = ['TRAINING', 'NUTRITION', 'RECOVERY', 'GOAL', 'SYSTEM', 'SOCIAL'];
const TYPES = ['info', 'success', 'warning', 'error'];

async function getNotifications(userId) {
  const [[result]] = await db.execute('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE', [userId]);
  const [notifications] = await db.execute('SELECT id, user_id, message, type, category, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [userId]);
  return { count: result.count, notifications };
}

async function createNotification(userId, text, type, category) {
  const cat = CATEGORIES.includes(String(category).toUpperCase())
    ? String(category).toUpperCase() : 'SYSTEM';
  const notifType = TYPES.includes(String(type)) ? String(type) : 'info';
  try {
    await db.execute(
      'INSERT INTO notifications (user_id, message, type, category) VALUES (?, ?, ?, ?)',
      [userId, text, notifType, cat]
    );
  } catch (err) {
    // Pre-015 databases lack the category column — fall back gracefully
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      await db.execute(
        'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
        [userId, text, notifType]
      );
    } else throw err;
  }
  // Normalized category is returned so the controller can broadcast it.
  return { category: cat };
}

async function markRead(id, userId) {
  const [result] = await db.execute('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

async function markAllRead(userId) {
  await db.execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
}

module.exports = { getNotifications, createNotification, markRead, markAllRead };
