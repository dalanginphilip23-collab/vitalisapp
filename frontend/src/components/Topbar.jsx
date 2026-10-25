import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { apiGet, apiFetch } from '../lib/apiClient.js';
import { resolveAvatar, capitalizeName } from '../lib/avatar.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfileWarnings } from '../hooks/useProfileWarnings.js';
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
          <Icon name="notifications" className="text-(--accent) text-[length:var(--fs-16)]" />
          <span className="text-[length:var(--fs-13)] font-bold text-(--text-primary) tracking-tight">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[length:var(--fs-10)] font-black bg-(--accent) text-[var(--text-inverse)] px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onMarkAllRead} className="text-[length:var(--fs-11)] text-(--accent)/80 hover:text-(--accent) transition-colors bg-transparent border-none cursor-pointer font-medium whitespace-nowrap px-1">
            Mark all read
          </button>
          <button onClick={onClose} aria-label="Close notifications" className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-(--bg-hover) hover:bg-(--bg-active) transition-colors border-none cursor-pointer">
            <Icon name="close" className="text-(--text-muted) text-[length:var(--fs-14)]" />
          </button>
        </div>
      </div>

      <div className="flex bg-(--bg-tertiary) border-b border-(--border-light)">
        {['recent', 'all'].map(tab => (
          <button
            key={tab}
            onClick={(e) => { e.stopPropagation(); setFilter(tab); }}
            className={`flex-1 py-2.5 text-[length:var(--fs-12)] font-semibold transition-all border-none cursor-pointer
              ${filter === tab ? 'text-(--accent) border-b-2 border-(--accent) bg-(--accent-bg)' : 'text-(--text-muted) hover:text-(--text-secondary) bg-transparent'}`}
          >
            {tab === 'recent' ? 'Recent' : `All (${notifications.length})`}
          </button>
        ))}
      </div>

      <div
        className="overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{
          maxHeight: isMobile ? '55dvh' : '340px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Icon name="notifications" className="text-[length:var(--fs-40)] text-(--text-disabled)" />
            <p className="text-[length:var(--fs-12)] text-(--text-muted) m-0 font-medium">No notifications yet</p>
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
                  : <div className="w-2 h-2 rounded-full bg-(--accent) shadow-[var(--shadow-sm)] animate-pulse" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[length:var(--fs-12)] leading-relaxed m-0 wrap-break-word font-medium ${notif.is_read ? 'text-(--text-muted)' : 'text-(--text-secondary)'}`}>{notif.message}</p>
                <p className={`text-[length:var(--fs-10)] mt-1 m-0 font-medium ${notif.is_read ? 'text-(--text-disabled)' : 'text-(--text-muted)'}`}>
                  {new Date(notif.created_at).toLocaleString()}
                </p>
              </div>
              {!notif.is_read
                ? <span className="shrink-0 mt-1 text-[length:var(--fs-9)] font-black bg-(--accent)/20 text-(--accent) px-1.5 py-0.5 rounded-full whitespace-nowrap border border-(--accent-border)">NEW</span>
                : <span className="shrink-0 mt-1 text-[length:var(--fs-9)] font-medium text-(--text-disabled) whitespace-nowrap">read</span>
              }
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-(--border-light) bg-(--bg-tertiary) flex items-center justify-between">
        <span className="text-[length:var(--fs-11)] font-medium">
          {unreadCount > 0
            ? <span className="text-(--accent)/70">{unreadCount} unread</span>
            : <span className="text-(--text-disabled)">All caught up ✓</span>
          }
        </span>
        <span className="text-[length:var(--fs-10)] text-(--text-disabled)">{notifications.length} total</span>
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
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          style={{ width: '100%', maxWidth: '400px', maxHeight: '80dvh', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
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
const Topbar = ({ sidebarExpanded = false, userId = undefined, leftSlot = null, leftOffsetClass = undefined, topbarClassName = '' }) => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { subscribe } = useNotificationStream();
  const { logout, user, sessionValid } = useAuth();
  // Only fire authed polls when the session cookie is proven — pages pass
  // a (possibly stale) userId prop, which alone 401-spams on dead sessions.
  const authedUserId = sessionValid === true ? userId : null;
  // Yellow "setup incomplete" dot: unfinished onboarding, missing body
  // metrics, or no fitness goal (same warning Sidebar flags on Profile).
  const { hasWarning } = useProfileWarnings(authedUserId, user);

  const accountBase = user?.role === 'admin' ? '/admin' : '/dashboard';
  const SETTINGS_ITEMS = getSettingsItems(navigate, accountBase);
  if (user?.role === 'admin') {
    SETTINGS_ITEMS.unshift({
      icon: 'shield_person',
      label: 'Admin Console',
      accent: true,
      action: () => navigate('/admin'),
    });
  }

  const [profileData, setProfileData] = useState({ name: '', avatar_url: '' });

  // Derived user display data — no prop→state sync effect needed.
  // Auth user wins, dashboard profile is fallback. Never flash Guest/Athlete:
  // show loading skeleton until real name arrives.
  const isUserLoading = !user?.name && !profileData.name;
  const userData = useMemo(() => ({
    name: capitalizeName(user?.name || profileData.name || (isUserLoading ? 'Loading…' : 'Member')),
    avatar_url: user?.avatar || profileData.avatar_url || '',
    roleLabel: user?.role === 'admin'
      ? 'Administrator'
      : (user?.fitness_goal || user?.goalType || 'Member'),
  }), [user?.name, user?.avatar, user?.fitness_goal, user?.goalType, user?.role, profileData, isUserLoading]);

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
    addToast('Logged out successfully', 'success', 5600, {
      title: 'Logged out successfully',
      description: 'Your session ended securely. See you next time.',
    });
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
          'fixed top-0 right-0 h-[var(--topbar-h)] z-50 ' +
          'glass-topbar ' +
          'border-b border-(--border-light) ' +
          'flex items-center justify-between px-3 sm:px-4 md:px-6 ' +
          'transition-[left,background-color,border-color] duration-300 ease-out ' +
          'left-0 ' + (leftOffsetClass ?? (sidebarExpanded ? 'md:left-60' : 'md:left-18')) +
          (leftSlot ? ' vdash-topbar' : '') +
          (topbarClassName ? ` ${topbarClassName}` : '')
        }
      >
        {/* ── Left: brand (default) or page-provided slot ── */}
        {leftSlot ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">{leftSlot}</div>
        ) : (
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              aria-label="Go to dashboard"
              className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0"
            >
              <img src="/pwa-192x192.png" alt="Vitalis logo" className="w-7 h-7 rounded-lg shrink-0" />
              <span className="font-['Manrope'] text-[length:var(--fs-16)] sm:text-[length:var(--fs-18)] font-extrabold tracking-[-0.01em] text-(--text-primary) hover:text-(--accent) transition-colors">
                Vitalis
              </span>
            </button>
          </div>
        )}

        {/* ── Right ── */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
          {/* Notification Bell */}
          <div className="relative flex items-center justify-center" ref={notifRef}>
            <button
              className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl cursor-pointer group bg-transparent border-none transition-all duration-200 hover:bg-(--bg-hover)"
              onClick={() => {
                setNotifOpen(prev => !prev);
                fetchNotifications();
              }}
            >
              <Icon name="notifications" className={`text-[length:var(--fs-20)] sm:text-[length:var(--fs-21)] transition-colors ${notifOpen ? 'text-(--accent)' : 'text-(--text-muted) group-hover:text-(--accent)'}`} />
              {notifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-(--accent) rounded-full border-[1.5px] border-(--bg-secondary) animate-pulse" />
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
              if (/** @type {any} */ (e.target)?.closest?.('#account-portal')) return;
              e.stopPropagation();
              setNotifOpen(false);
              setSettingsOpen(prev => !prev);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSettingsOpen(false);
            }}
          >
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-[length:var(--fs-11)] sm:text-[length:var(--fs-12)] font-semibold text-(--text-secondary)">{userData.name}</span>
              <span className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] text-(--text-muted) font-medium">{userData.roleLabel}</span>
            </div>
            <div className="relative shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-(--accent)/20 bg-(--bg-tertiary) ring-1 ring-white/5 flex items-center justify-center font-bold text-[length:var(--fs-11)]" style={showAvatarImg ? undefined : { background: avatar.surface.background, color: avatar.surface.color }}>
                {showAvatarImg ? <img src={avatar.src} alt="User" className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} /> : avatar.initials}
              </div>
              {hasWarning && (
                <span
                  aria-hidden="true"
                  title="Profile setup incomplete"
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--warning)] ring-2 ring-[var(--bg-secondary)]"
                />
              )}
            </div>
            <Icon
              name={settingsOpen ? 'expand_less' : 'expand_more'}
              className="text-[length:var(--fs-16)] text-(--text-muted) hidden sm:block"
            />

            {settingsOpen && createPortal(
              <div
                id="account-portal"
                className="fixed w-52.5 sm:w-55 glass-card bg-(--bg-secondary) border border-(--border-medium) rounded-2xl shadow-(--shadow-lg) overflow-hidden"
                style={{ top: '64px', right: '12px', zIndex: 2000 }}
              >
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-(--border-light) bg-(--surface)">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-(--accent)/20 bg-(--bg-tertiary) flex items-center justify-center font-bold text-[length:var(--fs-12)]" style={showAvatarImg ? undefined : { background: avatar.surface.background, color: avatar.surface.color }}>
                      {showAvatarImg ? <img src={avatar.src} alt="User" className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} /> : avatar.initials}
                    </div>
                    {hasWarning && (
                      <span
                        aria-hidden="true"
                        title="Profile setup incomplete"
                        className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--warning)] ring-2 ring-[var(--surface)]"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-[length:var(--fs-12)] sm:text-[length:var(--fs-13)] font-bold text-(--text-primary) leading-tight m-0">{userData.name}</p>
                    <p className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] text-(--text-muted) m-0 font-medium">{userData.roleLabel}</p>
                  </div>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  {SETTINGS_ITEMS.map(({ icon, label, accent, action }) => (
                    <button
                      key={label}
                      onClick={() => { action(); setSettingsOpen(false); }}
                      className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[length:var(--fs-11)] sm:text-[length:var(--fs-12)] transition-colors duration-150 text-left cursor-pointer border-none bg-transparent ' + (accent ? 'text-(--accent) hover:bg-(--accent-bg)' : 'text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)')}
                    >
                      <Icon name={icon} className="text-[length:var(--fs-14)] sm:text-[length:var(--fs-15)]" />
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-(--border-light) mt-1 pt-1">
                    <button
                      onClick={() => { setShowFeedback(true); setSettingsOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[length:var(--fs-11)] sm:text-[length:var(--fs-12)] transition-colors duration-150 text-left cursor-pointer border-none bg-transparent text-(--text-muted) hover:text-(--text-primary) hover:bg-(--bg-hover)"
                    >
                      <Icon name="rate_review" className="text-[length:var(--fs-14)] sm:text-[length:var(--fs-15)]" /> Feedback
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[length:var(--fs-11)] sm:text-[length:var(--fs-12)] text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors duration-150 cursor-pointer border-none bg-transparent"
                    >
                      <Icon name="logout" className="text-[length:var(--fs-14)] sm:text-[length:var(--fs-15)]" /> Log out
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