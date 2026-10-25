// Landing-page "Integrated modules" stat. Single source of truth for how many
// tracking modules Vitalis ships. Add or remove a module here and the landing
// number updates on the next public/landing-stats read (60s cache).
const LANDING_MODULES = [
  { key: 'meal-tracker', name: 'Nutrition & meals', route: '/dashboard/meal-tracker' },
  { key: 'workouts', name: 'Camera workouts', route: '/dashboard/workouts' },
  { key: 'activity-map', name: 'Activity & GPS', route: '/dashboard/activity-map' },
  { key: 'logs', name: 'Progress logs', route: '/dashboard/logs' },
  { key: 'community', name: 'Community feed', route: '/dashboard/community' },
  { key: 'messenger', name: 'Messages', route: '/dashboard/messenger' },
  { key: 'plans', name: 'Training plans', route: '/dashboard/plans' },
  { key: 'notifications', name: 'Notifications', route: '/dashboard/notifications' },
];

const MODULE_COUNT = LANDING_MODULES.length;

module.exports = { LANDING_MODULES, MODULE_COUNT };
