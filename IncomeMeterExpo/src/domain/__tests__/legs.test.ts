import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeStops, routeLegs } from '../legs';
import { LocationPoint } from '../types';

const DEG_PER_M = 1 / 111_195;
let n = 0;
const pt = (kind: 'track' | 'stop', northM: number, minute: number, stepKm: number | null = null): LocationPoint => ({
  id: String(n++), routeId: 'r', kind, latitude: 51.5 + northM * DEG_PER_M, longitude: -0.12,
  timestamp: new Date(Date.UTC(2026, 8, 27, 18, minute)).toISOString(), accuracy: 5, speed: null, address: null,
  distanceFromLastKm: stepKm, distanceFromLastMi: null,
});

const close = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

describe('duplicate stops', () => {
  it('merges a stop marked twice (CarPlay reconnect) but keeps nearby separate stops', () => {
    const a = { ...pt('stop', 0, 25), address: null };
    const b = { ...pt('stop', 20, 25), address: 'Rose And Crown, Swarkestone Road' };   // same minute, 20 m away
    const c = pt('stop', 200, 27);                                                     // 200 m further: a new stop
    const merged = mergeStops([b, c, a]);
    assert.equal(merged.length, 2);
    assert.ok([a.id, b.id].includes(merged[0].id), 'one of the two same-minute stops is kept');
    assert.equal(merged[0].address, 'Rose And Crown, Swarkestone Road');
    assert.equal(routeLegs([a, b, c]).length, 2);
  });
});

describe('route legs', () => {
  it('splits the recorded path at each stop: start → stop 1 → stop 2 → end', () => {
    const points = [
      pt('track', 0, 0, 0),
      pt('track', 500, 3, 0.5),
      pt('track', 1000, 6, 0.5),
      pt('stop', 1000, 7),            // stop 1 after 1 km
      pt('track', 1400, 10, 0.4),
      pt('track', 2000, 14, 0.6),
      pt('stop', 2000, 15),           // stop 2 after another 1 km
      pt('track', 2300, 18, 0.3),     // driving on to the end
    ];
    const legs = routeLegs(points);
    assert.deepEqual(legs.map((l) => l.toStop), [1, 2, 0]);
    close(legs[0].km, 1.0);
    close(legs[1].km, 1.0);
    close(legs[2].km, 0.3);
    assert.equal(legs[0].minutes, 7);
    assert.equal(legs[1].minutes, 8);
    assert.ok(legs.every((l) => l.source === 'path'));
    assert.equal(legs[1].path.length, 4);   // stop 1, two points, stop 2
  });

  it('old shortcut routes (stops only) use the distance the server stored, else a straight line', () => {
    const points = [pt('stop', 0, 0, null), pt('stop', 3000, 12, 3.6), pt('stop', 5000, 30, null)];
    const legs = routeLegs(points);
    assert.equal(legs.length, 3);
    assert.equal(legs[0].km, 0);
    assert.equal(legs[1].source, 'server');
    assert.equal(legs[1].km, 3.6);
    assert.equal(legs[2].source, 'straight');
    close(legs[2].km, 2.0);
    assert.equal(legs[2].minutes, 18);
  });
});
