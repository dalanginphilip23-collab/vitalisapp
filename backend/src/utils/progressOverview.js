// Pure date-bucketing + aggregation for the Logs "Progress Overview" chart.
// No DB / no I/O: the service feeds normalized daily rows in, this module
// chooses an adaptive granularity and returns chart-ready series.
//
// Adaptive buckets keep the line readable:
//   <= 92 days   -> one point per day
//   <= 450 days  -> one point per calendar week (Mon–Sun)
//   longer       -> one point per calendar month
//
// Activity is a SUM (zero on rest days), nutrition is an AVERAGE per logged
// day, and weight/waist keep the LAST measurement in each bucket. Missing
// nutrition/body buckets stay null so the line skips them instead of lying
// with a zero.

const RANGES = ['30d', '90d', '1y', 'all'];
const RANGE_DAYS = { '30d': 30, '90d': 90, '1y': 365 };

function normalizeRange(raw) {
  return RANGES.includes(raw) ? raw : '90d';
}

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (iso, days) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const diffDays = (start, end) => Math.round((parseISO(end) - parseISO(start)) / 86400000);

function todayISO(now = new Date()) {
  return toISO(now);
}

function rangeStartISO(range, today = todayISO()) {
  if (range === 'all') return null;
  const days = RANGE_DAYS[normalizeRange(range)] || 90;
  return addDays(today, -(days - 1));
}

function startOfWeekISO(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return toISO(d);
}

function startOfMonthISO(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function endOfMonthISO(iso) {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function chooseBucket(spanDays) {
  if (spanDays <= 92) return 'day';
  if (spanDays <= 450) return 'week';
  return 'month';
}

function fmtShort(iso, withYear = false) {
  const d = parseISO(iso);
  const base = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return withYear ? `${base} '${String(d.getFullYear()).slice(2)}` : base;
}

function fullLabel(iso, bucket) {
  const d = parseISO(iso);
  if (bucket === 'month') {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (bucket === 'week') {
    return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function buildBuckets(startISO, endISO, bucket) {
  if (bucket === 'month') {
    const out = [];
    const start = parseISO(startOfMonthISO(startISO));
    const end = parseISO(startOfMonthISO(endISO));
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      const key = `${y}-${pad(m + 1)}-01`;
      const d = new Date(y, m, 1);
      out.push({
        start: key,
        end: endOfMonthISO(key),
        label: `${d.toLocaleDateString('en-US', { month: 'short' })} '${String(y).slice(2)}`,
        fullLabel: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      });
      m += 1;
      if (m === 12) { m = 0; y += 1; }
    }
    return out;
  }

  const spansYears = startISO.slice(0, 4) !== endISO.slice(0, 4);
  const step = bucket === 'week' ? 7 : 1;
  const out = [];
  let cursor = bucket === 'week' ? startOfWeekISO(startISO) : startISO;
  while (cursor <= endISO) {
    out.push({
      start: cursor,
      end: addDays(cursor, step - 1),
      label: fmtShort(cursor, spansYears),
      fullLabel: fullLabel(cursor, bucket),
    });
    cursor = addDays(cursor, step);
  }
  return out;
}

const round1 = (n) => Math.round(n * 10) / 10;

function findBucket(buckets, day) {
  let lo = 0;
  let hi = buckets.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (buckets[mid].start <= day) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 && day <= buckets[ans].end ? ans : -1;
}

function aggregateOverview({ buckets = [], workouts = [], meals = [], weights = [], waists = [] }) {
  const acc = buckets.map(() => ({
    minutes: 0, sessions: 0, kcal: 0, protein: 0, mealDays: 0,
    weight: null, waist: null,
  }));

  for (const row of workouts) {
    const i = findBucket(buckets, row.day);
    if (i < 0) continue;
    acc[i].minutes += Number(row.minutes) || 0;
    acc[i].sessions += Number(row.sessions) || 0;
  }
  for (const row of meals) {
    const i = findBucket(buckets, row.day);
    if (i < 0) continue;
    acc[i].kcal += Number(row.kcal) || 0;
    acc[i].protein += Number(row.protein) || 0;
    acc[i].mealDays += 1;
  }
  // Body rows arrive in chronological order, so the last one in a bucket wins.
  for (const row of weights) {
    const i = findBucket(buckets, row.day);
    if (i >= 0) acc[i].weight = Number(row.value);
  }
  for (const row of waists) {
    const i = findBucket(buckets, row.day);
    if (i >= 0) acc[i].waist = Number(row.value);
  }

  const points = (key) => buckets.map((b, i) => ({
    date: b.start,
    label: b.label,
    fullLabel: b.fullLabel,
    value: acc[i][key],
  }));

  const totalMinutes = workouts.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
  const sessions = workouts.reduce((s, r) => s + (Number(r.sessions) || 0), 0);
  let bestIdx = -1;
  acc.forEach((a, i) => {
    if (a.minutes > 0 && (bestIdx < 0 || a.minutes > acc[bestIdx].minutes)) bestIdx = i;
  });

  const totalKcal = meals.reduce((s, r) => s + (Number(r.kcal) || 0), 0);
  const totalProtein = meals.reduce((s, r) => s + (Number(r.protein) || 0), 0);
  const loggedDays = meals.length;

  const latestWeight = weights[weights.length - 1] || null;
  const firstWeight = weights[0] || null;
  const latestWaist = waists[waists.length - 1] || null;
  const firstWaist = waists[0] || null;
  const descriptor = (row) => (row ? { value: round1(Number(row.value)), date: row.day } : null);

  const body = (pointsKey, first, latest, count) => ({
    unit: pointsKey === 'weight' ? 'kg' : 'cm',
    aggregation: 'latest',
    points: points(pointsKey),
    latest: descriptor(latest),
    first: descriptor(first),
    change: first && latest ? round1(Number(latest.value) - Number(first.value)) : null,
    count,
  });

  return {
    minutes: {
      unit: 'min',
      aggregation: 'total',
      points: points('minutes').map((p) => ({ ...p, value: Math.round(p.value) })),
      total: Math.round(totalMinutes),
      sessions,
      best: bestIdx >= 0
        ? {
          value: Math.round(acc[bestIdx].minutes),
          label: buckets[bestIdx].label,
          fullLabel: buckets[bestIdx].fullLabel,
        }
        : null,
    },
    weight: body('weight', firstWeight, latestWeight, weights.length),
    calories: {
      unit: 'kcal',
      aggregation: 'avg',
      points: points('kcal').map((p, i) => ({
        ...p,
        value: acc[i].mealDays ? Math.round(acc[i].kcal / acc[i].mealDays) : null,
      })),
      avg: loggedDays ? Math.round(totalKcal / loggedDays) : null,
      total: Math.round(totalKcal),
      loggedDays,
    },
    protein: {
      unit: 'g',
      aggregation: 'avg',
      points: points('protein').map((p, i) => ({
        ...p,
        value: acc[i].mealDays ? Math.round(acc[i].protein / acc[i].mealDays) : null,
      })),
      avg: loggedDays ? Math.round(totalProtein / loggedDays) : null,
      loggedDays,
    },
    waist: body('waist', firstWaist, latestWaist, waists.length),
  };
}

module.exports = {
  RANGES,
  normalizeRange,
  todayISO,
  rangeStartISO,
  addDays,
  diffDays,
  startOfWeekISO,
  startOfMonthISO,
  chooseBucket,
  buildBuckets,
  aggregateOverview,
};
