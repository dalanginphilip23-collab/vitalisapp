import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';
import Topbar from '../../../components/Topbar.jsx';
import { useAuth } from '../../../hooks/useAuth.jsx';
import { useSidebarCollapsed } from '../../../hooks/useSidebarCollapsed.js';
import AdminSidebar from './AdminSidebar.jsx';
import AdminBottomNav from './AdminBottomNav.jsx';
import '../admin.css';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'space_dashboard', end: true, blurb: 'Platform at a glance' },
  { to: '/admin/users', label: 'Users', icon: 'group', blurb: 'Accounts & access' },
  { to: '/admin/content', label: 'Content', icon: 'library_books', blurb: 'Plans & community' },
  { to: '/admin/ai-usage', label: 'AI Usage', icon: 'monitoring', blurb: 'Calls & quotas' },
  { to: '/admin/audit', label: 'Audit Trail', icon: 'history_edu', blurb: 'Every admin action' },
];

/**
 * Console search lives in the shared topbar, matching the member app. It
 * always lands on the real member directory with a shareable `?q=` filter.
 * The keyed shell remount keeps the field in sync when another control
 * (clear filters, browser back) changes the URL without an effect cascade.
 */
function AdminTopbarSearch({ initialQuery = '' }) {
  const [value, setValue] = useState(initialQuery);
  const navigate = useNavigate();

  const submit = (event) => {
    event.preventDefault();
    const query = value.trim();
    navigate(query ? `/admin/users?q=${encodeURIComponent(query)}` : '/admin/users');
  };

  return (
    <form className="adm-topsearch" role="search" onSubmit={submit}>
      <Icon name="search" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search members, emails…"
        aria-label="Search members by name or email"
        autoComplete="off"
      />
      <kbd className="adm-topsearch__kbd" aria-hidden="true">↵</kbd>
    </form>
  );
}

export default function AdminShell() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();
  const routeQuery = pathname === '/admin/users' ? (searchParams.get('q') || '') : '';

  return (
    <div className={`adm${collapsed ? ' is-sidebar-collapsed' : ''}`}>
      <a href="#admin-main" className="adm-skip">Skip to console content</a>

      <AdminSidebar items={ADMIN_NAV} collapsed={collapsed} onToggle={toggle} />

      <div className="adm-main">
        <Topbar
          userId={user?.id}
          leftOffsetClass="adm-topbar-offset"
          topbarClassName="adm-topbar-shell"
          leftSlot={(
            <AdminTopbarSearch key={routeQuery} initialQuery={routeQuery} />
          )}
        />

        <main id="admin-main" className="adm-content">
          <Outlet />
        </main>

        <AdminBottomNav items={ADMIN_NAV} />
      </div>
    </div>
  );
}
