// Shared form-status rule: Good only when BOTH alignment and symmetry
// clear 70; muted while no data. Single source for the live pill,
// the correction banner variant, and (implicitly) the summary rows.
export function formStatus(alignment, symmetry) {
  const a = Number(alignment) || 0;
  const s = Number(symmetry) || 0;
  if (a <= 0 && s <= 0) return 'idle';
  return Math.min(a, s) >= 70 ? 'good' : 'adjust';
}
