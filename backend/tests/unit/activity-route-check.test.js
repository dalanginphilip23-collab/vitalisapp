const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  haversineKm,
  routeDistanceKm,
  distanceMatchesRoute,
} = require('../../src/services/activity.service');

// ~11.1m per 0.0001deg step near Manila diagonal.
function fakeRoute(n, step = 0.0001) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([14.6760 + i * step, 121.0437 + i * step]);
  return pts;
}

describe('route distance recompute (server never trusts claimed distance)', () => {
  it('haversineKm measures ~111.19km per degree of latitude', () => {
    const km = haversineKm([14.6760, 121.0437], [15.6760, 121.0437]);
    assert.ok(Math.abs(km - 111.19) < 0.5, `got ${km}`);
  });

  it('routeDistanceKm sums a polyline and tolerates object points', () => {
    const pts = fakeRoute(10);
    const km = routeDistanceKm(pts);
    assert.ok(km > 0.05 && km < 0.2, `got ${km}`);
    const objs = pts.map(([lat, lng]) => ({ lat, lng }));
    assert.ok(Math.abs(routeDistanceKm(objs) - km) < 1e-9);
  });

  it('routeDistanceKm accepts JSON strings, rejects garbage without throwing', () => {
    const pts = fakeRoute(5);
    assert.equal(routeDistanceKm(JSON.stringify(pts)), routeDistanceKm(pts));
    assert.equal(routeDistanceKm(null), null);
    assert.equal(routeDistanceKm([]), null);
    assert.equal(routeDistanceKm([[14.6]]), null); // single point
    assert.equal(routeDistanceKm('{{{nope'), null);
    assert.equal(routeDistanceKm(42), null);
  });

  it('distanceMatchesRoute accepts honest runs and skips unverifiable ones', () => {
    const pts = fakeRoute(100); // ~1.5km
    const km = routeDistanceKm(pts);
    assert.equal(distanceMatchesRoute(km, pts).ok, true);
    assert.equal(distanceMatchesRoute(km * 0.9, pts).ok, true); // filtered shorter
    assert.equal(distanceMatchesRoute(0, pts).ok, true); // nothing claimed
    assert.equal(distanceMatchesRoute(km, []).ok, true); // no route → no verdict
    assert.equal(distanceMatchesRoute(km, null).ok, true);
  });

  it('distanceMatchesRoute rejects claimed distance the path cannot support', () => {
    const pts = fakeRoute(100);
    const km = routeDistanceKm(pts);
    const bad = distanceMatchesRoute(km * 2, pts);
    assert.equal(bad.ok, false);
    assert.ok(bad.routeKm > 0);
    // Just over tolerance still passes (GPS noise margin).
    assert.equal(distanceMatchesRoute(km * 1.1, pts).ok, true);
  });
});
