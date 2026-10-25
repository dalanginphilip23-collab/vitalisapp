// Module 4 — meal slot shared between the scan result sheet and the manual
// form. The slot is persisted on food_logs.meal_type (printer-friendly names
// match the diary grouping in MealTracker.jsx).
export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'];

export function suggestMealSlot(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 10.5) return 'Breakfast';
  if (h >= 10.5 && h < 14) return 'Lunch';
  if (h >= 14 && h < 21.5) return 'Dinner';
  return 'Snack';
}
