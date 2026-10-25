import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { MOBILE_MAIN_NAV, MOBILE_MORE_NAV, ACTIVE_NAV_KEY } from '../constants/nav.js';
import { safeSet } from '../lib/storage.js';
import { EMPTY_ACTIVITY_FORM, validateActivityForm } from '../lib/activityForm.js';

const DEFAULT_ITEMS = MOBILE_MAIN_NAV;

function normalize(items) {
  if (!items || !items.length) return DEFAULT_ITEMS;
  return items.slice(0, 4).map((it, idx) => ({
    key: it.key || it.label || it.name || `nav-${idx}`,
    label: it.label || it.name || '',
    icon: it.icon,
    path: it.path,
  }));
}

// Unified bottom nav — replaces MobileNav + MobileBottomNav
// Main bar: Dashboard / Progress / Workout / Plans (always).
// Plus (+) sheet: MealTracker / Jogging / Community / Messenger / Recovery
// (+ Manual Log entry when a log handler is provided).
// `variant` / `items` props are kept for backward compat but no longer change the menu.
// All handler/item props are optional — pages pass only what they need.
const BottomNav = ({
  items = DEFAULT_ITEMS,
  onCenterAction = null,
  onLogActivity = null,
  onFeedback = null,
  onManualLog = null,
  ..._legacy
}) => {
  void _legacy;
  const navigate = useNavigate();
  const location = useLocation();
  const NAV_ITEMS = normalize(items?.length ? items : DEFAULT_ITEMS);
  const MORE_ITEMS = MOBILE_MORE_NAV;
  const externalLog = onCenterAction || onLogActivity;

  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [formData, setFormData] = useState(EMPTY_ACTIVITY_FORM);
  const [formError, setFormError] = useState('');
  const [fanGap, setFanGap] = useState(() =>
    typeof window !== 'undefined' && window.innerHeight < 700 ? 56 : 60
  );

  useEffect(() => {
    const onResize = () => setFanGap(window.innerHeight < 700 ? 56 : 60);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    safeSet(ACTIVE_NAV_KEY, location.pathname);
  }, [location.pathname]);

  // NOTE: menu closes in handleNavClick + overlay/Escape handlers — no pathname effect needed.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [menuOpen]);

  const handleNavClick = (path) => {
    safeSet(ACTIVE_NAV_KEY, path);
    setMenuOpen(false);
    navigate(path);
  };

  const isActivePath = (path) => {
    if (location.pathname === path) return true;
    // Highlight parent for nested views (e.g. /dashboard/logs/123) and
    // query views (pathname match covers ?planId=). Root only exact.
    if (path !== '/dashboard' && location.pathname.startsWith(path + '/')) return true;
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    return false;
  };

  const NavButton = ({ item, isActive }) => (
    <button
      onClick={() => handleNavClick(item.path)}
      aria-label={item.label}
      title={item.label}
      className={`flex items-center justify-center gap-1 h-11 rounded-full transition-all duration-150 shrink-0 min-h-[44px] ${
        isActive
          ? 'bg-[var(--nav-fg)] text-[var(--nav-bg)] px-3 shadow-sm'
          : 'text-[var(--nav-fg-muted)] hover:text-[var(--nav-fg)] w-11'
      }`}
    >
      <Icon name={item.icon} className="text-[length:var(--fs-20)]" fill={isActive ? 1 : 0} />
      {isActive && <span className="text-[length:var(--fs-11)] font-bold capitalize">{item.label}</span>}
    </button>
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    const { error, values } = validateActivityForm(formData);
    if (error) {
      setFormError(error);
      return;
    }
    const clean = {
      ...values,
      steps: values.steps === '' ? '' : values.steps,
      minutes: values.minutes === '' ? '' : values.minutes,
      water: values.water === '' ? '' : values.water,
    };
    try {
      if (typeof externalLog === 'function') externalLog(clean);
    } catch {
      setFormError('Could not save. Try again.');
      return;
    }
    setLogOpen(false);
    setMenuOpen(false);
    setFormData(EMPTY_ACTIVITY_FORM);
  };

  const goMore = (path) => {
    setMenuOpen(false);
    navigate(path);
  };
  const openManualLog = () => {
    if (typeof onManualLog === 'function') {
      setMenuOpen(false);
      setLogOpen(false);
      onManualLog();
      return;
    }
    setMenuOpen(false);
    setLogOpen(true);
  };

  // MyFitnessPal-style straight fan: actions stack vertically above the + button.
  // First item sits nearest the button, rest climb upward.
  // Capped to 60dvh so small phones with keyboard open never overflow.
  const FAN_ITEMS = [
    ...MORE_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
      active: isActivePath(item.path),
      primary: false,
      onPress: () => goMore(item.path),
    })),
    {
      key: 'quicklog',
      label: 'Quick Log',
      icon: 'edit_note',
      active: false,
      primary: true,
      onPress: openManualLog,
    },
  ];
  const FAN_GAP = fanGap;
  const fanPos = (idx) => ({ x: 0, y: -(idx + 1) * FAN_GAP });

  const handlePlusClick = (e) => {
    e.stopPropagation();
    if (menuOpen) {
      setMenuOpen(false);
    } else {
      setLogOpen(false);
      setMenuOpen(true);
      setPulseKey((k) => k + 1); // retrigger the opening ping ring
    }
  };

  return (
    <>
      <nav
        className={`md:hidden fixed left-3 right-3 flex justify-center pointer-events-none ${menuOpen ? 'z-50' : 'z-30'}`}
        style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="pointer-events-auto flex items-center gap-1 w-full max-w-[400px] justify-between relative min-w-0">
          <div className="flex-1 flex items-center justify-around gap-1 px-2 py-1.5 bg-[var(--nav-bg)] border border-[var(--border-medium)] rounded-full shadow-[var(--shadow-lg)] min-w-0 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => (
              <NavButton key={item.key} item={item} isActive={isActivePath(item.path)} />
            ))}
            {onFeedback && (
              <button
                onClick={onFeedback}
                aria-label="Feedback"
                className="rounded-[12px] flex items-center justify-center text-[var(--nav-fg-muted)] hover:text-[var(--nav-fg)] min-h-[44px] min-w-[44px]"
              >
                <Icon name="rate_review" className="text-[length:var(--fs-18)]" />
              </button>
            )}
          </div>

          <div className="relative shrink-0">
            {/* Straight fan — vertical stack above the + button like MyFitnessPal */}
            {FAN_ITEMS.map((item, idx) => {
              const { x, y } = fanPos(idx);
              const closeDelay = (FAN_ITEMS.length - 1 - idx) * 25;
              return (
                <div
                  key={item.key}
                  className={`absolute left-1/2 top-1/2 ${menuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-50 pointer-events-none'}`}
                  style={{
                    transform: `translate(-50%, -50%) translate(${menuOpen ? x : 0}px, ${menuOpen ? y : 0}px)`,
                    transition:
                      'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease-out, scale 0.25s ease-out',
                    transitionDelay: menuOpen ? `${idx * 35}ms` : `${closeDelay}ms`,
                    zIndex: 1,
                  }}
                  aria-hidden={!menuOpen}
                >
                  <button
                    onClick={item.onPress}
                    aria-label={item.label}
                    title={item.label}
                    tabIndex={menuOpen ? 0 : -1}
                    className={`group relative w-12 h-12 rounded-full flex items-center justify-center border shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 ${
                      item.primary
                        ? 'bg-[var(--accent)] border-[var(--accent-border)] text-[var(--text-inverse)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--accent)] hover:bg-[var(--bg-hover)]'
                    } ${item.active ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-card)]' : ''}`}
                  >
                    <span className="material-symbols-outlined text-[length:var(--fs-20)] transition-transform duration-200 group-hover:scale-110">
                      {item.icon}
                    </span>
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={handlePlusClick}
              aria-label={menuOpen ? 'Close menu' : 'More actions'}
              aria-expanded={menuOpen}
              className={`relative w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center border-2 border-[var(--bg-card)] hover:scale-[1.06] active:scale-90 cursor-pointer touch-manipulation select-none shadow-lg shadow-[var(--accent)]/30 ${menuOpen ? 'rotate-45 scale-95' : 'rotate-0 scale-100'}`}
              style={{
                zIndex: 2,
                transition:
                  'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), scale 0.22s ease-out, background-color 0.2s ease-out',
              }}
            >
              <span className="material-symbols-outlined text-[length:var(--fs-20)] font-bold select-none pointer-events-none">
                add
              </span>
              {menuOpen && (
                <span
                  key={pulseKey}
                  className="absolute inset-[-2px] rounded-full border-2 border-[var(--accent)] pointer-events-none"
                  style={{ animation: 'fanPing 0.6s ease-out forwards' }}
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/20 animate-[fadeIn_0.2s_ease] cursor-pointer"
          onClick={() => setMenuOpen(false)}
          role="button"
          aria-label="Close menu"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') setMenuOpen(false);
          }}
        />
      )}

      <style>{` @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes fanPing { from { opacity: 0.8; transform: scale(0.7); } to { opacity: 0; transform: scale(1.9); } } `}</style>

      {logOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm md:hidden overflow-y-auto"
          onClick={() => setLogOpen(false)}
        >
          <div
            className="glass-panel border border-[var(--border-light)] w-full max-w-[360px] rounded-[16px] p-5 my-auto max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-[length:var(--fs-15)] font-bold text-[var(--text-primary)]">Log Activity</h3>
                <p className="text-[length:var(--fs-10)] tracking-widest uppercase text-[var(--text-muted)]">
                  Manual entry
                </p>
              </div>
              <button
                onClick={() => setLogOpen(false)}
                aria-label="Close log form"
                className="w-11 h-11 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] shrink-0"
              >
                <span className="material-symbols-outlined text-[length:var(--fs-18)]">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {formError && (
                <p
                  role="alert"
                  className="text-[length:var(--fs-11)] font-bold text-[var(--error)] bg-[var(--error-bg)] border border-[var(--error)]/20 rounded-lg p-2"
                >
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="bn-calories"
                  className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                >
                  Calories
                </label>
                <input
                  id="bn-calories"
                  type="number"
                  required
                  min="1"
                  max="20000"
                  step="1"
                  placeholder="e.g. 500"
                  value={formData.calories}
                  onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                  className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-14)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="bn-steps"
                    className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    Steps
                  </label>
                  <input
                    id="bn-steps"
                    type="number"
                    min="0"
                    max="200000"
                    step="1"
                    placeholder="10000"
                    value={formData.steps}
                    onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                    className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-14)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bn-minutes"
                    className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                  >
                    Minutes
                  </label>
                  <input
                    id="bn-minutes"
                    type="number"
                    min="0"
                    max="1440"
                    step="1"
                    placeholder="45"
                    value={formData.minutes}
                    onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                    className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-14)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="bn-water"
                  className="text-[length:var(--fs-10)] font-bold uppercase tracking-widest text-[var(--text-muted)]"
                >
                  Water (ml)
                </label>
                <input
                  id="bn-water"
                  type="number"
                  min="0"
                  max="15000"
                  step="1"
                  placeholder="2500"
                  value={formData.water}
                  onChange={(e) => setFormData({ ...formData, water: e.target.value })}
                  className="mt-1 w-full h-11 rounded-[12px] bg-[var(--input-bg)] border border-[var(--input-border)] px-3 text-[length:var(--fs-14)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                type="submit"
                className="w-full h-11 rounded-[12px] bg-[var(--accent)] text-[var(--text-inverse)] font-bold text-[length:var(--fs-13)] flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[length:var(--fs-18)]">check</span> Save
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BottomNav;
