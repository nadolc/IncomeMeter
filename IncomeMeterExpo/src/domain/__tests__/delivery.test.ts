import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acceptFix, Fix, movingMinutes } from '../geo';
import { areaStats, averageHourly, evaluateOffer, minutesUntil, routeRates, thresholdTable } from '../metrics';
import { LocationPoint, Route } from '../types';

const DEG_PER_M = 1 / 111_195;
const fix = (northM: number, s: number, acc = 8): Fix => ({ latitude: 22.37 + northM * DEG_PER_M, longitude: 114.11, timestamp: s * 1000, accuracy: acc });

describe('GPS filter per travel mode', () => {
  it('walking: counts walking pace, not the MTR ride between two stations', () => {
    assert.ok(acceptFix(fix(0, 0), fix(20, 15), 'walk')!.stepKm > 0.019, '20 m in 15 s is walking');
    // Underground for 8 minutes, surfacing 4 km away (8.3 m/s): accepted to re-anchor, but not counted.
    assert.deepEqual(acceptFix(fix(0, 0), fix(4000, 480), 'walk'), { stepKm: 0 });
    // The same gap in a car (tunnel) still counts.
    assert.ok(acceptFix(fix(0, 0), fix(4000, 480), 'car')!.stepKm > 3.9);
  });

  it('walking: a short burst faster than walking is a glitch; standing still then walking on counts', () => {
    assert.equal(acceptFix(fix(0, 0), fix(100, 10), 'walk'), null, '10 m/s for 10 s');
    assert.ok(acceptFix(fix(0, 0), fix(150, 300), 'walk')!.stepKm > 0.14, 'waited 3 min then walked 150 m');
  });

  it('bicycle allows e-bike speeds', () => {
    assert.ok(acceptFix(fix(0, 0), fix(60, 10), 'bicycle'));
    assert.equal(acceptFix(fix(0, 0), fix(60, 10), 'walk'), null);
  });
});

const pt = (routeId: string, kind: 'track' | 'stop', northM: number, iso: string, extra: Partial<LocationPoint> = {}): LocationPoint => ({
  id: `${routeId}-${kind}-${iso}`, routeId, kind, latitude: 22.37 + northM * DEG_PER_M, longitude: 114.11, timestamp: iso,
  accuracy: 8, speed: null, address: null, distanceFromLastKm: kind === 'track' ? 0.02 : null, distanceFromLastMi: null, altitude: null, ...extra,
});

describe('moving time', () => {
  it('adds time between points under 2 minutes apart; long gaps are waiting', () => {
    const points = [
      pt('r', 'track', 0, '2026-09-27T10:00:00Z', { distanceFromLastKm: 0 }),
      pt('r', 'track', 20, '2026-09-27T10:00:30Z'),
      pt('r', 'track', 40, '2026-09-27T10:01:00Z'),
      pt('r', 'track', 60, '2026-09-27T10:11:00Z'),   // waited 10 min at the restaurant
      pt('r', 'track', 80, '2026-09-27T10:11:30Z'),
    ];
    assert.equal(movingMinutes(points), 1.5);
  });
});

const route = (p: Partial<Route>): Route => ({
  id: 'r', workType: '外賣', workTypeId: null, vehicleId: null, status: 'completed', scheduleStart: '', scheduleEnd: '',
  actualStartTime: '2026-09-20T10:00:00Z', actualEndTime: '2026-09-20T14:00:00Z', incomes: [], totalIncome: 480, estimatedIncome: 0,
  distance: 24, startMile: null, endMile: null, trackedMiles: 24, travelMode: 'bicycle', movingMinutes: 120, createdAt: '', updatedAt: '', ...p,
});

describe('route rates', () => {
  it('per hour online / moving and per km', () => {
    const r = routeRates(route({}));
    assert.equal(r.onlineMinutes, 240);
    assert.equal(r.waitingMinutes, 120);
    assert.equal(r.hourlyOnline, 120);
    assert.equal(r.hourlyMoving, 240);
    assert.equal(r.perDistance, 20);
  });

  it('own 4-week average needs 3 completed routes', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    assert.equal(averageHourly([route({}), route({})], now), null);
    assert.equal(averageHourly([route({}), route({}), route({ totalIncome: 240 })], now), 100);
    assert.equal(averageHourly([route({}), route({}), route({ actualEndTime: '2026-07-01T14:00:00Z' })], now), null, 'older than 4 weeks');
  });
});

describe('offers', () => {
  it('the Keeta example: $46.82 + $6 in 32 min', () => {
    const worst = evaluateOffer({ fee: 46.82, bonus: 6, minutes: 32, completionFactor: 1, targetHourly: 100 });
    assert.equal(Math.round(worst.hourlyWorst), 99);
    assert.equal(worst.verdict, 'borderline');
    const usual = evaluateOffer({ fee: 46.82, bonus: 6, minutes: 32, completionFactor: 0.7, targetHourly: 100,
      text: '荃灣石圍角村石桃樓', avoidAreas: '象山|石圍角' });
    assert.equal(Math.round(usual.hourlyExpected), 141);   // 52.82 ÷ (32 × 0.7 min) × 60
    assert.equal(usual.verdict, 'good');
    assert.deepEqual(usual.areaHits, ['石圍角']);
  });

  it('threshold table and deadline minutes', () => {
    assert.deepEqual(thresholdTable(100, 1, [20, 30, 40]).map((r) => r.minFee), [34, 50, 67]);
    const now = new Date(2026, 8, 27, 18, 56);
    assert.equal(minutesUntil('19:28', now), 32);
    assert.equal(minutesUntil('00:10', new Date(2026, 8, 27, 23, 50)), 20, 'after midnight');
    assert.equal(minutesUntil('abc', now), null);
  });
});

describe('area stats', () => {
  it('groups stops within 250 m and flags climbs / long waits', () => {
    const points: LocationPoint[] = [];
    for (let d = 1; d <= 3; d++) {
      const day = `2026-09-2${d}`;
      points.push(pt(`r${d}`, 'track', 0, `${day}T10:00:00Z`, { altitude: 20 }));
      points.push(pt(`r${d}`, 'stop', 1000, `${day}T10:20:00Z`, { altitude: 70, address: '石桃樓, 石圍角路, 荃灣' }));
      points.push(pt(`r${d}`, 'track', 1100, `${day}T10:35:00Z`));   // left 15 min later
      points.push(pt(`r${d}`, 'stop', 3000, `${day}T11:00:00Z`, { altitude: 25, address: '海壩街99號, 荃灣' }));
      points.push(pt(`r${d}`, 'track', 3100, `${day}T11:02:00Z`));
    }
    const stats = areaStats(points.filter((p) => p.kind === 'stop'), points.filter((p) => p.kind === 'track'));
    assert.equal(stats.length, 2);
    const hill = stats.find((a) => a.label === '石桃樓')!;
    assert.equal(hill.visits, 3);
    assert.equal(hill.avgClimbM, 50);
    assert.equal(hill.avgIdleAfterMin, 15);
    assert.equal(hill.suggestAvoid, true);
    assert.equal(stats.find((a) => a.label === '海壩街99號')!.suggestAvoid, false);
  });
});
