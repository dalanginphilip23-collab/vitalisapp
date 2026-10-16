import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { apiGet, apiFetch } from '../lib/apiClient.js';
import { resolveAvatar } from '../lib/avatar.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNotification } from '../stores/toastStore.js';
import { useNotificationStream } from '../context/NotificationStream.jsx';
import { getSettingsItems } from '../constants/nav.js';
import { createPortal } from 'react-dom';
import ThemeToggle from './ThemeToggle.jsx';
import FeedbackModal from './FeedbackModal.jsx';

// Single nav lives in Sidebar/BottomNav (constants/nav.js). Topbar keeps only notifications/settings/avatar.

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION OVERLAY
══════════════════════════════════════════════════════════════ */
function NotificationOverlay({ notifications, onMarkRead, onMarkAllRead, onClose }) {
  const [filter, setFilter] = useState('recent');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ESC to close + focus management for a11y
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isMobile]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const displayed = filter === 'recent' ? notifications.slice(0, 10) : notifications;

  const innerContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border-light) bg-(--surface)">
        <div className="flex items-center gap-2">
          <Icon name="notifications" className="text-(--accent) text-[16px]" />
          <span className="text-[13px] font-bold text-(--text-primary) tracking-tight">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-black bg-(--accent-solid) text-[var(--accent-solid-fg)] px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onMarkAllRead} className="text-[11px] text-(--accent)/80 hover:text-(--accent) transition-colors bg-transparent border-none cursor-pointer font-medium whitespace-nowrap px-1">
            Mark all read
          </button>
          <button onClick={onClose} aria-label="Close notifications" className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-(--bg-hover) hover:bg-(--bg-active) transition-colors border-none cursor-pointer">
            <Icon name="close" className="text-(--text-muted) text-[14px]" />
          </button>
        </div>
      </div>

      <div className="flex bg-(--bg-tertiary) border-b border-(--border-light)">
        {['recent', 'all'].map(tab => (
          <button
            key={tab}
            onClick={(e) => { e.stopPropagation(); setFilter(tab); }}
            className={`flex-1 py-2.5 text-[12px] font-semibold transition-all border-none cursor-pointer
              ${filter === tab ? 'text-(--accent) border-b-2 border-(--accent) bg-(--accent-bg)' : 'text-(--text-muted) hover:text-(--text-secondary) bg-transparent'}`}
          >
            {tab === 'recent' ? 'Recent' : `All (${notifications.length})`}
          </button>
        ))}
      </div>

      <div
        className="overflow-y-auto [&::-webkit-scrollbar]:hidden no-scrollbar"
        style={{
          maxHeight: isMobile ? '55dvh' : '340px',
        }}
      >
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Icon name="notifications_none" className="text-[40px] text-(--text-disabled)" />
            <p className="text-[12px] text-(--text-muted) m-0 font-medium">No notifications yet</p>
          </div>
        ) : (
          displayed.map((notif) => (
            <div
              key={notif.id}
              onClick={(e) => { e.stopPropagation(); if (!notif.is_read) onMarkRead(notif.id); }}
              className={`flex items-start gap-3 px-4 py-3.5 border-b border-(--border-light) transition-all duration-150
                ${notif.is_read ? 'bg-(--bg-card) cursor-default' : 'bg-(--accent-bg) active:bg-(--accent-border) hover:bg-(--accent-bg) cursor-pointer'}`}
            >
              <div className="mt-1.5 shrink-0">
                {notif.is_read
                  ? <div className="w-1.5 h-1.5 rounded-full bg-(--text-muted) border border-(--border-medium)" />
                  : <div className="w-2 h-2 rounded-full bg-(--accent) shadow-[var(--shadow-sm)]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] leading-relaxed m-0 wrap-break-word font-medium ${notif.is_read ? 'text-(--text-muted)' : 'text-(--text-secondary)'}`}>{notif.message}</p>
                <p className={`text-[10px] mt-1 m-0 font-medium ${notif.is_read ? 'text-(--text-disabled)' : 'text-(--text-muted)'}`}>
                  {new Date(notif.created_at).toLocaleString()}
                </p>
              </div>
              {!notif.is_read
                ? <span className="shrink-0 mt-1 text-[9px] font-black bg-(--accent)/20 text-(--accent) px-1.5 py-0.5 rounded-full whitespace-nowrap border border-(--accent-border)">NEW</span>
                : <span className="shrink-0 mt-1 text-[9px] font-medium text-(--text-disabled) whitespace-nowrap">read</span>
              }
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-(--border-light) bg-(--bg-tertiary) flex items-center justify-between">
        <span className="text-[11px] font-medium">
          {unreadCount > 0
            ? <span className="text-(--accent)/70">{unreadCount} unread</span>
            : <span className="text-(--text-disabled)">All caught up ✓</span>
          }
        </span>
        <span className="text-[10px] text-(--text-disabled)">{notifications.length} total</span>
      </div>
    </>
  );

  if (isMobile) {
    return createPortal(
        <div
          id="notif-portal"
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          className="fixed inset-0 z-[9999] bg-[var(--bg-overlay)] flex items-center justify-center px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div
            className="w-full max-w-[400px] max-h-[80dvh] bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-light)] overflow-hidden shadow-[var(--shadow-lg)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
          {innerContent}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div role="dialog" aria-label="Notifications" className="absolute right-0 top-[calc(100%+10px)] w-95 max-w-[calc(100vw-2rem)] glass-card bg-(--bg-secondary) border border-(--border-medium) rounded-2xl shadow-(--shadow-lg) overflow-hidden z-9999">
      {innerContent}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TOPBAR
══════════════════════════════════════════════════════════════ */
// 30s in-memory profile cache: Topbar remounts on every dashboard/* nav —
// without this each nav refires GET dashboard + notifications. Same data,
// fewer requests. Auth user still wins via userData useMemo above.
const _profileCache = new Map(); // userId -> { at, data }
const getCachedProfile = (uid) => {
  const e = _profileCache.get(uid);
  if (e && Date.now() - e.at < 30000) return e.data;
  return null;
};
const setCachedProfile = (uid, data) => {
  _profileCache.set(uid, { at: Date.now(), data });
  if (_profileCache.size > 50) _profileCache.delete(_profileCache.keys().next().value);
};
const Topbar = ({ sidebarExpanded, userId }) => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { subscribe } = useNotificationStream();
  const { logout, user, sessionValid } = useAuth();
  // Only fire authed polls when the session cookie is proven — pages pass
  // a (possibly stale) userId prop, which alone 401-spams on dead sessions.
  const authedUserId = sessionValid === true ? userId : null;

  const SETTINGS_ITEMS = getSettingsItems(navigate);

  const [profileData, setProfileData] = useState({ name: '', avatar_url: '' });

  // Derived user display data — no prop→state sync effect needed.
  // Auth user wins, dashboard profile is fallback. Never flash Guest/Athlete:
  // show loading skeleton until real name arrives.
  const isUserLoading = !user?.name && !profileData.name;
  const userData = useMemo(() => ({
    name: user?.name || profileData.name || (isUserLoading ? 'Loading…' : 'Member'),
    avatar_url: user?.avatar || profileData.avatar_url || '',
    roleLabel: user?.fitness_goal || user?.goalType || 'Member',
  }), [user?.name, user?.avatar, user?.fitness_goal, user?.goalType, profileData, isUserLoading]);

  const [notifCount,     setNotifCount]     = useState(0);
  const [notifications,  setNotifications]  = useState([]);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [showFeedback,   setShowFeedback]   = useState(false);

  const settingsRef = useRef(null);
  const notifRef    = useRef(null);

  // Auth user arrives async after mount — derived via useMemo above, no effect needed.

  const fetchNotifications = useCallback(async () => {
    if (!authedUserId) return;
    try {
      const data = await apiGet(`/api/notifications/${authedUserId}`);
      setNotifCount(data.count || 0);
      setNotifications(data.notifications || []);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Notif fetch error:', err);
    }
  }, [authedUserId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const notifPortal = document.getElementById('notif-portal');
      if (notifPortal) return;
      // Account menu lives in a portal: ignore presses inside it here —
      // each item closes the menu explicitly in its own onClick.
      const accountPortal = document.getElementById('account-portal');
      if (accountPortal && accountPortal.contains(e.target)) return;
      if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    const fetchTopbarData = async () => {
      try {
        const cached = getCachedProfile(authedUserId);
        if (cached) {
          if (!cancelled) setProfileData(cached);
          return;
        }
        const data = await apiGet(`/api/dashboard/${authedUserId}`);
        if (!cancelled && data.profile) {
          const next = {
            name: data.profile.name || '',
            avatar_url: data.profile.avatar_url || '',
          };
          setCachedProfile(authedUserId, next);
          setProfileData(next);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Topbar fetch error:', err);
      }
    };
    fetchTopbarData();
    // Async network fetch — setState runs in promise callback, not sync render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    return () => { cancelled = true; };
  }, [authedUserId, fetchNotifications]);

  // Live notifications arrive via the app-wide SSE stream
  // (NotificationStreamProvider) which survives in-app navigation — Topbar
  // only subscribes because it remounts on every dashboard/* page.
  useEffect(() => subscribe((notif) => {
    setNotifCount(prev => prev + 1);
    addToast(notif.message, notif.type);
    fetchNotifications();
  }), [subscribe, addToast, fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setNotifCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Mark read failed', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!authedUserId) return;
    try {
      await apiFetch(`/api/notifications/read-all/${authedUserId}`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotifCount(0);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Mark all read failed', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    addToast('Logged out successfully', 'info');
    navigate('/login');
  };

  const avatar = resolveAvatar(userData.avatar_url || user?.avatar || null, userData.name);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const avatarSrc = userData.avatar_url || user?.avatar || '';
  const prevAvatarRef = useRef(avatarSrc);
  // Reset broken flag when avatar URL changes — render-time adjustment
  // (React-endorsed pattern), avoids setState-in-effect lint + cascading renders.
  if (prevAvatarRef.current !== avatarSrc) {
    prevAvatarRef.current = avatarSrc;
    if (avatarBroken) setAvatarBroken(false);
  }
  const showAvatarImg = avatar.kind === 'image' && !avatarBroken;

  return (
    <>
      {/* Feedback Modal */}
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}

      {/* ── Topbar — frosted glass over scrolled content */}
      <header
        className={
          'fixed top-0 right-0 h-14 z-50 ' +
          'glass-topbar ' +
          'border-b border-(--border-light) ' +
          'flex items-center justify-between px-3 sm:px-4 md:px-6 ' +
          'transition-[left,background-color,border-color] duration-200 ' +
          'pt-safe ' +
          'left-0 ' + (sidebarExpanded ? 'md:left-60' : 'md:left-18')
        }
        style={{ paddingTop: 'max(0px, env(safe-area-inset-top, 0px))' }}
      >
        {/* ── Left: brand ── */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Go to dashboard"
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0"
          >
            <img src="/pwa-192x192.png" alt="Vitalis logo" className="w-7 h-7 rounded-lg shrink-0" />
            <span className="font-display text-[15px] sm:text-[18px] md:pl-0 font-extrabold tracking-tight text-(--text-primary) hover:text-(--accent) transition-colors">
              Vitalis
            </span>
          </button>
        </div>

        {/* ── Right ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
          {/* Notification Bell */}
          <div className="relative flex items-center justify-center" ref={notifRef}>
            <button
              className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl cursor-pointer group bg-transparent border-none transition-all duration-200 hover:bg-(--bg-hover)"
              onClick={() => {
                setNotifOpen(prev => !prev);
                fetchNotifications();
              }}
            >
              <Icon name="notifications" className={`text-[20px] sm:text-[21px] transition-colors ${notifOpen ? 'text-(--accent)' : 'text-(--text-muted) group-hover:text-(--accent)'}`} />
              {notifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-(--accent) rounded-full border-[1.5px] border-(--bg-secondary)" />
              )}
            </button>
            {notifOpen && (
              <NotificationOverlay
                notifications={notifications}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10">
            <ThemeToggle />
          </div>

          {/* Avatar + account menu */}
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-label="Account menu"
            className="flex items-center gap-2 sm:gap-2.5 ml-1 pl-2.5 border-l border-(--border-light) cursor-pointer transition-opacity relative z-999 bg-transparent border-t-0 border-r-0 border-b-0 text-left"
            ref={settingsRef}
            onClick={(e) => {
              // Portal events bubble through the React tree: clicks on menu
              // items (rendered via createPortal) reach this toggle AFTER the
              // item's own onClick closed the menu — without this guard the
              // menu instantly reopens (visible when the item opens a modal
              // instead of navigating, e.g. Feedback).
              if (e.target?.closest?.('#account-portal')) return;
              e.stopPropagation();
              setNotifOpen(false);
              setSettingsOpen(prev => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSettingsOpen(false);
            }}
          >
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-[11px] sm:text-[12px] font-semibold text-(--text-secondary)">{userData.name}</span>
              <span className="text-[9px] sm:text-[10px] text-(--text-muted) font-medium">{userData.roleLabel}</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-(--accent)/20 bg-(--bg-tertiary) shrink-0 ring-1 ring-white/5 flex items-center justify-center font-bold text-[11px]" style={showAvatarImg ? undefined : { background: avatar.gradient, color: '#fff' }}>
              {showAvatarImg ? <img src={avatar.src} alt="User" className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} /> : avatar.initials}
            </div>
            <Icon
              name={settingsOpen ? 'expand_less' : 'expand_more'}
              className="text-[16px] text-(--text-muted) hidden sm:block"
            />

            {settingsOpen && createPortal(
              <div
                id="account-portal"
                className="fixed w-52.5 sm:w-55 glass-card bg-(--bg-secondary) border border-(--border-medium) rounded-2xl shadow-(--shadow-lg) overflow-hidden"
                style={{ top: '64px', right: '12px', zIndex: 2000 }}
              >
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-(--border-light) bg-(--surface)">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-(--accent)/20 bg-(--bg-tertiary) shrink-0 flex items-center justify-center font-bold text-[12px]" style={showAvatarImg ? undefined : { background: avatar.gradient, color: '#fff' }}>
                    {showAvatarImg ? <img src={avatar.src} alt="User" className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} /> : avatar.initials}
                  </div>
                  <div>
                    <p className="text-[12px] sm:text-[13px] font-bold text-(--text-primary) leading-tight m-0">{userData.name}</p>
                    <p className="text-[9px] sm:text-[10px] text-(--text-muted) m-0 font-medium">{userData.roleLabel}</p>
                  </div>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  {SETTINGS_ITEMS.map(({ icon, label, accent, action }) => (
                    <button
                      key={label}
                      onClick={() => { action(); setSettingsOpen(false); }}
                      className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] sm:text-[12px] transition-colors duration-150 text-left cursor-pointer border-none bg-transparent ' + (accent ? 'text-(--accent) hover:bg-(--accent-bg)' : 'text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)')}
                    >
                      <Icon name={icon} className="text-[14px] sm:text-[15px]" />
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-(--border-light) mt-1 pt-1">
                    <button
                      onClick={() => { setShowFeedback(true); setSettingsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] sm:text-[12px] transition-colors duration-150 text-left cursor-pointer border-none bg-transparent text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)"
                    >
                      <Icon name="feedback" className="text-[14px] sm:text-[15px]" /> Feedback
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] sm:text-[12px] text-[#e05050] hover:bg-[#e05050]/10 transition-colors duration-150 cursor-pointer border-none bg-transparent"
                    >
                      <Icon name="logout" className="text-[14px] sm:text-[15px]" /> Log out
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </button>
        </div>
      </header>
    </>
  );
};

export default Topbar;