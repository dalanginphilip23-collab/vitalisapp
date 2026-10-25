// Community — business logic + DB access.
// (Feed listing, posts, likes, comments.)
const db = require('../config/db');

// GET /api/community?limit=20&offset=0 — public feed with like/comment counts + liked_by_me
async function listPosts(me, limit, offset) {
  // NOTE: db.query (not execute) — mysql2 server-side prepares reject
  // placeholders in LIMIT/OFFSET on some MySQL versions.
  // Optimized: single GROUP BY pass instead of 2x correlated COUNT per row.
  const [rows] = await db.query(
    `SELECT p.id, p.user_id, p.author_name, p.text, p.tag, p.created_at,
            COUNT(DISTINCT l.id) AS likes,
            COUNT(DISTINCT c.id) AS comments,
            MAX(CASE WHEN l2.user_id = ? THEN 1 ELSE 0 END) AS liked_by_me
     FROM community_posts p
     LEFT JOIN community_likes l ON l.post_id = p.id
     LEFT JOIN community_comments c ON c.post_id = p.id
     LEFT JOIN community_likes l2 ON l2.post_id = p.id AND l2.user_id = ?
     GROUP BY p.id, p.user_id, p.author_name, p.text, p.tag, p.created_at
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [me, me, Number(limit), Number(offset)]
  );
  const [[{ total }]] = await db.execute('SELECT COUNT(*) AS total FROM community_posts');
  const posts = rows.map((r) => ({
    ...r,
    likes: Number(r.likes),
    comments: Number(r.comments),
    liked_by_me: Number(r.liked_by_me) === 1,
  }));
  return { posts, total: Number(total) };
}

// POST /api/community {text, tag} — create post as JWT user (validated by Zod)
async function createPost(userId, text, tag) {
  const [userRows] = await db.execute('SELECT name FROM users WHERE id = ?', [userId]);
  const author = userRows[0]?.name?.split(' ')[0] || 'You';
  const [result] = await db.execute(
    'INSERT INTO community_posts (user_id, author_name, text, tag) VALUES (?,?,?,?)',
    [userId, author, text, tag ?? 'General']
  );
  const [rows] = await db.execute(
    'SELECT id, user_id, author_name, text, tag, created_at FROM community_posts WHERE id = ?',
    [result.insertId]
  );
  return rows[0];
}

// POST /api/community/:id/like — idempotent like (no toggle-off; use DELETE to unlike)
async function likePost(postId, userId) {
  const [exists] = await db.execute('SELECT id FROM community_posts WHERE id = ?', [postId]);
  if (!exists.length) return null;
  await db.execute('INSERT IGNORE INTO community_likes (post_id, user_id) VALUES (?,?)', [postId, userId]);
  const [[{ likes }]] = await db.execute('SELECT COUNT(*) AS likes FROM community_likes WHERE post_id=?', [postId]);
  return { likes: Number(likes) };
}

// DELETE /api/community/:id/like — unlike (404 if post missing)
async function unlikePost(postId, userId) {
  const [exists] = await db.execute('SELECT id FROM community_posts WHERE id = ?', [postId]);
  if (!exists.length) return null;
  await db.execute('DELETE FROM community_likes WHERE post_id=? AND user_id=?', [postId, userId]);
  const [[{ likes }]] = await db.execute('SELECT COUNT(*) AS likes FROM community_likes WHERE post_id=?', [postId]);
  return { likes: Number(likes) };
}

// GET /api/community/:id/comments — list comments (null if post missing)
async function listComments(postId, limit, offset) {
  const [exists] = await db.execute('SELECT id FROM community_posts WHERE id = ?', [postId]);
  if (!exists.length) return null;
  const [rows] = await db.query(
    'SELECT id, user_id, author_name, text, created_at FROM community_comments WHERE post_id=? ORDER BY created_at ASC LIMIT ? OFFSET ?',
    [postId, Number(limit), Number(offset)]
  );
  return rows;
}

// POST /api/community/:id/comments {text} (validated by Zod)
async function addComment(postId, userId, text) {
  const [exists] = await db.execute('SELECT id FROM community_posts WHERE id=?', [postId]);
  if (!exists.length) return null;
  const [userRows] = await db.execute('SELECT name FROM users WHERE id=?', [userId]);
  const author = userRows[0]?.name?.split(' ')[0] || 'You';
  const [result] = await db.execute(
    'INSERT INTO community_comments (post_id, user_id, author_name, text) VALUES (?,?,?,?)',
    [postId, userId, author, text]
  );
  const [rows] = await db.execute('SELECT id, user_id, author_name, text, created_at FROM community_comments WHERE id=?', [result.insertId]);
  return rows[0];
}

// DELETE /api/community/:id — owner only. Reports found/forbidden so the
// controller can pick 404 vs 403.
async function deletePost(postId, userId) {
  const [rows] = await db.execute('SELECT user_id FROM community_posts WHERE id=?', [postId]);
  if (!rows.length) return { found: false, forbidden: false };
  if (Number(rows[0].user_id) !== Number(userId)) return { found: true, forbidden: true };
  await db.execute('DELETE FROM community_posts WHERE id=?', [postId]);
  return { found: true, forbidden: false };
}

module.exports = {
  listPosts,
  createPost,
  likePost,
  unlikePost,
  listComments,
  addComment,
  deletePost,
};
