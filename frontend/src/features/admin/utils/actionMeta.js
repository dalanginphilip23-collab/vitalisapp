export const ACTION_META = {
  role_change: { label: 'Role changed', tone: 'info', icon: 'manage_accounts' },
  deactivate: { label: 'Account deactivated', tone: 'off', icon: 'person_off' },
  reactivate: { label: 'Account reactivated', tone: 'active', icon: 'person_check' },
  force_signout: { label: 'Force sign-out', tone: 'warn', icon: 'logout' },
  delete_user: { label: 'Account deleted', tone: 'off', icon: 'delete_forever' },
  delete_post: { label: 'Post removed', tone: 'warn', icon: 'gavel' },
};

export const metaForAction = (action) => (
  ACTION_META[action] || { label: action || 'Admin action', tone: 'member', icon: 'bolt' }
);
