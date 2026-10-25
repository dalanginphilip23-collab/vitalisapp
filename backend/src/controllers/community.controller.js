// Community controller — thin HTTP layer. Validation, ownership checks and
// pagination bounds live here; all SQL lives in services/community.service.js,
// which owns the community_posts / community_likes / community_comments tables.
const communityService = require('../services/community.service');
const { z } = require('zod');
const { validId } = require('../utils/ids');

const ALLOWED_TAGS = ['General', 'Training', 'Nutrition', 'Recovery'];

const createPostSchema = z.object({
  text: z.string().trim().min(1, 'Post text is required.').max(1000, 'Post text must be 1000 characters or less.'),
  tag: z.enum(ALLOWED_TAGS).optional().default('General'),
});

const createCommentSchema = z.object({
  text: z.string().trim().min(1, 'Comment text is required.').max(500, 'Comment must be 500 characters or less.'),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// GET /api/community?limit=20&offset=0 — public feed with like/comment counts + liked_by_me
async function list(req, res, next) {
  try {
    // Validated by paginationSchema (query): coerced ints, limit 1..50, offset >= 0.
    // Clamp again here so the SQL below is safe even if validation is bypassed.
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20) || 20));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const me = req.user.id;
    const { posts, total } = await communityService.listPosts(me, limit, offset);
    res.json({ posts, total, limit, offset });
  } catch (e) { next(e); }
}

// POST /api/community {text, tag} — create post as JWT user (validated by Zod)
async function create(req, res, next) {
  try {
    const { text, tag } = req.body;
    const post = await communityService.createPost(req.user.id, text, tag);
    res.status(201).json({ success: true, post: { ...post, likes: 0, comments: 0, liked_by_me: false } });
  } catch (e) { next(e); }
}

// POST /api/community/:id/like — idempotent like (no toggle-off; use DELETE to unlike)
async function toggleLike(req, res, next) {
  try {
    const postId = validId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Invalid post id' });
    const result = await communityService.likePost(postId, req.user.id);
    if (!result) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, liked: true, likes: result.likes });
  } catch (e) { next(e); }
}

// DELETE /api/community/:id/like — unlike (404 if post missing)
async function unlike(req, res, next) {
  try {
    const postId = validId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Invalid post id' });
    const result = await communityService.unlikePost(postId, req.user.id);
    if (!result) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, liked: false, likes: result.likes });
  } catch (e) { next(e); }
}

// GET /api/community/:id/comments — list comments (404 if post missing)
async function listComments(req, res, next) {
  try {
    const postId = validId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Invalid post id' });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30) || 30));
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
    const comments = await communityService.listComments(postId, limit, offset);
    if (comments === null) return res.status(404).json({ error: 'Post not found' });
    res.json({ comments, limit, offset });
  } catch (e) { next(e); }
}

// POST /api/community/:id/comments {text} (validated by Zod)
async function addComment(req, res, next) {
  try {
    const postId = validId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Invalid post id' });
    const { text } = req.body;
    const comment = await communityService.addComment(postId, req.user.id, text);
    if (!comment) return res.status(404).json({ error: 'Post not found' });
    res.status(201).json({ success: true, comment });
  } catch (e) { next(e); }
}

// DELETE /api/community/:id — owner only
async function remove(req, res, next) {
  try {
    const postId = validId(req.params.id);
    if (!postId) return res.status(400).json({ error: 'Invalid post id' });
    const result = await communityService.deletePost(postId, req.user.id);
    if (!result.found) return res.status(404).json({ error: 'Post not found' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { list, create, toggleLike, unlike, listComments, addComment, remove, ALLOWED_TAGS, createPostSchema, createCommentSchema, paginationSchema };
