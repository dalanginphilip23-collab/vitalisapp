// Gram-based nutrition math for the manual meal form.
// Mirrors backend/src/utils/nutrition.js (same rounding + clamps) so a value
// previewed in the form is identical to what gets persisted and re-rendered.
// Pure functions only — unit tested in tests/unit/nutrition.test.js.

export const MAX_GRAMS = 10000;

export function round1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export function roundKcal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

// Empty / 0 / non-numeric means "no weight given" → null (not 0).
export function normalizeGrams(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.max(Math.round(n * 10) / 10, 0.1), MAX_GRAMS);
}

// Scale a per-100 g density to the entered weight. Returns null when there is
// no usable weight (the form then clears stale macros instead of saving them).
export function scaleFromPer100(per100, grams) {
  const g = normalizeGrams(grams);
  if (!g || !per100 || typeof per100 !== "object") return null;
  const factor = g / 100;
  return {
    grams: g,
    calories: Math.max(0, roundKcal((Number(per100.calories) || 0) * factor)),
    protein: Math.max(0, round1((Number(per100.protein) || 0) * factor)),
    carbs: Math.max(0, round1((Number(per100.carbs) || 0) * factor)),
    fat: Math.max(0, round1((Number(per100.fat) || 0) * factor)),
  };
}

// Atwater estimate — used when a macro is edited by hand.
export function kcalFromMacros({ protein = 0, carbs = 0, fat = 0 } = {}) {
  return Math.max(
    0,
    Math.round((Number(protein) || 0) * 4 + (Number(carbs) || 0) * 4 + (Number(fat) || 0) * 9),
  );
}

export function isPer100(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      Number.isFinite(Number(value.calories)) &&
      Number.isFinite(Number(value.protein)) &&
      Number.isFinite(Number(value.carbs)) &&
      Number.isFinite(Number(value.fat)),
  );
}

// Input-friendly display: no trailing ".0", one decimal max.
export function toInputValue(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = round1(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatAmount(value) {
  return toInputValue(value);
}
