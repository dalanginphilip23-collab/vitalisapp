// Pure formatting/derivation helpers shared by the Dashboard page and its
// widgets. Kept dependency-free so they can be unit-tested or reused by any
// other feature that displays workout/activity data.
export const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export const minutesFromSeconds = (seconds) => Math.round((Number(seconds) || 0) / 60);

// 'strength' → 'Strength', 'full_body' → 'Full body'
export const workoutLabel = (type) => {
  const s = String(type || 'general').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const fmtClock = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const fmtShortDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const startOfLocalDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const isToday = (value) => {
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && startOfLocalDay(d).getTime() === startOfLocalDay(new Date()).getTime();
};
