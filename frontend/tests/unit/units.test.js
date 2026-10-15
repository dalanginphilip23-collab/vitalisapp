// Metric/Imperial conversions + formatters (backend always stays metric).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  kgToLb,
  lbToKg,
  cmToFtIn,
  ftInToCm,
  formatWeight,
  formatHeight,
  weightUnit,
} from "../../src/lib/units.js";

describe("weight conversions", () => {
  it("round-trips kg <-> lb", () => {
    assert.equal(kgToLb(70), 154.3);
    assert.equal(lbToKg(154.3), 70);
    assert.equal(lbToKg(kgToLb(80)), 80);
  });
});

describe("height conversions", () => {
  it("splits cm into ft/in and back", () => {
    assert.deepEqual(cmToFtIn(185), { ft: 6, inch: 0.8 });
    // 1-decimal inches lose ~1mm on the round trip — expected, not a bug.
    assert.equal(ftInToCm(6, 0.8), 184.9);
    assert.equal(ftInToCm(5, 10), 177.8);
  });
});

describe("formatters", () => {
  it("formats weight per system", () => {
    assert.equal(formatWeight(70, "metric"), "70.0 kg");
    assert.equal(formatWeight(70, "imperial"), "154.3 lb");
    assert.equal(formatWeight(null, "imperial"), "—");
  });
  it("formats height per system", () => {
    assert.equal(formatHeight(185, "metric"), "185.0 cm");
    assert.equal(formatHeight(185, "imperial"), `6'0.8"`);
    assert.equal(formatHeight(undefined, "metric"), "—");
  });
  it("returns the short unit", () => {
    assert.equal(weightUnit("metric"), "kg");
    assert.equal(weightUnit("imperial"), "lb");
  });
});
