import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { NAV_ITEMS, SIDEBAR_BOTTOM_NAV } from '../constants/nav.js';
import FeedbackModal from './FeedbackModal.jsx';
import { safeSet } from '../lib/storage.js';
import { useAuth } from '../hooks/useAuth.jsx';
import './Sidebar.css';

/**
 * One navigation row for both sidebar states.
 *
 * The row stays outside the Sidebar component so React never remounts the
 * link/button tree when the rail expands or collapses.
 */
const SidebarRow = ({
  href = undefined,
  active = false,
  icon = undefined,
  label = undefined,
  onClick = undefined,
  fillActive = false,
  collapsed = false,
  alert = false,
  danger = false,
  showTooltip = undefined,
  hideTooltip = undefined,
}) => {
  const isLink = Boolean(href);
  const Comp = /** @type {any} */ (isLink ? Link : 'button');
  const accessibleLabel = alert ? `${label} — setup incomplete` : label;

  const openTooltip = (event) => {
    if (collapsed) showTooltip?.(accessibleLabel, event.currentTarget);
  };
  const closeTooltip = () => {
    if (collapsed) hideTooltip?.();
  };

  return (
    <Comp
      {...(isLink ? { to: href } : { type: 'button', onClick })}
      aria-label={accessibleLabel}
      aria-current={active ? 'page' : undefined}
      className={`v-sidebar__row${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      onFocus={openTooltip}
      onBlur={closeTooltip}
    >
      <span className="v-sidebar__row-icon">
        <Icon
          name={icon}
          className="v-sidebar__icon"
          fill={active && fillActive ? 1 : 0}
        />
        {alert && <span className="v-sidebar__alert" aria-hidden="true" />}
      </span>
      <span className="v-sidebar__label" aria-hidden={collapsed ? 'true' : undefined}>
        {label}
      </span>
    </Comp>
  );
};

const Sidebar = ({ onClick = undefined, collapsed = false, onToggle = undefined }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  // Onboarding unfinished (e.g. the user skipped the wizard) → nudge dot on Profile.
  const needsOnboarding = user?.onboardingCompleted === false;

  useEffect(() => {
    safeSet('vitalis:activeNav', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!tooltip) return undefined;
    const hide = () => setTooltip(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [tooltip]);

  const showTooltip = (label, element) => {
    const rect = element.getBoundingClientRect();
    setTooltip({
      label,
      left: rect.right + 10,
      top: Math.min(
        Math.max(rect.top + rect.height / 2, 34),
        window.innerHeight - 34,
      ),
    });
  };

  const isRowActive = (path) =>
    location.pathname === path ||
    (path !== '/dashboard' && location.pathname.startsWith(path + '/'));

  return (
    <>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      {collapsed && tooltip && createPortal(
        <div
          className="v-sidebar-tooltip"
          role="tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {tooltip.label}
        </div>,
        document.body,
      )}

      <aside
        id="app-sidebar"
        aria-label="Primary"
        className={`v-sidebar${collapsed ? ' is-collapsed' : ''}`}
      >
        <div className="v-sidebar__head">
          <Link to="/dashboard" className="v-sidebar__brand" aria-label="Vitalis dashboard">
            <span className="v-sidebar__brand-mark">
              <img src="/pwa-192x192.png" alt="" />
            </span>
            <span className="v-sidebar__brand-copy" aria-hidden={collapsed ? 'true' : undefined}>
              Vitalis
            </span>
          </Link>

          <button
            type="button"
            className="v-sidebar__toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} />
          </button>
        </div>

        <div className="v-sidebar__body">
          <div className="v-sidebar__group-head" aria-hidden={collapsed ? 'true' : undefined}>
            Menu
          </div>

          <nav aria-label="Primary navigation" className="v-sidebar__nav">
            {NAV_ITEMS.map((item) => (
              <SidebarRow
                key={item.key}
                href={item.path}
                active={isRowActive(item.path)}
                icon={item.icon}
                label={item.label}
                fillActive
                collapsed={collapsed}
                showTooltip={showTooltip}
                hideTooltip={() => setTooltip(null)}
              />
            ))}
            {user?.role === 'admin' && (
              <SidebarRow
                href="/admin"
                active={isRowActive('/admin')}
                icon="shield_person"
                label="Admin Console"
                fillActive
                collapsed={collapsed}
                showTooltip={showTooltip}
                hideTooltip={() => setTooltip(null)}
              />
            )}
          </nav>
        </div>

        <div className="v-sidebar__foot">
          <div className="v-sidebar__group-head" aria-hidden={collapsed ? 'true' : undefined}>
            Account
          </div>

          {SIDEBAR_BOTTOM_NAV.map((item) => (
            <SidebarRow
              key={item.key}
              href={item.path}
              active={isRowActive(item.path)}
              icon={item.icon}
              label={item.label}
              fillActive
              collapsed={collapsed}
              alert={needsOnboarding && item.key === 'profile'}
              showTooltip={showTooltip}
              hideTooltip={() => setTooltip(null)}
            />
          ))}

          <SidebarRow
            icon="rate_review"
            label="Feedback"
            collapsed={collapsed}
            onClick={() => setShowFeedback(true)}
            showTooltip={showTooltip}
            hideTooltip={() => setTooltip(null)}
          />

          <SidebarRow
            icon="logout"
            label="Log out"
            danger
            collapsed={collapsed}
            onClick={onClick}
            showTooltip={showTooltip}
            hideTooltip={() => setTooltip(null)}
          />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
