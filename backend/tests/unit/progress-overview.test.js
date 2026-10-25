// tests/unit/progress-overview.test.js — pure bucketing + aggregation for the
// Logs "Progress Overview" chart. No DB: the service feeds these helpers.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeRange,
  rangeStartISO,
  chooseBucket,
  buildBuckets,
  aggregateOverview,
} = require('../../src/utils/progressOverview');

describe('progress overview bucketing', () => {
  it('normalizes ranges and computes inclusive windows', () => {
    assert.equal(normalizeRange('bogus'), '90d');
    assert.equal(normalizeRange('30d'), '30d');
    assert.equal(rangeStartISO('30d', '2026-10-20'), '2026-09-21');
    assert.equal(rangeStartISO('1y', '2026-10-20'), '2025-10-21');
    assert.equal(rangeStartISO('all', '2026-10-20'), null);
  });

  it('chooses adaptive granularity', () => {
    assert.equal(chooseBucket(1), 'day');
    assert.equal(chooseBucket(92), 'day');
    assert.equal(chooseBucket(93), 'week');
    assert.equal(chooseBucket(450), 'week');
    assert.equal(chooseBucket(451), 'month');
    assert.equal(chooseBucket(1000), 'month');
  });

  it('builds dense day buckets and calendar-week buckets', () => {
    const days = buildBuckets('2026-10-01', '2026-10-20', 'day');
    assert.equal(days.length, 20);
    assert.equal(days[0].start, '2026-10-01');
    assert.equal(days[19].start, '2026-10-20');
    assert.equal(days[0].fullLabel, 'Thu, Oct 1, 2026');

    const weeks = buildBuckets('2026-10-01', '2026-10-20', 'week');
    assert.equal(weeks[0].start, '2026-09-28'); // Monday
    assert.equal(weeks[0].end, '2026-10-04');
    assert.ok(weeks.every((b) => b.start <= b.end));
  });

  it('builds month buckets across a year boundary', () => {
    const months = buildBuckets('2025-11-15', '2026-02-10', 'month');
    assert.deepEqual(months.map((b) => b.start), [
      '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01',
    ]);
    assert.equal(months[3].end, '2026-02-28');
    assert.equal(months[0].fullLabel, 'November 2025');
  });

  it('sums activity, averages nutrition and keeps the last body reading', () => {
    const buckets = buildBuckets('2026-07-01', '2026-07-02', 'day');
    const metrics = aggregateOverview({
      buckets,
      workouts: [
        { day: '2026-07-01', minutes: 30, sessions: 1 },
        { day: '2026-07-02', minutes: 15, sessions: 2 },
      ],
      meals: [
        { day: '2026-07-01', kcal: 2000, protein: 120 },
        { day: '2026-07-02', kcal: 1800, protein: 100 },
      ],
      weights: [
        { day: '2026-07-01', value: 80.4 },
        { day: '2026-07-02', value: 80.0 },
      ],
      waists: [
        { day: '2026-07-01', value: 90 },
        { day: '2026-07-02', value: 89.5 },
      ],
    });

    assert.equal(metrics.minutes.total, 45);
    assert.equal(metrics.minutes.sessions, 3);
    assert.equal(metrics.minutes.points[0].value, 30);
    assert.equal(metrics.minutes.best.value, 30);

    assert.equal(metrics.calories.avg, 1900);
    assert.equal(metrics.calories.loggedDays, 2);
    assert.equal(metrics.calories.points[1].value, 1800);

    assert.equal(metrics.protein.avg, 110);
    assert.equal(metrics.weight.latest.value, 80);
    assert.equal(metrics.weight.first.value, 80.4);
    assert.equal(metrics.weight.change, -0.4);
    assert.equal(metrics.waist.latest.value, 89.5);
    assert.equal(metrics.waist.change, -0.5);
  });

  it('keeps empty days as gaps for body/nutrition but zeros for activity', () => {
    const buckets = buildBuckets('2026-07-01', '2026-07-03', 'day');
    const metrics = aggregateOverview({ buckets });
    assert.deepEqual(metrics.minutes.points.map((p) => p.value), [0, 0, 0]);
    assert.deepEqual(metrics.weight.points.map((p) => p.value), [null, null, null]);
    assert.deepEqual(metrics.calories.points.map((p) => p.value), [null, null, null]);
    assert.equal(metrics.weight.latest, null);
    assert.equal(metrics.calories.avg, null);
    assert.equal(metrics.minutes.best, null);
  });
});
