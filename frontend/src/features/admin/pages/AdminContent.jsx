import { useState } from 'react';
import { apiDelete } from '../../../lib/apiClient.js';
import { useAdminResource } from '../hooks/useAdminResource.js';
import Icon from '../../../components/Icon.jsx';
import {
  Badge, ConfirmDialog, PageHero, Panel, Pager, StateBlock, TableSkeleton,
} from '../components/AdminBits.jsx';
import { useAdminToast } from '../hooks/useAdminToast.jsx';
import { fmtNum, fmtWhen } from '../utils/format.js';

const PAGE_SIZE = 8;

const humanize = (value) => String(value || '—').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminContent() {
  const { show, node: toast } = useAdminToast();
  const [tab, setTab] = useState('plans');

  const [plansOffset, setPlansOffset] = useState(0);
  const plans = useAdminResource(`/api/admin/plans?limit=${PAGE_SIZE}&offset=${plansOffset}`);

  const [tagInput, setTagInput] = useState('');
  const [tag, setTag] = useState('');
  const [postsOffset, setPostsOffset] = useState(0);
  const posts = useAdminResource(
    `/api/admin/community/posts?limit=${PAGE_SIZE}&offset=${postsOffset}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`,
  );

  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setDeleteError('');
    try {
      await apiDelete(`/api/admin/community/posts/${pendingDelete.id}`);
      show(`Post #${pendingDelete.id} was removed.`);
      setPendingDelete(null);
      posts.reload();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const planRecords = plans.data?.records || [];
  const postRecords = posts.data?.records || [];

  return (
    <>
      <PageHero
        eyebrow="Content oversight"
        title="Library &"
        accent="community."
        description="Plan catalog insight and live moderation of the public feed. Plan shells are read-only by design; posts can be removed with one audited action."
        chips={[
          { label: `${fmtNum(plans.data?.total || 0)} catalog plans`, icon: 'menu_book' },
          { label: `${fmtNum(posts.data?.total || 0)} posts`, icon: 'forum' },
        ]}
        actions={(
          <div className="adm-seg" role="tablist" aria-label="Content sections">
            <button type="button" role="tab" aria-selected={tab === 'plans'}
              className={`adm-seg__btn${tab === 'plans' ? ' is-active' : ''}`}
              onClick={() => setTab('plans')}>
              <Icon name="auto_stories" /> Plan library
            </button>
            <button type="button" role="tab" aria-selected={tab === 'community'}
              className={`adm-seg__btn${tab === 'community' ? ' is-active' : ''}`}
              onClick={() => setTab('community')}>
              <Icon name="forum" /> Community
            </button>
          </div>
        )}
      />

      {tab === 'plans' && (
        <Panel
          title="Plan catalog"
          subtitle="Catalog plans and how many members are enrolled. Read-only — content is versioned in code/migrations."
          icon="auto_stories"
          actions={<button type="button" className="adm-btn is-sm is-ghost" onClick={plans.reload}><Icon name="refresh" /> Refresh</button>}
          flush
        >
          {plans.loading && <TableSkeleton rows={6} />}
          {plans.error && !plans.loading && (
            <StateBlock kind="error" title="Could not load plans" note={plans.error.message}
              action={<button type="button" className="adm-btn is-sm is-primary" onClick={plans.reload}>Retry</button>} />
          )}
          {!plans.loading && !plans.error && planRecords.length === 0 && (
            <StateBlock icon="inventory_2" title="No plans in the catalog" note="Seed plans through the migration runner." />
          )}
          {!plans.loading && !plans.error && planRecords.length > 0 && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Tag</th>
                    <th>Difficulty</th>
                    <th>Duration</th>
                    <th>Days</th>
                    <th style={{ textAlign: 'right' }}>Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {planRecords.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <div className="adm-person">
                          <span className="adm-avatar"><Icon name="menu_book" style={{ fontSize: 17 }} /></span>
                          <span className="adm-person__copy">
                            <span className="adm-person__name">{plan.title || plan.name || `Plan #${plan.id}`}</span>
                            <span className="adm-person__mail">{plan.name && plan.title ? plan.name : `Plan ID ${plan.id}`}</span>
                          </span>
                        </div>
                      </td>
                      <td>{plan.tag ? <Badge tone="member">{humanize(plan.tag)}</Badge> : '—'}</td>
                      <td className="adm-cell-muted">{humanize(plan.difficulty)}</td>
                      <td className="adm-cell-muted">{plan.duration_days ? `${plan.duration_days} days` : '—'}</td>
                      <td className="adm-cell-num">{fmtNum(plan.dayCount)}</td>
                      <td className="adm-cell-num" style={{ textAlign: 'right' }}>{fmtNum(plan.enrolled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager total={plans.data?.total || 0} limit={PAGE_SIZE} offset={plansOffset} onChange={setPlansOffset} />
            </div>
          )}
        </Panel>
      )}

      {tab === 'community' && (
        <Panel
          title="Community feed"
          subtitle="Newest posts first. Removing a post deletes its likes/comments by cascade and writes an audit row."
          icon="forum"
          actions={<button type="button" className="adm-btn is-sm is-ghost" onClick={posts.reload}><Icon name="refresh" /> Refresh</button>}
          flush
        >
          <form className="adm-toolbar" style={{ padding: '4px 20px 14px' }}
            onSubmit={(e) => { e.preventDefault(); setTag(tagInput.trim()); setPostsOffset(0); }}>
            <label className="adm-search">
              <Icon name="sell" />
              <input className="adm-input" value={tagInput} placeholder="Filter by exact tag…"
                onChange={(e) => setTagInput(e.target.value)} aria-label="Filter by tag" />
            </label>
            <button type="submit" className="adm-btn"><Icon name="filter_alt" /> Apply</button>
            {tag && (
              <button type="button" className="adm-btn is-ghost is-sm"
                onClick={() => { setTag(''); setTagInput(''); setPostsOffset(0); }}>
                Clear
              </button>
            )}
            <span className="adm-toolbar__spacer" />
            <span className="adm-chip"><Icon name="forum" /> {fmtNum(posts.data?.total || 0)} posts</span>
          </form>

          {posts.loading && <TableSkeleton rows={7} />}
          {posts.error && !posts.loading && (
            <StateBlock kind="error" title="Could not load the feed" note={posts.error.message}
              action={<button type="button" className="adm-btn is-sm is-primary" onClick={posts.reload}>Retry</button>} />
          )}
          {!posts.loading && !posts.error && postRecords.length === 0 && (
            <StateBlock icon="forum" title="No posts found" note={tag ? `Nothing tagged “${tag}”.` : 'The community feed is empty.'} />
          )}
          {!posts.loading && !posts.error && postRecords.length > 0 && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Author</th>
                    <th>Post</th>
                    <th>Tag</th>
                    <th>Engagement</th>
                    <th>Posted</th>
                    <th style={{ textAlign: 'right' }}>Moderation</th>
                  </tr>
                </thead>
                <tbody>
                  {postRecords.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <div className="adm-person">
                          <span className="adm-avatar">{String(post.display_name || post.author_name || '?').slice(0, 2).toUpperCase()}</span>
                          <span className="adm-person__copy">
                            <span className="adm-person__name">{post.display_name || post.author_name}</span>
                            <span className="adm-person__mail">{post.author_email}</span>
                          </span>
                        </div>
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <p style={{ margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {post.text}
                        </p>
                      </td>
                      <td>{post.tag ? <Badge tone="info">{humanize(post.tag)}</Badge> : '—'}</td>
                      <td className="adm-cell-muted">
                        <Icon name="favorite" style={{ fontSize: 13, verticalAlign: '-2px' }} /> {fmtNum(post.likes)}
                        {'  '}
                        <Icon name="chat_bubble" style={{ fontSize: 13, verticalAlign: '-2px' }} /> {fmtNum(post.comments)}
                      </td>
                      <td className="adm-cell-muted">{fmtWhen(post.created_at)}</td>
                      <td>
                        <div className="adm-actions">
                          <button type="button" className="adm-btn is-sm is-danger" onClick={() => { setDeleteError(''); setPendingDelete(post); }}>
                            <Icon name="delete" /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager total={posts.data?.total || 0} limit={PAGE_SIZE} offset={postsOffset} onChange={setPostsOffset} />
            </div>
          )}
        </Panel>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Remove post #${pendingDelete.id}?`}
          message={`“${String(pendingDelete.text || '').slice(0, 140)}${String(pendingDelete.text || '').length > 140 ? '…' : ''}” by ${pendingDelete.author_name}. This also deletes its likes and comments.`}
          confirmLabel="Remove post"
          danger
          busy={busy}
          error={deleteError}
          onCancel={() => (busy ? undefined : setPendingDelete(null))}
          onConfirm={confirmDelete}
        />
      )}
      {toast}
    </>
  );
}
