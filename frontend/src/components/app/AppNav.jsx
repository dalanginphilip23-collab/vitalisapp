import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { NAV_ITEMS, SIDEBAR_BOTTOM_NAV } from '../../constants/nav.js';
import { useAuth } from '../../hooks/useAuth.jsx';
import './app-ui.css';

/**
 * Topbar quick jump.
 *
 * The rail already owns primary navigation, so the topbar no longer repeats
 * it. Instead it offers a fast, keyboard-friendly way to reach any page —
 * useful once the rail has more destinations than fit comfortably in a row.
 */
const QUICK_LINKS = [
  ...NAV_ITEMS.map(({ label, path, icon }) => ({ label, path, icon })),
  ...SIDEBAR_BOTTOM_NAV.map(({ label, path, icon }) => ({ label, path, icon })),
  { label: 'Preferences', path: '/dashboard/preferences', icon: 'tune' },
  { label: 'Notifications', path: '/dashboard/notifications', icon: 'notifications' },
  { label: 'Help & Support', path: '/dashboard/help-support', icon: 'help' },
];

const SHORTCUT_LABEL = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  ? '⌘K'
  : 'Ctrl K';

export function AppQuickJump() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const quickLinks = useMemo(() => (
    user?.role === 'admin'
      ? [{ label: 'Admin Console', path: '/admin', icon: 'shield_person' }, ...QUICK_LINKS]
      : QUICK_LINKS
  ), [user?.role]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quickLinks;
    return quickLinks.filter((item) => item.label.toLowerCase().includes(q));
  }, [query, quickLinks]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onShortcut);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onShortcut);
    };
  }, []);

  const go = (item) => {
    if (!item) return;
    setOpen(false);
    setQuery('');
    setActive(0);
    navigate(item.path);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      go(results[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="app-quickjump" ref={rootRef}>
      <div className="app-quickjump-field">
        <Icon name="search" className="app-quickjump-icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          role="combobox"
          aria-label="Jump to a page"
          aria-expanded={open}
          aria-controls="app-quickjump-list"
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `app-quickjump-${active}` : undefined}
          placeholder="Jump to a page…"
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <kbd className="app-quickjump-kbd" aria-hidden="true">{SHORTCUT_LABEL}</kbd>
      </div>

      {open && (
        <div className="app-quickjump-menu" id="app-quickjump-list" role="listbox" aria-label="Pages">
          {results.length === 0 ? (
            <p className="app-quickjump-empty">No pages match “{query.trim()}”.</p>
          ) : results.map((item, index) => {
            const current = item.path === pathname;
            return (
              <div
                key={`${item.label}-${item.path}`}
                id={`app-quickjump-${index}`}
                role="option"
                aria-selected={index === active}
                data-active={index === active ? 'true' : 'false'}
                className="app-quickjump-item"
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(item)}
              >
                <span className="app-quickjump-item-icon"><Icon name={item.icon} /></span>
                <span className="app-quickjump-item-label">{item.label}</span>
                {current && <span className="app-quickjump-current">Current</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppMobileTitle({ title = undefined }) {
  const { pathname } = useLocation();
  const label = title ?? getPageTitle(pathname);
  return (
    <div className="app-mobile-title">
      <img src="/pwa-192x192.png" alt="" className="app-mobile-logo" />
      <span className="app-mobile-title-text">{label}</span>
    </div>
  );
}

const TITLES = [
  ['/dashboard/meal-tracker', 'Nutrition'],
  ['/dashboard/workouts', 'Training'],
  ['/dashboard/activity-map', 'Activity'],
  ['/dashboard/logs', 'Progress'],
  ['/dashboard/plans', 'Plans'],
  ['/dashboard/messenger', 'Messages'],
  ['/dashboard/community', 'Community'],
  ['/dashboard/profile', 'Profile'],
  ['/dashboard/preferences', 'Preferences'],
  ['/dashboard/notifications', 'Notifications'],
  ['/dashboard/help-support', 'Help & Support'],
  ['/dashboard', 'Dashboard'],
];

const getPageTitle = (pathname) => {
  const hit = TITLES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return hit ? hit[1] : 'Vitalis';
};

/** Default Topbar left slot: page title on phones, quick jump on desktop. */
export function AppTopbarLeft({ mobileTitle = undefined }) {
  return (
    <>
      <div className="min-w-0 flex-1 md:hidden">
        <AppMobileTitle title={mobileTitle} />
      </div>
      <div className="hidden min-w-0 md:block">
        <AppQuickJump />
      </div>
    </>
  );
}

/** Small labelled link used in card headers / page actions. */
export function AppTextLink({ to, onClick, icon = 'arrow_forward', children = undefined, className = '' }) {
  const content = (
    <>
      {children}
      {icon && <Icon name={icon} style={{ fontSize: 14 }} />}
    </>
  );
  const cls = `app-text-link ${className}`.trim();
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  return <button type="button" className={cls} onClick={onClick}>{content}</button>;
}
