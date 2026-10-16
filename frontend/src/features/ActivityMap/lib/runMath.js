// Pure GPS run math — no React, no I/O. Shared by useRunTimer and unit tests.
//
// The old filter gated on raw per-segment distance (1m < d < 50m) with no
// notion of time: three 40m fixes in one tick counted 120m (~432 km/h),
// while a legit 60m leg over a slow 5s fix was dropped. Speed (m/s) fixes
// both directions.

export const EARTH_RADIUS_M = 6371000;

// Below this a segment is GPS dither, not movement.
export const MIN_SEG_M = 1;
// Above this per-second speed a segment is a teleport, not a run.
// 20 m/s = 72 km/h: generous for downhill sprint bursts; sustained abuse is
// still caught by the server 50 km/h average gate.
export const MAX_RUN_SPEED_MPS = 20;
// Fixes farther apart than this mean GPS was lost mid-run — the jump between
// them is stale data, not distance covered.
export const MAX_FIX_GAP_SEC = 30;
// After (re)start, skip segments until the receiver settles: fixes worse than
// this (or missing accuracy) are ignored, up to MAX_SETTLE_SKIPS segments.
export const SETTLE_ACC_M = 15;
export const MAX_SETTLE_SKIPS = 5;

// Haversine distance in meters. Accepts [lat, lng] arrays (our path format)
// or { lat, lng } / { latitude, longitude } objects (server payloads).
export function haversineDistanceM(a, b) {
  const norm = (p) => {
    if (Array.isArray(p)) return [Number(p[0]), Number(p[1])];
    if (p && typeof p === 'object') {
      const lat = p.lat ?? p.latitude;
      const lng = p.lng ?? p.lon ?? p.long ?? p.longitude;
      return [Number(lat), Number(lng)];
    }
    return [NaN, NaN];
  };
  const [lat1, lon1] = norm(a);
  const [lat2, lon2] = norm(b);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Speed-gated segment verdict. Returns { ok, reason } — reason is one of
// 'ok' | 'no-time' | 'stale-gap' | 'jitter' | 'teleport'.
export function acceptSegment({ deltaM, dtSec }) {
  if (!Number.isFinite(deltaM) || !Number.isFinite(dtSec) || dtSec <= 0) {
    return { ok: false, reason: 'no-time' };
  }
  if (dtSec > MAX_FIX_GAP_SEC) return { ok: false, reason: 'stale-gap' };
  if (deltaM < MIN_SEG_M) return { ok: false, reason: 'jitter' };
  if (deltaM / dtSec > MAX_RUN_SPEED_MPS) return { ok: false, reason: 'teleport' };
  return { ok: true, reason: 'ok' };
}

// Legacy distance-only gate for fixes without timestamps (old recordings,
// mocked paths). Preserves the previous 1m < d < 50m behavior exactly.
export function acceptLegacySegment(deltaM) {
  return Number.isFinite(deltaM) && deltaM > MIN_SEG_M && deltaM < 50;
}

// Post-(re)start settle decision. Returns { skip, budget } where budget is
// the remaining skip allowance. Skips while the newest fix is unsettled
// (missing/worse accuracy); locks on (budget 0) at the first good fix.
export function settleDecision(acc, budget) {
  if (budget <= 0) return { skip: false, budget: 0 };
  if (!Number.isFinite(acc) || acc > SETTLE_ACC_M) {
    return { skip: true, budget: budget - 1 };
  }
  return { skip: false, budget: 0 };
}
