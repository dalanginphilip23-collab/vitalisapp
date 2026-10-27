// Gram-based nutrition math — pure unit tests (no DOM, node --test).
// Must stay in lockstep with backend/tests/unit/nutrition.test.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGrams,
  scaleFromPer100,
  kcalFromMacros,
  isPer100,
  toInputValue,
  MAX_GRAMS,
} from "../../src/lib/nutrition.js";

describe("normalizeGrams", () => {
  it("rounds to one decimal", () => {
    assert.equal(normalizeGrams("12.34"), 12.3);
    assert.equal(normalizeGrams("250"), 250);
  });

  it("caps runaway values", () => {
    assert.equal(normalizeGrams(20000), MAX_GRAMS);
  });

  it("treats empty / invalid / non-positive as no weight", () => {
    for (const value of ["", null, undefined, 0, -3, "abc"]) {
      assert.equal(normalizeGrams(value), null);
    }
  });
});

describe("scaleFromPer100", () => {
  const rice = { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 };

  it("scales all four values to the entered weight", () => {
    assert.deepEqual(scaleFromPer100(rice, 250), {
      grams: 250,
      calories: 325,
      protein: 6.8,
      carbs: 70.5,
      fat: 0.8,
    });
  });

  it("accepts numeric strings from the form", () => {
    const scaled = scaleFromPer100(rice, "150");
    assert.equal(scaled.grams, 150);
    assert.equal(scaled.calories, 195);
  });

  it("clears values for an empty weight", () => {
    assert.equal(scaleFromPer100(rice, ""), null);
    assert.equal(scaleFromPer100(rice, 0), null);
    assert.equal(scaleFromPer100(null, 200), null);
  });
});

describe("kcalFromMacros", () => {
  it("derives kcal from Atwater factors", () => {
    assert.equal(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 }), 165);
  });

  it("never returns a negative calorie count", () => {
    assert.equal(kcalFromMacros({ protein: -10, carbs: -20, fat: -5 }), 0);
  });
});

describe("isPer100", () => {
  it("requires all four numeric values", () => {
    assert.equal(isPer100({ calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 }), true);
    assert.equal(isPer100({ calories: 130, protein: 2.7, carbs: 28.2 }), false);
    assert.equal(isPer100(null), false);
  });
});

describe("toInputValue", () => {
  it("drops trailing zeros but keeps one decimal", () => {
    assert.equal(toInputValue(465), "465");
    assert.equal(toInputValue(30), "30");
    assert.equal(toInputValue(6.75), "6.8");
    assert.equal(toInputValue(""), "");
  });
});
