export const MAIN_NAV = [
  { key: 'dashboard',   label: 'Dashboard',  icon: 'dashboard',       path: '/dashboard' },

  { key: 'nutrition',   label: 'Nutrition',  icon: 'restaurant',      path: '/dashboard/meal-tracker' },
  { key: 'training',    label: 'Training',   icon: 'exercise',        path: '/dashboard/workouts' },
  // Plans sits with Training (plan programs drive workouts) — kept reachable per master plan.
  { key: 'plans',       label: 'Plans',      icon: 'book',            path: '/dashboard/plans' },
  { key: 'activity',    label: 'Activity',   icon: 'directions_run',  path: '/dashboard/activity-map' },
  { key: 'progress',    label: 'Progress',   icon: 'history',         path: '/dashboard/logs' },
  // Messenger — real conversations only (the old AI contact was removed).
  { key: 'messenger',   label: 'Messenger', icon: 'forum',             path: '/dashboard/messenger' },
  { key: 'community',   label: 'Community',  icon: 'groups',          path: '/dashboard/community' },
];

// Desktop nav — single source. Sidebar.jsx consumes NAV_ITEMS.
const toNavEntry = ({ key, label, icon, path }) => ({ key, icon, label, name: label, path });
export const NAV_ITEMS = MAIN_NAV.map(toNavEntry);

export const getSettingsItems = (navigate, basePath = '/dashboard') => [
  { icon: 'person',        label: 'Profile',        accent: true, action: () => navigate(`${basePath}/profile`) },
  { icon: 'tune',          label: 'Preferences',                  action: () => navigate(`${basePath}/preferences`) },
  { icon: 'notifications', label: 'Notifications',               action: () => navigate(`${basePath}/notifications`) },
  { icon: 'help',  label: 'Help & Support',              action: () => navigate(`${basePath}/help-support`) },
];

// Persistent sidebar footer entry — "Profile and Settings" area.
export const SIDEBAR_BOTTOM_NAV = [
  { key: 'profile', label: 'Profile & Settings', icon: 'person', path: '/dashboard/profile' },
];

export const ACTIVE_NAV_KEY = 'vitalis:activeNav';

// Mobile bottom bar — exactly what the phones show.
// Main 4 (always visible): Dashboard, Progress, Workout, Plans.
// Plus (+) sheet: MealTracker, Jogging, Community, Messenger, Recovery.
export const MOBILE_MAIN_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid_view',     path: '/dashboard' },
  { key: 'progress',   label: 'Progress',   icon: 'history',       path: '/dashboard/logs' },
  { key: 'workout',   label: 'Workout',   icon: 'exercise',      path: '/dashboard/workouts' },
  { key: 'plans',     label: 'Plans',     icon: 'book',          path: '/dashboard/plans' },
];

export const MOBILE_MORE_NAV = [
  { key: 'mealtracker', label: 'Meal Tracker', icon: 'restaurant',      path: '/dashboard/meal-tracker' },
  { key: 'jogging',     label: 'Activity',     icon: 'directions_run',  path: '/dashboard/activity-map' },
  { key: 'community',   label: 'Community',    icon: 'groups',          path: '/dashboard/community' },
  { key: 'messenger',   label: 'Messenger',    icon: 'forum',           path: '/dashboard/messenger' },
];