import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../../../components/AppShell.jsx';
import PageHeader from '../../../../components/app/PageHeader.jsx';
import BottomNav from '../../../../components/BottomNav.jsx';
import EmptyState from '../../../../components/feedback/EmptyState.jsx';
import ErrorState from '../../../../components/feedback/ErrorState.jsx';
import LoadingState from '../../../../components/feedback/LoadingState.jsx';
import Button from '../../../../components/ui/Button.jsx';
import Modal from '../../../../components/ui/Modal.jsx';
import Spinner from '../../../../components/ui/Spinner.jsx';
import { useAuth } from '../../../../hooks/useAuth.jsx';
import { apiGet, apiPost, apiDelete } from '../../../../lib/apiClient.js';
import { useToastStore } from '../../../../stores/toastStore.js';

const TAGS = ['General', 'Training', 'Nutrition', 'Recovery'];

// Layout-only helpers: tag pill colors + relative timestamps. No logic change.
const TAG_PILLS = {
  General: 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-light)]',
  Training: 'bg-[var(--accent-bg)] text-[var(--accent)] border-[var(--accent-border)]',
  Nutrition: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/20',
  Recovery: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info)]/20',
};

// Layout-only: topic banner gradients + watermark icons (decorative — the API
// has no post images, so the banner carries the topic, never fake numbers).
const TAG_ICONS = {
  General: 'groups',
  Training: 'fitness_center',
  Nutrition: 'restaurant',
  Recovery: 'bedtime',
};

// Layout-only: #hashtags render in accent (like the reference), rest untouched.
const renderRichText = (text) => String(text || '').split(/(#[\w-]+)/g).map((part, i) =>
  /^#[\w-]+$/.test(part)
    ? <span key={i} className="font-semibold text-[var(--accent)]">{part}</span>
    : <span key={i}>{part}</span>
);

const timeAgo = (value) => {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
};

// Community Feed — real backend (GET/POST /api/community, likes, comments).
// Separate from 1:1 Messages at /dashboard/messenger.
const Community = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const addToast = useToastStore((s) => s.addToast);
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState('General');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [liking, setLiking] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentsCache, setCommentsCache] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [deletingPost, setDeletingPost] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  // Layout-only: client-side topic filter (default 'All' = today's full feed).
  const [feedFilter, setFeedFilter] = useState('All');
  // Layout-only: auto-growing composer.
  const draftRef = useRef(null);

  // Layout-only derived data: per-topic counts + filtered feed.
  const tagCounts = useMemo(() => {
    const m = { All: posts.length };
    for (const t of TAGS) m[t] = 0;
    for (const p of posts) {
      if (m[p.tag] !== undefined) m[p.tag] += 1;
      else m[p.tag] = 1;
    }
    return m;
  }, [posts]);
  const visiblePosts = feedFilter === 'All' ? posts : posts.filter((p) => p.tag === feedFilter);

  // Layout-only: grow the composer with its content (cap fallback via CSS).
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setPageLoading(true);
    setPageError('');
    try {
      const data = await apiGet('/api/community?limit=20');
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      setPageError(err.message || 'Could not load the community feed.');
    } finally {
      setPageLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!loading && user?.id) load();
    if (!loading && !user?.id) setPageLoading(false);
  }, [loading, user?.id, load]);

  const publish = async (e) => {
    e.preventDefault();
    if (!draft.trim() || publishing) return;
    setPublishing(true);
    try {
      const data = await apiPost('/api/community', { text: draft.trim(), tag });
      setPosts((p) => [data.post, ...p]);
      setDraft('');
      // Layout-only: jump back to 'All' so the new post is visible immediately.
      setFeedFilter('All');
      addToast('Posted to the community feed.', 'success');
    } catch (err) {
      addToast(err.message || 'Could not publish your post.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const toggleLike = async (post) => {
    if (liking[post.id]) return;
    setLiking((m) => ({ ...m, [post.id]: true }));
    try {
      if (post.liked_by_me) {
        const data = await apiDelete(`/api/community/${post.id}/like`);
        setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, liked_by_me: false, likes: data.likes } : p)));
      } else {
        const data = await apiPost(`/api/community/${post.id}/like`, {});
        setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, liked_by_me: true, likes: data.likes } : p)));
      }
    } catch (err) {
      addToast(err.message || 'Could not update like.', 'error');
    } finally {
      setLiking((m) => ({ ...m, [post.id]: false }));
    }
  };

  const toggleComments = async (post) => {
    const open = !openComments[post.id];
    setOpenComments((m) => ({ ...m, [post.id]: open }));
    if (open && !commentsCache[post.id]) {
      setLoadingComments((m) => ({ ...m, [post.id]: true }));
      try {
        const data = await apiGet(`/api/community/${post.id}/comments?limit=30`);
        setCommentsCache((m) => ({ ...m, [post.id]: data.comments || [] }));
      } catch (err) {
        addToast(err.message || 'Could not load comments.', 'error');
      } finally {
        setLoadingComments((m) => ({ ...m, [post.id]: false }));
      }
    }
  };

  const submitComment = async (post) => {
    const text = (commentDrafts[post.id] || '').trim();
    if (!text || submittingComment[post.id]) return;
    setSubmittingComment((m) => ({ ...m, [post.id]: true }));
    try {
      const data = await apiPost(`/api/community/${post.id}/comments`, { text });
      setCommentsCache((m) => ({ ...m, [post.id]: [...(m[post.id] || []), data.comment] }));
      setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, comments: Number(p.comments) + 1 } : p)));
      setCommentDrafts((m) => ({ ...m, [post.id]: '' }));
    } catch (err) {
      addToast(err.message || 'Could not add comment.', 'error');
    } finally {
      setSubmittingComment((m) => ({ ...m, [post.id]: false }));
    }
  };

  const removePost = async () => {
    const post = pendingDelete;
    if (!post || deletingPost[post.id]) return;
    setDeletingPost((m) => ({ ...m, [post.id]: true }));
    try {
      await apiDelete(`/api/community/${post.id}`);
      setPosts((ps) => ps.filter((p) => p.id !== post.id));
      addToast('Post deleted.', 'success');
      setPendingDelete(null);
    } catch (err) {
      addToast(err.message || 'Could not delete post.', 'error');
    } finally {
      setDeletingPost((m) => ({ ...m, [post.id]: false }));
    }
  };

  // Layout-only skeleton: same card silhouette as the feed (header + lines +
  // actions) so first paint doesn't jump when posts arrive.
  const FeedSkeleton = () => (
    <div className="mt-4 space-y-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[20px] glass-card border border-[var(--border-light)] overflow-hidden animate-pulse">
          <div className="flex items-center gap-2.5 px-4 pt-4">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-[var(--bg-hover)]" />
              <div className="h-2.5 w-16 rounded bg-[var(--bg-hover)]" />
            </div>
          </div>
          <div className="h-3.5 rounded bg-[var(--bg-hover)] mt-3 mx-4" />
          <div className="h-3.5 w-2/3 rounded bg-[var(--bg-hover)] mt-2 mx-4" />
          <div className="h-36 rounded-[14px] bg-[var(--bg-hover)] mt-3 mx-4" />
          <div className="flex gap-2 px-4 -mt-5 relative">
            <div className="h-11 w-20 rounded-full bg-[var(--bg-hover)]" />
            <div className="h-11 w-20 rounded-full bg-[var(--bg-hover)]" />
          </div>
          <div className="h-4" />
        </div>
      ))}
    </div>
  );

  if (loading || (pageLoading && posts.length === 0 && !pageError)) {
    return (
      <AppShell userId={user?.id} contentClassName="app-container app-container--narrow" bottomNav={<BottomNav />}>
        <PageHeader
          eyebrow="Community"
          title={<>Community <em>Feed</em></>}
          description="Training wins, meals and recovery — separate from private Messages."
        />
        <FeedSkeleton />
        <span className="sr-only"><LoadingState message="Loading community feed…" /></span>
      </AppShell>
    );
  }

  return (
    <AppShell userId={user?.id} contentClassName="app-container app-container--narrow" bottomNav={<BottomNav />}>
        <div className="pb-6">
          <PageHeader
            eyebrow="Community"
            title={<>Community <em>Feed</em></>}
            description="Training wins, meals and recovery — separate from private Messages."
            actions={(
              <button onClick={() => navigate('/dashboard/messenger')} aria-label="Go to private messages" className="app-btn app-btn--outline">
                <span className="material-symbols-outlined text-[length:var(--fs-18)]" aria-hidden="true">chat</span>
                Messages
              </button>
            )}
          />

          <form onSubmit={publish} className="mt-4 p-4 rounded-[16px] glass-card border border-[var(--border-light)] transition-colors focus-within:border-[var(--accent-border)]">
            <div className="flex gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center font-black text-[length:var(--fs-14)] text-[var(--accent)] shrink-0" aria-hidden="true">
                {(user?.name || '?')[0]?.toUpperCase()}
              </div>
              <textarea ref={draftRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Share a workout, meal, or recovery win..."
                aria-label="Write a community post" maxLength={1000} rows={3}
                className="flex-1 min-h-[72px] max-h-[200px] bg-transparent border-0 outline-none focus:shadow-none text-[length:var(--fs-14)] placeholder:text-[var(--text-muted)] resize-none min-w-0 overflow-y-auto" />
            </div>
            <div className="flex gap-1.5 mt-3 -mx-4 px-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Post topic">
              {TAGS.map((t) => (
                <button key={t} type="button" onClick={() => setTag(t)} aria-pressed={tag === t}
                  className={`h-8 px-3.5 rounded-full text-[length:var(--fs-11)] font-bold border whitespace-nowrap shrink-0 transition-colors ${tag === t ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--text-inverse)]' : `${TAG_PILLS[t] || ''} hover:border-[var(--border-medium)]`}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--border-light)] gap-2">
              <span className="text-[length:var(--fs-11)] text-[var(--text-muted)] tabular-nums" aria-live="polite">{draft.trim().length}/1000</span>
              <Button type="submit" loading={publishing} disabled={publishing || !draft.trim()} size="md" className="h-10 min-w-[104px]">
                {publishing ? 'Posting…' : 'Post'}
              </Button>
            </div>
          </form>

          {pageError && (
            <div className="mt-4"><ErrorState message={pageError} onRetry={load} /></div>
          )}

          {!pageError && posts.length > 0 && (
            <div className="flex gap-1.5 mt-4 -mx-4 px-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter feed by topic">
              {['All', ...TAGS].map((t) => (
                <button key={t} type="button" onClick={() => setFeedFilter(t)} aria-pressed={feedFilter === t}
                  className={`h-8 px-3.5 rounded-full text-[length:var(--fs-11)] font-bold border whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5 ${feedFilter === t ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]' : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'}`}>
                  {t}
                  <span className="tabular-nums opacity-70">{tagCounts[t] ?? 0}</span>
                </button>
              ))}
            </div>
          )}

          {!pageError && visiblePosts.length === 0 && (
            <div className="mt-4">
              <EmptyState message={feedFilter === 'All'
                ? 'No posts yet — be the first to share a workout, meal, or recovery win.'
                : `No ${feedFilter} posts yet — try another topic or be the first to post it.`} />
            </div>
          )}

          <div className="mt-4 space-y-3">
            {visiblePosts.map((p) => (
              <article key={p.id} className="rounded-[20px] glass-card border border-[var(--border-light)] overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 pt-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center font-black text-[length:var(--fs-15)] text-[var(--accent)] shrink-0" aria-hidden="true">
                    {(p.author_name || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[length:var(--fs-14)] font-black leading-tight truncate">{p.author_name}</p>
                    <p className="text-[length:var(--fs-11)] text-[var(--text-muted)] mt-0.5" title={p.created_at || undefined}>Posted {timeAgo(p.created_at) || 'just now'}</p>
                  </div>
                  {Number(p.user_id) === Number(user?.id) && (
                    <button onClick={() => setPendingDelete(p)} disabled={!!deletingPost[p.id]} aria-label="Delete post"
                      className="shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] disabled:opacity-50">
                      {deletingPost[p.id]
                        ? <Spinner className="w-3.5 h-3.5" />
                        : <span className="material-symbols-outlined text-[length:var(--fs-18)]" aria-hidden="true">delete</span>}
                    </button>
                  )}
                </div>
                <p className="px-4 text-[length:var(--fs-14)] leading-relaxed mt-2.5 whitespace-pre-wrap break-words overflow-wrap-anywhere">{renderRichText(p.text)}</p>
                <div className="px-4 mt-3">
                  <div className="relative h-36 rounded-[14px] overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border-light)]" aria-hidden="true">
                    <span className="material-symbols-outlined absolute -right-3 -bottom-5 text-[length:var(--fs-110)] text-[var(--accent)] opacity-20 select-none">{TAG_ICONS[p.tag] || TAG_ICONS.General}</span>
                    <span className="absolute left-3 bottom-3 h-6 px-2.5 rounded-full bg-black/35 text-white text-[length:var(--fs-10)] font-black uppercase tracking-wider inline-flex items-center backdrop-blur-sm">
                      {p.tag}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 -mt-5 relative z-10">
                  <button onClick={() => toggleLike(p)} disabled={!!liking[p.id]} aria-pressed={!!p.liked_by_me} aria-label={p.liked_by_me ? 'Unlike' : 'Like'}
                    className={`h-11 min-w-11 px-3 rounded-full shadow-lg inline-flex items-center justify-center gap-1.5 text-[length:var(--fs-13)] font-black border disabled:opacity-60 transition-colors ${p.liked_by_me ? 'bg-rose-500 border-rose-500 text-white' : 'bg-[var(--bg-card)] border-[var(--border-medium)] text-[var(--text-muted)]'}`}>
                    {liking[p.id] ? <Spinner className="w-4 h-4" /> : <span className="text-[length:var(--fs-17)] leading-none" aria-hidden="true">{p.liked_by_me ? '♥' : '♡'}</span>}
                    <span className="tabular-nums">{p.likes}</span>
                  </button>
                  <button onClick={() => toggleComments(p)} aria-expanded={!!openComments[p.id]} aria-label="Comments"
                    className={`h-11 min-w-11 px-3 rounded-full shadow-lg inline-flex items-center justify-center gap-1.5 text-[length:var(--fs-13)] font-black border transition-colors ${openComments[p.id] ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-card)] border-[var(--border-medium)] text-[var(--text-muted)]'}`}>
                    {loadingComments[p.id]
                      ? <Spinner className="w-4 h-4" />
                      : <span className="material-symbols-outlined text-[length:var(--fs-18)]" aria-hidden="true">chat_bubble</span>}
                    <span className="tabular-nums">{p.comments}</span>
                  </button>
                </div>
                {!openComments[p.id] && <div className="h-4" aria-hidden="true" />}
                {openComments[p.id] ? (
                  <div className="mx-4 mb-4 mt-3 pt-3 border-t border-[var(--border-light)] space-y-2.5">
                
                    {loadingComments[p.id] ? (
                      <p className="text-[length:var(--fs-12)] text-[var(--text-muted)] animate-pulse">Loading comments…</p>
                    ) : (
                    (commentsCache[p.id] || []).map((c) => (
                      <div key={c.id} className="flex gap-2 text-[length:var(--fs-13)] break-words overflow-wrap-anywhere">
                        <div className="w-6 h-6 rounded-full bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center font-bold text-[length:var(--fs-10)] text-[var(--text-muted)] shrink-0" aria-hidden="true">
                          {(c.author_name || '?')[0]?.toUpperCase()}
                        </div>
                        <p className="min-w-0">
                          <span className="font-bold">{c.author_name}</span>
                          <span className="text-[var(--text-muted)]"> — {c.text}</span>
                        </p>
                      </div>
                    )))}
                    {!loadingComments[p.id] && (commentsCache[p.id] || []).length === 0 && (
                      <p className="text-[length:var(--fs-12)] text-[var(--text-muted)]">No comments yet. Start the conversation.</p>
                    )}
                    <div className="flex gap-2">
                      <input value={commentDrafts[p.id] || ''}
                        aria-label="Write a comment" maxLength={500}
                        onChange={(e) => setCommentDrafts((m) => ({ ...m, [p.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitComment(p); } }}
                        disabled={!!submittingComment[p.id]}
                        placeholder={submittingComment[p.id] ? 'Sending…' : 'Write a comment…'}
                        className="flex-1 min-w-0 h-10 rounded-[10px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-13)] outline-none focus:border-[var(--accent)] disabled:opacity-50" />
                      <Button onClick={() => submitComment(p)} loading={!!submittingComment[p.id]} disabled={!((commentDrafts[p.id] || '').trim()) || !!submittingComment[p.id]} size="sm" className="h-10 shrink-0">
                        Reply
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      <Modal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete post?"
        subtitle="This cannot be undone."
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={pendingDelete ? !!deletingPost[pendingDelete.id] : false} onClick={removePost}>Delete</Button>
          </div>
        }
      >
        <p className="text-[length:var(--fs-13)] text-[var(--text-muted)]">Delete this post permanently?</p>
      </Modal>
    </AppShell>
  );
};

export default Community;
