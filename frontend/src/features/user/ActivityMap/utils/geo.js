// Pure geo helpers for the Activity Map — no React, no DOM, no Leaflet.
// Kept dependency-free so the recording logic is unit-testable and reusable.

export const EARTH_RADIUS_M = 6371000;

// Haversine distance in metres between two [lat, lng] points.
export const haversineMeters = ([lat1, lon1], [lat2, lon2]) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Default recording gates, tuned for phone GPS while running:
//  · maxAccuracyM — a 25 m cap silently dropped most real fixes; 50 m keeps
//    genuinely usable readings without accepting obvious junk.
//  · minMoveM      — sub-metre change is jitter / a repeated fix.
//  · maxSpeedMps   — ~43 km/h; faster between fixes is a teleport, not a step.
export const DEFAULT_GATES = {
  maxAccuracyM: 50,
  minMoveM: 0.8,
  maxSpeedMps: 12,
};

// Decide whether a fresh fix should extend the recorded route.
// `prev` = { lat, lng, t } | null · `fix` = { lat, lng, accuracy } · nowMs.
// Returns { accept, reason } with reason ∈ ok | accuracy | duplicate | jump | invalid.
export const evaluateFix = (prev, fix, nowMs, gates = DEFAULT_GATES) => {
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) {
    return { accept: false, reason: 'invalid' };
  }

  const acc = Number.isFinite(fix.accuracy) ? fix.accuracy : null;
  if (acc != null && acc > gates.maxAccuracyM) {
    return { accept: false, reason: 'accuracy' };
  }

  if (prev && Number.isFinite(prev.lat) && Number.isFinite(prev.lng)) {
    const dist = haversineMeters([prev.lat, prev.lng], [fix.lat, fix.lng]);
    if (dist < gates.minMoveM) return { accept: false, reason: 'duplicate' };
    const dt = Math.max(0.001, (nowMs - prev.t) / 1000);
    if (dist / dt > gates.maxSpeedMps) return { accept: false, reason: 'jump' };
  }

  return { accept: true, reason: 'ok' };
};

// mm:ss / m:ss pace string from minutes-per-km. Returns '–' when unknown.
export const formatPace = (seconds, distanceKm) => {
  const d = Number(distanceKm);
  const t = Number(seconds);
  if (!(d > 0.001) || !Number.isFinite(t) || t <= 0) return '–';
  const perKm = t / d;
  const m = Math.floor(perKm / 60);
  const s = Math.floor(perKm % 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
};
