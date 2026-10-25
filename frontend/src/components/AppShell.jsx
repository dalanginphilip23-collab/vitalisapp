import { useNavigate } from 'react-router-dom';
import GlassAmbient from './GlassAmbient.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import BottomNav from './BottomNav.jsx';
import VerifyEmailBanner from './app/VerifyEmailBanner.jsx';
import { AppTopbarLeft } from './app/AppNav.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed.js';
import './app/app-ui.css';

/**
 * Shared chrome for every authenticated page.
 *
 * One rail, one topbar and one content system for the whole product.
 * Pages only supply their page content (usually a PageHeader + sections)
 * and, when relevant, a mobile title, a custom Topbar slot or a BottomNav.
 *
 * Props:
 *  - userId / onLogout / onFeedback: wired into the chrome
 *  - mobileTitle: title shown in the mobile topbar
 *  - topbarLeft:  fully custom Topbar left slot (e.g. the dashboard greeting)
 *  - contentClassName: container override (default app-container)
 *  - mainClassName: main layout override (workbench / flush pages)
 *  - bottomNav: replace the default mobile bar
 *  - ambient: toggle the ambient background layer
 */
export default function AppShell({
  userId = undefined,
  onLogout = undefined,
  onFeedback = undefined,
  mobileTitle = undefined,
  topbarLeft = undefined,
  mainClassName = '',
  contentClassName = 'app-container',
  bottomNav = undefined,
  ambient = true,
  children = undefined,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const handleLogout = onLogout ?? (async () => {
    await logout();
    navigate('/login');
  });

  return (
    <div className={`vapp${collapsed ? ' is-sidebar-collapsed' : ''}`}>
      {ambient && <GlassAmbient />}
      <div className="glass-content">
        <Sidebar onClick={handleLogout} collapsed={collapsed} onToggle={toggleSidebar} />
        <Topbar
          userId={userId}
          leftOffsetClass="app-rail-offset"
          topbarClassName="app-topbar"
          leftSlot={topbarLeft ?? <AppTopbarLeft mobileTitle={mobileTitle} />}
        />
        {/* Soft verification (Option A): reminder only, never a route wall. */}
        <VerifyEmailBanner />
        <main className={`app-main ${mainClassName}`.trim()}>
          {contentClassName ? (
            <div className={contentClassName}>{children}</div>
          ) : (
            children
          )}
        </main>
        <div className="md:hidden">
          {bottomNav === false
            ? null
            : (bottomNav ?? <BottomNav onFeedback={onFeedback} />)}
        </div>
      </div>
    </div>
  );
}
