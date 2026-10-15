import { safeGet } from './storage.js';

// Single home for the Metric/Imperial preference. The backend stores metric
// values everywhere (weight_kg, height_cm) — this module converts at the UI
// edge so math (BMI/BMR/goals) always stays metric.
export const UNITS_CHANGED_EVENT = 'vitalis:units-changed';

export function getUnits() {
  try {
    return safeGet('vitalis:units', 'metric') === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

export function notifyUnitsChanged() {
  try {
    window.dispatchEvent(new Event(UNITS_CHANGED_EVENT));
  } catch { /* non-DOM (tests) — safe to ignore */ }
}

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const round1 = (n) => Math.round(Number(n) * 10) / 10;

export const kgToLb = (kg) => round1(Number(kg) / KG_PER_LB);
export const lbToKg = (lb) => round1(Number(lb) * KG_PER_LB);

// Total inches -> { ft, inch } with inches rounded to 1 decimal.
export function cmToFtIn(cm) {
  const totalIn = Number(cm) / CM_PER_IN;
  const ft = Math.floor(totalIn / 12);
  const inch = round1(totalIn - ft * 12);
  return { ft, inch };
}

export const ftInToCm = (ft, inch) => round1((Number(ft) * 12 + Number(inch)) * CM_PER_IN);

// Display formatters. Null-safe: render '—' for missing values.
export function formatWeight(kg, units = getUnits()) {
  if (kg == null || !Number.isFinite(Number(kg))) return '—';
  return units === 'imperial' ? `${kgToLb(kg).toFixed(1)} lb` : `${Number(kg).toFixed(1)} kg`;
}

export function formatHeight(cm, units = getUnits()) {
  if (cm == null || !Number.isFinite(Number(cm))) return '—';
  if (units !== 'imperial') return `${Number(cm).toFixed(1)} cm`;
  const { ft, inch } = cmToFtIn(cm);
  return `${ft}'${inch.toFixed(1)}"`;
}

// Short weight unit for compact spots ("70 → 65 kg" style ranges).
export function weightUnit(units = getUnits()) {
  return units === 'imperial' ? 'lb' : 'kg';
}
