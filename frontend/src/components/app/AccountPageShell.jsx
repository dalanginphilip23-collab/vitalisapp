import AppShell from '../AppShell.jsx';

/**
 * Hosts an account page inside the member shell by default.
 *
 * The admin console renders the exact same page with `embedded`, so the
 * console rail/topbar stays in charge of navigation while the page keeps all
 * of its real data and behaviour. No second implementation to drift.
 */
export default function AccountPageShell({
  embedded = false,
  userId = undefined,
  onLogout = undefined,
  mobileTitle = undefined,
  contentClassName = 'app-container',
  bottomNav = undefined,
  children = undefined,
}) {
  if (embedded) {
    return (
      <div className="vapp adm-account-surface">
        <div className={contentClassName}>{children}</div>
      </div>
    );
  }

  return (
    <AppShell
      userId={userId}
      onLogout={onLogout}
      mobileTitle={mobileTitle}
      contentClassName={contentClassName}
      bottomNav={bottomNav}
    >
      {children}
    </AppShell>
  );
}
