import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../../components/Sidebar.jsx';
import Topbar from '../../../components/Topbar.jsx';
import BottomNav from '../../../components/BottomNav.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import { apiGet, apiFetch } from '../../../lib/apiClient.js';
import { useToastStore } from '../../../stores/toastStore.js';
import LoadingState from '../../../components/feedback/LoadingState.jsx';
import ErrorState from '../../../components/feedback/ErrorState.jsx';

const Notifications = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const userId = user?.id;
  const load = useCallback(async () => {
    if (!userId) return;
    setListLoading(true);
    setListError(null);
    try {
      const data = await apiGet(`/api/notifications/${userId}`);
      setItems(Array.isArray(data.notifications) ? data.notifications : Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err);
      useToastStore.getState().addToast('Could not load notifications.', 'error');
      if (import.meta.env.DEV) console.error('Notifications load error:', err);
    } finally {
      setListLoading(false);
    }
  }, [userId]);

  // Initial data fetch: setState runs in the async callback, not the effect body.
  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setItems((p) => p.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Mark read failed:', err);
    }
  };

  const markAll = async () => {
    if (!user?.id) return;
    try {
      await apiFetch(`/api/notifications/read-all/${user.id}`, { method: 'PUT' });
      setItems((p) => p.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Mark all read failed:', err);
    }
  };

  const CATS = ['TRAINING', 'NUTRITION', 'RECOVERY', 'GOAL', 'SYSTEM'];
  const [cat, setCat] = useState('ALL');
  const shown = items
    .filter((n) => (filter === 'unread' ? !n.is_read : true))
    .filter((n) => (cat === 'ALL' ? true : (n.category || 'SYSTEM') === cat));
  const handleLogout = async () => { await logout(); navigate('/login'); };
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="hidden md:block"><Sidebar onClick={handleLogout} expanded={false} setExpanded={() => {}} /></div>
        <Topbar sidebarExpanded={false} userId={user?.id} />
        <main className="pt-[56px] pb-24 px-4 md:px-6 md:ml-[72px]">
          <div className="max-w-[720px] lg:max-w-3xl mx-auto pt-4 pb-6"><LoadingState message="Loading notifications…" /></div>
        </main>
        <div className="md:hidden"><BottomNav /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative">
      <div className="glass-content">
      <div className="hidden md:block"><Sidebar onClick={handleLogout} expanded={false} setExpanded={() => {}} /></div>
      <Topbar sidebarExpanded={false} userId={user?.id} />
      <main className="pt-[56px] pb-24 px-4 md:px-6 md:ml-[72px]">
        <div className="max-w-[720px] lg:max-w-3xl mx-auto pt-4 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-muted)]">Inbox</p>
              <h1 className="text-[22px] font-bold">Notifications</h1>
            </div>
            <button onClick={markAll} className="text-[12px] font-bold text-[var(--accent)] px-3 py-2">Mark all read</button>
          </div>
          <div className="flex gap-2 mt-4" role="group" aria-label="Read status filter">
            {['all', 'unread'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`h-9 px-4 rounded-full text-[12px] font-bold capitalize ${filter === f ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]' : 'bg-[var(--bg-card)] border border-[var(--border-light)]'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap" role="group" aria-label="Category filter">
            {['ALL', ...CATS].map((c) => (
              <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
                className={`h-8 px-3 rounded-full text-[11px] font-bold ${cat === c ? 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]' : 'bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-muted)]'}`}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {listError && <div className="mt-4"><ErrorState message={listError.message || 'Could not load notifications.'} onRetry={load} /></div>}
          {listLoading && items.length === 0 && !listError && <div className="mt-4"><LoadingState message="Loading notifications…" /></div>}
          <div className="mt-4 space-y-2">
            {shown.length === 0 && (
              <div className="p-8 text-center rounded-[14px] border border-dashed border-[var(--border-light)] text-[13px] text-[var(--text-muted)]">
                No notifications yet. Log activity or sleep to trigger AI Coach insights.
              </div>
            )}
            {shown.map((n) => (
              <div key={n.id} className={`p-4 rounded-[14px] border ${n.is_read ? 'glass-card border-[var(--border-light)]' : 'bg-[var(--accent-bg)] border-[var(--accent-border)]'}`}>
                <span className="inline-block text-[9px] font-black uppercase tracking-widest text-[var(--accent)] bg-[var(--accent-bg)] px-2 py-0.5 rounded-full mb-1.5">
                  {(n.category || 'SYSTEM').toLowerCase()}
                </span>
                <p className="text-[13px] break-words overflow-wrap-anywhere text-[var(--text-primary)]">{n.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                  {!n.is_read && <button onClick={() => markRead(n.id)} className="text-[11px] font-bold text-[var(--accent)]">Mark read</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <div className="md:hidden"><BottomNav /></div>
      </div>
    </div>
  );
};

export default Notifications;
