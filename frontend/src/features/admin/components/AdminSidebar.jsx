import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Icon from '../../../components/Icon.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import { initials } from '../utils/format.js';
import '../../../components/Sidebar.css';

/**
 * Admin rail.
 *
 * Reuses the app sidebar's visual language and collapsed-rail behaviour, but
 * keeps a console-specific hierarchy: admin sections in the body and the
 * elevated account + exit actions in the footer.
 */
const AdminRow = ({
  to = undefined,
  end = undefined,
  icon,
  label,
  collapsed,
  showTooltip,
  hideTooltip,
  danger = false,
  onClick = undefined,
}) => {
  const openTooltip = (event) => {
    if (collapsed) showTooltip(label, event.currentTarget);
  };
  const closeTooltip = () => {
    if (collapsed) hideTooltip();
  };

  const body = (active = false) => (
    <>
      <span className="v-sidebar__row-icon">
        <Icon name={icon} className="v-sidebar__icon" fill={active ? 1 : 0} />
      </span>
      <span className="v-sidebar__label" aria-hidden={collapsed ? 'true' : undefined}>
        {label}
      </span>
    </>
  );

  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        aria-label={label}
        className={({ isActive }) => `v-sidebar__row${isActive ? ' is-active' : ''}`}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
      >
        {({ isActive }) => body(isActive)}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      className={`v-sidebar__row${danger ? ' is-danger' : ''}`}
      onClick={onClick}
      aria-label={label}
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
      onFocus={openTooltip}
      onBlur={closeTooltip}
    >
      {body()}
    </button>
  );
};

export default function AdminSidebar({ items, collapsed = false, onToggle = undefined }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tooltip, setTooltip] = useState(null);

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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminName = user?.name || 'Administrator';

  return (
    <>
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
        id="admin-sidebar"
        aria-label="Admin console navigation"
        className={`v-sidebar adm-sidebar${collapsed ? ' is-collapsed' : ''}`}
      >
        <div className="v-sidebar__head">
          <Link to="/admin" className="v-sidebar__brand" aria-label="Vitalis admin home">
            <span className="v-sidebar__brand-mark">
              <img src="/pwa-192x192.png" alt="" />
            </span>
            <span className="v-sidebar__brand-copy adm-sidebar__brand-copy" aria-hidden={collapsed ? 'true' : undefined}>
              <span className="adm-sidebar__brand-name">Vitalis</span>
              <span className="adm-sidebar__brand-sub">Admin Console</span>
            </span>
          </Link>

          <button
            type="button"
            className="v-sidebar__toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar"
            title={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
          >
            <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} />
          </button>
        </div>

        <div className="v-sidebar__body">
          <div className="v-sidebar__group-head" aria-hidden={collapsed ? 'true' : undefined}>
            Console
          </div>
          <nav aria-label="Admin sections" className="v-sidebar__nav">
            {items.map((item) => (
              <AdminRow
                key={item.to}
                to={item.to}
                end={item.end}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                showTooltip={showTooltip}
                hideTooltip={() => setTooltip(null)}
              />
            ))}
          </nav>
        </div>

        <div className="v-sidebar__foot">
          <div className="v-sidebar__group-head" aria-hidden={collapsed ? 'true' : undefined}>
            Account
          </div>

          <div
            className="adm-sidebar__account"
            title={collapsed ? `${adminName} — Elevated access` : undefined}
          >
            <span className="adm-sidebar__avatar" aria-hidden="true">{initials(adminName)}</span>
            <span className="adm-sidebar__account-copy" aria-hidden={collapsed ? 'true' : undefined}>
              <span className="adm-sidebar__account-name">{adminName}</span>
              <span className="adm-sidebar__account-role">
                <Icon name="verified_user" /> Elevated access
              </span>
            </span>
          </div>

          <AdminRow
            icon="logout"
            label="Sign out"
            danger
            collapsed={collapsed}
            showTooltip={showTooltip}
            hideTooltip={() => setTooltip(null)}
            onClick={handleLogout}
          />
        </div>
      </aside>
    </>
  );
}
