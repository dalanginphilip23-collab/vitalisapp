// tests/unit/training-insights.test.js — Module 5 adaptive tip rules (pure, no DB).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildTips } = require('../../src/services/trainingInsights.service');

// Base stats object matching collectStats() shape; each case overrides what it cares about.
const baseStats = () => ({
  lookbackDays: 28,
  completed: 4, cancelled: 0, active: 0, paused: 0, totalSessions: 4,
  completionRate: 100, avgMinutes7d: 30, avgRating: 3,
  recentRatings: [3, 3], volumeLast14: 0, volumePrev14: 0,
  streak: 1, minutesThisWeek: 60,
});

describe('buildTips — hard-streak guardrails (never auto-increase)', () => {
  it('3 recent hard ratings → hold intensity + shorter-session suggestion', () => {
    const stats = { ...baseStats(), recentRatings: [5, 4, 4], avgRating: 4.3 };
    const tips = buildTips(stats);
    assert.ok(tips.some((t) => t.type === 'no_progression' && t.action === null));
    assert.ok(tips.some((t) => t.action === 'shorter'));
  });

  it('2+ mixed ratings not all hard → no hold-intensity tip', () => {
    const stats = { ...baseStats(), recentRatings: [4, 2] };
    const tips = buildTips(stats);
    assert.ok(!tips.some((t) => t.type === 'no_progression'));
  });
});

describe('buildTips — struggling users get shorter sessions', () => {
  it('40%+ cancelled → shorter-sessions tip with apply action', () => {
    const stats = { ...baseStats(), completed: 2, cancelled: 2, totalSessions: 4, completionRate: 50 };
    const tips = buildTips(stats);
    const shorter = tips.find((t) => t.type === 'suggest_shorter');
    assert.ok(shorter, 'expects suggest_shorter');
    assert.equal(shorter.action, 'shorter');
  });

  it('completion < 50% with skips → shorter tip even without 40% cancellations', () => {
    const stats = { ...baseStats(), completed: 3, cancelled: 3, totalSessions: 10, completionRate: 30 };
    const tips = buildTips(stats);
    assert.ok(tips.some((t) => t.action === 'shorter'));
  });
});

describe('buildTips — overuse', () => {
  it('5+ day streak and 150+ weekly minutes → recovery tip', () => {
    const stats = { ...baseStats(), streak: 6, minutesThisWeek: 210 };
    const tips = buildTips(stats);
    assert.ok(tips.some((t) => t.type === 'recovery'));
  });
});

describe('buildTips — gentle step-up is suggested, never applied', () => {
  it('consistent easy ratings + steady completion → optional gentle tip', () => {
    const stats = { ...baseStats(), recentRatings: [1, 1, 1], avgRating: 1 };
    const tips = buildTips(stats);
    const gentle = tips.find((t) => t.type === 'suggest_gentle');
    assert.ok(gentle, 'expects suggest_gentle');
    assert.equal(gentle.action, 'gentle');
  });

  it('easy ratings with poor completion → no gentle tip (earn the step-up)', () => {
    const stats = { ...baseStats(), recentRatings: [1, 2, 1], avgRating: 1.3, completionRate: 40, cancelled: 5, completed: 3, totalSessions: 9 };
    const tips = buildTips(stats);
    assert.ok(!tips.some((t) => t.type === 'suggest_gentle'));
  });
});

describe('buildTips — volume trend is informational only', () => {
  it('big drop → info tip with no apply action', () => {
    const stats = { ...baseStats(), volumeLast14: 800, volumePrev14: 2000 };
    const tips = buildTips(stats);
    const info = tips.find((t) => t.type === 'info');
    assert.ok(info, 'expects volume info tip');
    assert.equal(info.action, null);
  });

  it('flat volume → no volume tip', () => {
    const stats = { ...baseStats(), volumeLast14: 1500, volumePrev14: 1400 };
    const tips = buildTips(stats);
    assert.ok(!tips.some((t) => /volume/i.test(t.title) || /trending/i.test(t.title)));
  });
});

describe('buildTips — Module 6 activity-trend rules (real active minutes)', () => {
  it('activity down ≥50% — shorter-days suggestion, one click, never automatic', () => {
    const stats = { ...baseStats(), weeklyMinsPrior: 120, weeklyMinsRecent: 40, weeklyMinsChangePct: -67 };
    const tips = buildTips(stats);
    const drop = tips.find((t) => t.type === 'activity_drop');
    assert.ok(drop, 'expects activity_drop tip');
    assert.equal(drop.action, 'shorter');
    assert.match(drop.message, /40 min\/week/);
  });

  it('activity up ≥20% — reinforcement only, never an intensity increase', () => {
    const stats = { ...baseStats(), weeklyMinsPrior: 60, weeklyMinsRecent: 90, weeklyMinsChangePct: 50 };
    const tips = buildTips(stats);
    const rise = tips.find((t) => /climbing/i.test(t.title));
    assert.ok(rise, 'expects activity climbing tip');
    assert.equal(rise.action, null);
    assert.ok(!tips.some((t) => t.action === 'gentle' && t.type === 'suggest_gentle' && !/easy/i.test(t.message)));
  });

  it('small change (<20%) — no activity tip', () => {
    const stats = { ...baseStats(), weeklyMinsPrior: 100, weeklyMinsRecent: 90, weeklyMinsChangePct: -10 };
    const tips = buildTips(stats);
    assert.ok(!tips.some((t) => /Activity/i.test(t.title)));
  });

  it('no prior activity data — no activity tip at all', () => {
    const stats = { ...baseStats(), weeklyMinsPrior: 0, weeklyMinsRecent: 0, weeklyMinsChangePct: null };
    const tips = buildTips(stats);
    assert.ok(!tips.some((t) => /Activity/i.test(t.title)));
  });
});

describe('buildTips — fallback', () => {
  it('nothing detected but sessions exist → reassuring info tip', () => {
    const tips = buildTips(baseStats());
    assert.equal(tips.length, 1);
    assert.equal(tips[0].type, 'info');
    assert.equal(tips[0].action, null);
  });

  it('no sessions at all → empty tip list (no noise before first workout)', () => {
    const stats = { ...baseStats(), completed: 0, totalSessions: 0, completionRate: null, streak: 0, minutesThisWeek: 0 };
    assert.deepEqual(buildTips(stats), []);
  });
});
