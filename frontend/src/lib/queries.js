// Shared React Query keys. Hooks fetch via apiFetch; client is cache-write layer only.
export const qk = {
  dashboard: (userId) => ['dashboard', userId],
  sleepToday: (userId) => ['sleep', 'today', userId],
  sleepRange: (userId, range, metric) => ['sleep', userId, range, metric],
  todayMeals: (userId) => ['meals', 'today', userId],
  foodLogs: (userId) => ['food-logs', userId],
  nutrientGoals: (userId) => ['nutrient-goals', userId],
};
