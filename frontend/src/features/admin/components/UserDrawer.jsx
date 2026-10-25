import { useEffect, useState } from 'react';
import { apiDelete, apiPost } from '../../../lib/apiClient.js';
import { useAdminResource } from '../hooks/useAdminResource.js';
import Icon from '../../../components/Icon.jsx';
import { Badge, ConfirmDialog, MiniStat, StateBlock, TableSkeleton } from './AdminBits.jsx';
import { fmtNum, fmtWhen, initials } from '../utils/format.js';

const humanize = (value) => String(value || '—')
  .toLowerCase()
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Right-side account inspector + every mutating action for one user.
 * Mirrors the backend safety rails: no self-actions, no actions on admins.
 */
export default function UserDrawer({ userId, currentAdminId, onClose, onToast, onChanged }) {
  const { data, loading, error, reload } = useAdminResource(`/api/admin/users/${userId}`);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reason, setReason] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');

  // Lock page scroll behind the drawer + close on Escape.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  const closeConfirm = () => {
    if (busy) return;
    setConfirm(null);
    setActionError('');
    setReason('');
    setDeleteEmail('');
  };

  const run = async (fn, message, closeAfter = false) => {
    setBusy(true);
    setActionError('');
    try {
      await fn();
      onToast?.(message);
      setConfirm(null);
      setReason('');
      setDeleteEmail('');
      onChanged?.();
      if (closeAfter) onClose?.();
      else reload();
    } catch (err) {
      setActionError(err?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const open = (type) => {
    setActionError('');
    setReason('');
    setDeleteEmail('');
    setConfirm(type);
  };

  const user = data?.user;
  const isSelf = user && Number(user.id) === Number(currentAdminId);
  const isAdmin = user?.role === 'admin';
  const locked = isSelf || isAdmin;

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label="User details">
        <header className="adm-drawer__head">
          <div>
            <h2 className="adm-drawer__title">Account inspector</h2>
            <p className="adm-drawer__sub">Full profile, activity counters and access controls.</p>
          </div>
          <button type="button" className="adm-btn is-icon is-ghost" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className="adm-drawer__body">
          {loading && <TableSkeleton rows={7} />}

          {error && (
            <StateBlock
              kind="error"
              title="Could not load this account"
              note={error.message}
              action={<button type="button" className="adm-btn is-sm" onClick={reload}><Icon name="refresh" /> Retry</button>}
            />
          )}

          {user && (
            <>
              <div className="adm-detail-hero">
                <span className="adm-avatar">{initials(user.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-detail-hero__name">{user.name}</div>
                  <div className="adm-detail-hero__mail">{user.email}</div>
                  <div className="adm-detail-badges">
                    <Badge tone={user.role === 'admin' ? 'admin' : 'member'} icon={user.role === 'admin' ? 'shield_person' : 'person'}>
                      {user.role}
                    </Badge>
                    <Badge tone={user.status === 'active' ? 'active' : 'off'}>{user.status}</Badge>
                    <Badge tone={user.is_verified ? 'info' : 'warn'} icon={user.is_verified ? 'verified' : 'mark_email_unread'}>
                      {user.is_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="adm-mini-grid">
                <MiniStat value={data.counts.workouts} label="Workouts" />
                <MiniStat value={data.counts.meals} label="Meals" />
                <MiniStat value={data.counts.posts} label="Posts" />
                <MiniStat value={data.counts.aiCalls} label="AI calls" />
                <MiniStat value={data.counts.activeSessions} label="Sessions" />
                <MiniStat value={data.counts.planEnrollments} label="Plans" />
                <MiniStat value={data.counts.photos} label="Photos" />
                <MiniStat value={data.counts.measurements} label="Measures" />
                <MiniStat value={data.counts.personalPlans} label="Personal" />
              </div>

              <div>
                <p className="adm-section-title">Account</p>
                <div className="adm-kv-list">
                  <div className="adm-kv"><span className="adm-kv__k"><Icon name="badge" /> User ID</span><span className="adm-kv__v">#{user.id}</span></div>
                  <div className="adm-kv"><span className="adm-kv__k"><Icon name="flag" /> Onboarding</span><span className="adm-kv__v">{user.onboarding_completed ? 'Complete' : 'Incomplete'}</span></div>
                  {data.profile && (
                    <div className="adm-kv">
                      <span className="adm-kv__k"><Icon name="straighten" /> Body profile</span>
                      <span className="adm-kv__v">
                        {data.profile.height_cm ? `${data.profile.height_cm} cm` : '—'}
                        {' · '}
                        {data.profile.weight_kg ? `${data.profile.weight_kg} kg` : '—'}
                      </span>
                    </div>
                  )}
                  {data.goal && (
                    <div className="adm-kv">
                      <span className="adm-kv__k"><Icon name="track_changes" /> Latest goal</span>
                      <span className="adm-kv__v">
                        {humanize(data.goal.goal_type)} · {fmtNum(data.goal.daily_kcal)} kcal
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="adm-section-title">Recent sessions</p>
                {data.recentSessions?.length ? (
                  <div className="adm-kv-list">
                    {data.recentSessions.map((session, index) => (
                      <div className="adm-session" key={`${session.created_at}-${index}`}>
                        <span>
                          <b>{session.device || 'Device'}</b>
                          {' · '}{session.browser || 'Browser'}
                          {' · '}{session.ip_address || '—'}
                        </span>
                        <span>{fmtWhen(session.created_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="adm-inline-note"><Icon name="info" /> No recorded device sessions.</p>
                )}
              </div>

              {locked && (
                <p className="adm-inline-note is-danger">
                  <Icon name="gpp_maybe" />
                  {isSelf
                    ? 'This is your own account — use Profile for self-service actions.'
                    : 'This account is an administrator. Admin accounts cannot be modified from the console.'}
                </p>
              )}
            </>
          )}
        </div>

        {user && (
          <footer className="adm-drawer__foot">
            <div className="adm-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="adm-btn is-sm"
                disabled={locked}
                onClick={() => open(user.role === 'admin' ? 'demote' : 'promote')}
              >
                <Icon name={user.role === 'admin' ? 'person' : 'shield_person'} />
                {user.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
              </button>
              <button
                type="button"
                className="adm-btn is-sm"
                disabled={locked}
                onClick={() => open(user.status === 'active' ? 'deactivate' : 'reactivate')}
              >
                <Icon name={user.status === 'active' ? 'person_off' : 'person_check'} />
                {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
              </button>
              <button type="button" className="adm-btn is-sm" disabled={isSelf}
                onClick={() => open('signout')}>
                <Icon name="logout" /> Force sign-out
              </button>
              <button type="button" className="adm-btn is-sm is-danger" disabled={locked}
                onClick={() => open('delete')}>
                <Icon name="delete_forever" /> Delete
              </button>
            </div>
          </footer>
        )}
      </aside>

      {confirm && user && (
        <ConfirmDialog
          title={confirmTitle(confirm, user)}
          message={confirmMessage(confirm, user)}
          confirmLabel={confirmLabel(confirm)}
          danger={confirm === 'delete' || confirm === 'deactivate' || confirm === 'signout'}
          busy={busy}
          error={actionError}
          confirmDisabled={confirm === 'delete' && deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()}
          onCancel={closeConfirm}
          onConfirm={() => {
            if (confirm === 'promote') return run(() => apiPost(`/api/admin/users/${user.id}/role`, { role: 'admin' }), `${user.name} is now an admin.`);
            if (confirm === 'demote') return run(() => apiPost(`/api/admin/users/${user.id}/role`, { role: 'member' }), `${user.name} is now a member.`);
            if (confirm === 'deactivate') return run(() => apiPost(`/api/admin/users/${user.id}/status`, { status: 'deactivated', reason: reason.trim() || undefined }), `${user.name} was deactivated.`);
            if (confirm === 'reactivate') return run(() => apiPost(`/api/admin/users/${user.id}/status`, { status: 'active' }), `${user.name} was reactivated.`);
            if (confirm === 'signout') return run(() => apiPost(`/api/admin/users/${user.id}/signout`), `${user.name} was signed out everywhere.`);
            if (confirm === 'delete') return run(() => apiDelete(`/api/admin/users/${user.id}`), `${user.name}'s account was permanently deleted.`, true);
            return undefined;
          }}
        >
          {confirm === 'deactivate' && (
            <label className="adm-section-title" style={{ display: 'block', marginTop: 12 }}>
              Reason (optional)
              <textarea
                className="adm-input"
                style={{ marginTop: 6, minHeight: 70, resize: 'vertical' }}
                value={reason}
                maxLength={200}
                placeholder="e.g. reported for abusive language"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {confirm === 'delete' && (
            <label className="adm-section-title" style={{ display: 'block', marginTop: 12 }}>
              Type <strong style={{ color: 'var(--error)' }}>{user.email}</strong> to confirm
              <input
                className="adm-input"
                style={{ marginTop: 6 }}
                value={deleteEmail}
                placeholder={user.email}
                onChange={(e) => setDeleteEmail(e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

function confirmTitle(type, user) {
  switch (type) {
    case 'promote': return `Promote ${user.name}?`;
    case 'demote': return `Demote ${user.name}?`;
    case 'deactivate': return `Deactivate ${user.name}?`;
    case 'reactivate': return `Reactivate ${user.name}?`;
    case 'signout': return `Force sign-out for ${user.name}?`;
    case 'delete': return `Permanently delete ${user.name}?`;
    default: return 'Confirm action';
  }
}

function confirmMessage(type, user) {
  switch (type) {
    case 'promote': return `${user.email} will gain full access to this admin console, including user and content controls.`;
    case 'demote': return `${user.email} will lose admin access immediately.`;
    case 'deactivate': return 'All sessions are revoked and login offers reactivation. No data is deleted.';
    case 'reactivate': return 'The account can sign in again. The user will need to authenticate normally.';
    case 'signout': return 'Every device is signed out. The account stays active.';
    case 'delete': return 'This hard-deletes the account and cascades through every related record — workouts, meals, posts, plans, photos. This cannot be undone.';
    default: return '';
  }
}

function confirmLabel(type) {
  switch (type) {
    case 'promote': return 'Promote to admin';
    case 'demote': return 'Demote';
    case 'deactivate': return 'Deactivate account';
    case 'reactivate': return 'Reactivate';
    case 'signout': return 'Sign out everywhere';
    case 'delete': return 'Delete permanently';
    default: return 'Confirm';
  }
}
