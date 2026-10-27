// Gram-based nutrition math — pure unit tests (no DB, no AI, node:test).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  per100FromServing,
  scaleFromPer100,
  kcalFromMacros,
  normalizeGrams,
  normalizeFoodName,
  sanitizeDensity,
} = require('../../src/utils/nutrition');

describe('per100FromServing', () => {
  it('converts a reference serving to per 100 g', () => {
    // Medium banana: 105 kcal / 1.3 P / 27 C / 0.4 F for 118 g.
    assert.deepEqual(
      per100FromServing({ calories: 105, protein: 1.3, carbs: 27, fat: 0.4, serving_grams: 118 }),
      { calories: 89, protein: 1.1, carbs: 22.9, fat: 0.3 },
    );
  });

  it('returns null when the serving has no gram weight', () => {
    assert.equal(per100FromServing({ calories: 105, protein: 1.3, carbs: 27, fat: 0.4 }), null);
    assert.equal(per100FromServing({ calories: 105, serving_grams: 0 }), null);
    assert.equal(per100FromServing({ serving_grams: 'abc' }), null);
  });

  it('handles decimal grams without floating-point drift', () => {
    assert.deepEqual(
      per100FromServing({ calories: 145, protein: 4.16, carbs: 28.1, fat: 1.7, serving_grams: 28.3 }),
      { calories: 512, protein: 14.7, carbs: 99.3, fat: 6 },
    );
  });
});

describe('scaleFromPer100', () => {
  const rice = { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 };

  it('scales all four values to the entered weight', () => {
    assert.deepEqual(scaleFromPer100(rice, 250), {
      grams: 250,
      calories: 325,
      protein: 6.8,
      carbs: 70.5,
      fat: 0.8,
    });
  });

  it('accepts numeric strings from the form', () => {
    const scaled = scaleFromPer100(rice, '150');
    assert.equal(scaled.grams, 150);
    assert.equal(scaled.calories, 195);
  });

  it('returns null for empty, zero or invalid weights', () => {
    assert.equal(scaleFromPer100(rice, ''), null);
    assert.equal(scaleFromPer100(rice, 0), null);
    assert.equal(scaleFromPer100(rice, -5), null);
    assert.equal(scaleFromPer100(rice, 'abc'), null);
    assert.equal(scaleFromPer100(null, 150), null);
  });
});

describe('normalizeGrams', () => {
  it('rounds to one decimal and caps runaway values', () => {
    assert.equal(normalizeGrams('12.34'), 12.3);
    assert.equal(normalizeGrams(20000), 10000);
  });

  it('treats empty / invalid / non-positive as no weight', () => {
    for (const value of ['', null, undefined, 0, -3, 'abc']) {
      assert.equal(normalizeGrams(value), null);
    }
  });
});

describe('kcalFromMacros', () => {
  it('derives kcal from Atwater factors', () => {
    assert.equal(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 }), 165);
    assert.equal(kcalFromMacros({ protein: 0, carbs: 0, fat: 0 }), 0);
  });

  it('never returns a negative calorie count', () => {
    assert.equal(kcalFromMacros({ protein: -10, carbs: -20, fat: -5 }), 0);
  });
});

describe('normalizeFoodName', () => {
  it('collapses case, punctuation and whitespace for cache keys', () => {
    assert.equal(normalizeFoodName('  Chicken   Adobo + Rice '), 'chicken adobo rice');
    assert.equal(normalizeFoodName('Chicken Adobo + Rice'), normalizeFoodName('chicken adobo rice'));
  });

  it('caps the key length', () => {
    assert.equal(normalizeFoodName('a'.repeat(400)).length, 160);
  });
});

describe('sanitizeDensity', () => {
  it('accepts a flat or nested per-100 g payload', () => {
    const expected = { calories: 165, protein: 31, carbs: 0, fat: 3.6 };
    assert.deepEqual(
      sanitizeDensity({ calories: 165, protein: '31', carbs: '0', fat: '3.6' }),
      expected,
    );
    assert.deepEqual(sanitizeDensity({ per100: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } }), expected);
  });

  it('clamps implausible values instead of trusting them', () => {
    assert.deepEqual(sanitizeDensity({ calories: 2000, protein: 500, carbs: -1, fat: 90 }), {
      calories: 900,
      protein: 100,
      carbs: 0,
      fat: 90,
    });
  });

  it('rejects unusable payloads', () => {
    assert.equal(sanitizeDensity(null), null);
    assert.equal(sanitizeDensity({ calories: 100 }), null);
    assert.equal(sanitizeDensity({ calories: 0, protein: 0, carbs: 0, fat: 0 }), null);
  });
});
