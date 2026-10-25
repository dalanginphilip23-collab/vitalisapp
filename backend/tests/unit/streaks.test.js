// tests/unit/streaks.test.js — streak rules + week/history payload.
// No DB rows touched: src/config/db is stubbed via require.cache.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../../src/config/db');

let scenario = { today: '2026-10-24', workouts: [], meals: [], checkins: [] };

const fakeDb = {
  execute: async (sql) => {
    const q = String(sql);
    if (q.includes('AS today')) return [[{ today: scenario.today }], []];
    if (q.includes('FROM workout_logs')) return [scenario.workouts.map((d) => ({ d })), []];
    if (q.includes('FROM food_logs')) return [scenario.meals.map((d) => ({ d })), []];
    if (q.includes('FROM daily_checkins')) return [scenario.checkins.map((d) => ({ d })), []];
    throw new Error(`Unexpected streak query: ${q}`);
  },
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakeDb,
};

const { getStreakSummary } = require('../../src/services/streaks.service');

function setDays({ today = '2026-10-24', workouts = [], meals = [], checkins = [] }) {
  scenario = { today, workouts, meals, checkins };
}

beforeEach(() => setDays({}));

describe('streak summary', () => {
  it('keeps a yesterday-ending run visible and marks today as not yet counted', async () => {
    setDays({
      workouts: ['2026-10-23', '2026-10-22'],
      meals: ['2026-10-22'],
    });

    const streak = await getStreakSummary(1);

    assert.equal(streak.today, '2026-10-24');
    assert.equal(streak.current, 2);
    assert.equal(streak.longest, 2);
    assert.equal(streak.activeToday, false);
    assert.deepEqual(streak.todaySources, []);
    assert.equal(streak.lastActiveDate, '2026-10-23');

    assert.equal(streak.weekStart, '2026-10-19');
    assert.equal(streak.weekEnd, '2026-10-25');
    assert.equal(streak.week.length, 7);
    assert.equal(streak.week[5].date, '2026-10-24');
    assert.equal(streak.week[5].isToday, true);
    assert.equal(streak.week[5].active, false);
    assert.equal(streak.week[6].isFuture, true);
  });

  it('counts today from any source and reports per-source detail', async () => {
    setDays({
      workouts: ['2026-10-24'],
      meals: ['2026-10-24'],
      checkins: ['2026-10-24', '2026-10-23'],
    });

    const streak = await getStreakSummary(2);

    assert.equal(streak.current, 2);
    assert.equal(streak.activeToday, true);
    assert.deepEqual(streak.todaySources, ['workout', 'meal', 'checkin']);
    assert.equal(streak.lastActiveDate, '2026-10-24');

    assert.equal(streak.week[5].active, true);
    assert.deepEqual(streak.week[5].sources, ['workout', 'meal', 'checkin']);

    const today = streak.history[streak.history.length - 1];
    assert.equal(today.date, '2026-10-24');
    assert.equal(today.active, true);
    assert.equal(today.count, 3);
  });

  it('accepts a single source as a qualifying day', async () => {
    setDays({ checkins: ['2026-10-24'] });

    const streak = await getStreakSummary(3);

    assert.equal(streak.current, 1);
    assert.equal(streak.activeToday, true);
    assert.deepEqual(streak.todaySources, ['checkin']);
  });

  it('computes the longest run across gaps and ignores future rows', async () => {
    setDays({
      workouts: [
        '2026-10-10', '2026-10-11', '2026-10-12',
        '2026-10-15',
        '2026-10-24', '2026-10-25',
      ],
    });

    const streak = await getStreakSummary(4);

    assert.equal(streak.current, 1);
    assert.equal(streak.longest, 3);
    assert.equal(streak.activeToday, true);
    assert.equal(streak.lastActiveDate, '2026-10-24');
    assert.equal(streak.week[6].isFuture, true);
    assert.equal(streak.week[6].active, false);
  });

  it('resets the current run when the last activity is older than yesterday', async () => {
    setDays({ workouts: ['2026-10-22', '2026-10-21'] });

    const streak = await getStreakSummary(5);

    assert.equal(streak.current, 0);
    assert.equal(streak.longest, 2);
    assert.equal(streak.activeToday, false);
  });

  it('returns an oldest-first 90-day series ending today', async () => {
    setDays({
      meals: ['2026-10-24', '2026-10-23'],
      checkins: ['2026-10-23'],
    });

    const streak = await getStreakSummary(6);

    assert.equal(streak.history.length, 90);
    assert.equal(streak.history[0].date, '2026-07-27');
    assert.equal(streak.history[88].date, '2026-10-23');
    assert.equal(streak.history[88].count, 2);
    assert.deepEqual(streak.history[88].sources, ['meal', 'checkin']);
    assert.equal(streak.history[89].date, '2026-10-24');
    assert.equal(streak.history[89].active, true);
  });
});
