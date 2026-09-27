import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseIncomes, parseRoutesCsv } from '../csvImport';
import { periodStats, workTypeStats } from '../dashboard';
import { acceptFix, Fix, haversineKm, KM_TO_MI } from '../geo';
import { buildCombinedReport, buildReport, calculateSimplified, TaxData } from '../taxReport';
import { taxYearFor, taxYearLabel } from '../taxYear';
import { Expense, OdometerReading, Route, Vehicle, WorkType } from '../types';
import { pickVehicleForDate } from '../vehicleAssignment';

// ---------- fixtures ----------

const vehicle = (p: Partial<Vehicle>): Vehicle => ({
  id: 'v1', registration: 'AB12CDE', make: 'Toyota', model: 'Prius', vehicleType: 'car', fuelType: 'hybrid', co2GPerKm: 120,
  purchaseDate: '2020-01-01T00:00:00Z', disposalDate: null, disposalProceeds: null, purchasePrice: 15000, isNew: false,
  financeType: 'cash', claimMethod: 'actualCost', claimMethodLockedFromTaxYear: null, capitalAllowancePoolBroughtForward: 10000,
  poolBroughtForwardTaxYear: 2024, isActive: true, notes: null, createdAt: '', updatedAt: '', ...p,
});

const route = (p: Partial<Route>): Route => ({
  id: Math.random().toString(16).slice(2), workType: 'Delivery', workTypeId: null, vehicleId: 'v1', status: 'completed',
  scheduleStart: '2024-06-01T09:00:00Z', scheduleEnd: '2024-06-01T17:00:00Z', actualStartTime: null, actualEndTime: null,
  incomes: [], totalIncome: 0, estimatedIncome: 0, distance: 0, startMile: null, endMile: null, trackedMiles: null,
  createdAt: '', updatedAt: '', ...p,
});

const expense = (p: Partial<Expense>): Expense => ({
  id: Math.random().toString(16).slice(2), vehicleId: 'v1', category: 'fuel', date: '2024-07-01T12:00:00Z', amount: 0, currency: 'GBP',
  merchant: null, notes: null, fuel: null, attachmentIds: ['a1'], isFullyBusiness: false, status: 'confirmed', dateSource: 'manual',
  createdAt: '', updatedAt: '', ...p,
});

const reading = (date: string, miles: number): OdometerReading => ({
  id: date, vehicleId: 'v1', date, miles, source: 'manual', photoAttachmentId: null, dateSource: 'manual', notes: null, createdAt: '', updatedAt: '',
});

// ---------- GPS ----------

describe('GPS distance filter', () => {
  const at = (lat: number, lon: number, s: number, acc = 5): Fix => ({ latitude: lat, longitude: lon, timestamp: s * 1000, accuracy: acc });

  it('drops inaccurate fixes, parked jitter and teleports; keeps real movement', () => {
    const start = at(51.5, -0.12, 0);
    assert.equal(acceptFix(start, at(51.5, -0.12, 10, 120)), null, 'accuracy 120 m');
    assert.equal(acceptFix(start, at(51.50005, -0.12, 10)), null, '5.5 m jitter');
    assert.equal(acceptFix(start, at(51.6, -0.12, 10)), null, '11 km in 10 s');
    const ok = acceptFix(start, at(51.501, -0.12, 10));
    assert.ok(ok && Math.abs(ok.stepKm - 0.111) < 0.002, '111 m in 10 s accepted');
  });

  it('a noisy 10-mile drive plus 10 minutes parked measures close to 10 miles', () => {
    const totalKm = 10 / KM_TO_MI;
    const stepKm = 0.1;
    const steps = Math.round(totalKm / stepKm);
    const degPerKm = 1 / 111.195;
    let seed = 42;
    const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 2; };
    const fixes: Fix[] = [];
    for (let i = 0; i <= steps; i++) {
      fixes.push(at(51.5 + i * stepKm * degPerKm + noise() * 4e-5, -0.12 + noise() * 4e-5, i * 6, 8));
    }
    const endLat = fixes[fixes.length - 1].latitude;
    for (let j = 1; j <= 120; j++) fixes.push(at(endLat + noise() * 6e-5, -0.12 + noise() * 6e-5, steps * 6 + j * 5, 10));

    let prev: Fix | null = null;
    let km = 0;
    for (const f of fixes) {
      const r = acceptFix(prev, f);
      if (r) { km += r.stepKm; prev = f; }
    }
    const miles = km * KM_TO_MI;
    assert.ok(Math.abs(miles - 10) < 0.3, `measured ${miles.toFixed(2)} mi`);
  });

  it('haversine: London → Manchester ≈ 262 km', () => {
    assert.ok(Math.abs(haversineKm(51.5074, -0.1278, 53.4808, -2.2426) - 262) < 3);
  });
});

// ---------- tax year / vehicles ----------

describe('tax year', () => {
  it('6 April starts the year', () => {
    assert.equal(taxYearFor(new Date('2025-04-05T23:59:00Z')), 2024);
    assert.equal(taxYearFor(new Date('2025-04-06T00:00:00Z')), 2025);
    assert.equal(taxYearLabel(2024), '2024/25');
    assert.equal(taxYearLabel(2099), '2099/00');
  });
});

describe('pickVehicleForDate', () => {
  const oldCar = vehicle({ id: 'old', purchaseDate: '2019-01-01T00:00:00Z', disposalDate: '2024-06-10T00:00:00Z', isActive: false });
  const newCar = vehicle({ id: 'new', purchaseDate: '2024-06-10T00:00:00Z' });
  it('old car on the hand-over day, new car after', () => {
    assert.equal(pickVehicleForDate([oldCar, newCar], '2024-06-10T15:00:00Z'), 'old');
    assert.equal(pickVehicleForDate([oldCar, newCar], '2024-06-11T08:00:00Z'), 'new');
    assert.equal(pickVehicleForDate([oldCar, newCar], '2018-01-01T08:00:00Z'), 'new', 'no candidate → single active');
  });
});

// ---------- tax report ----------

describe('tax report (actual cost)', () => {
  const data: TaxData = {
    vehicles: [vehicle({})],
    routes: [
      route({ startMile: 10000, endMile: 13000 }),
      route({ scheduleStart: '2024-09-01T09:00:00Z', startMile: 14000, endMile: 17000 }),
      route({ scheduleStart: '2024-10-01T09:00:00Z', distance: 0 }),                     // no mileage → warning
    ],
    odometerReadings: [reading('2024-04-06T00:00:00Z', 10000), reading('2025-04-05T00:00:00Z', 22000)],
    expenses: [
      expense({ category: 'fuel', amount: 2000 }),
      expense({ category: 'parking', amount: 100, isFullyBusiness: true, attachmentIds: [] }),
    ],
    attachmentIds: new Set(['a1']),
  };
  const r = buildReport(data, 2024, 'v1');

  it('mileage and business %', () => {
    assert.equal(r.mileage.businessMiles, 6000);
    assert.equal(r.mileage.totalMiles, 12000);
    assert.equal(r.mileage.businessUsePercent, 50);
    assert.equal(r.mileage.routesWithoutMileage, 1);
    assert.ok(r.warnings.some((w) => w.code === 'ROUTES_WITHOUT_MILEAGE'));
  });

  it('apportioned expenses', () => {
    assert.equal(r.totals.allowable, 1100);       // 100 fully business + 2000 × 50%
    assert.equal(r.totals.disallowable, 1000);
    assert.equal(r.totals.receiptsMissing, 1);
  });

  it('capital allowance: CO2 > 50 → 6% special rate on pool b/f', () => {
    assert.equal(r.capitalAllowance.sa103Box, '51');
    assert.equal(r.capitalAllowance.grossAllowance, 600);
    assert.equal(r.capitalAllowance.allowance, 300);
    assert.equal(r.capitalAllowance.poolCarriedForward, 9400);
  });

  it('simplified comparison and SA103 boxes', () => {
    assert.equal(r.simplifiedExpenses.amount, 2700);
    assert.equal(r.comparison.actualCostTotal, 1400);
    assert.equal(r.comparison.betterMethod, 'mileage');
    const box = (b: string) => r.sa103Boxes.find((x) => x.box === b)?.amount;
    assert.equal(box('20'), 2100);
    assert.equal(box('35'), 1000);
    assert.equal(box('51'), 300);
    assert.equal(box('11'), 1100);
  });

  it('flat-rate vehicle: mileage + parking/tolls in box 20 and SA103S box 11', () => {
    const flat = buildReport({ ...data, vehicles: [vehicle({ claimMethod: 'mileage' })] }, 2024, 'v1');
    assert.equal(flat.totals.flatRateClaim, 2800);
    assert.deepEqual(flat.sa103Boxes.map((b) => [b.form, b.box, b.amount]), [['SA103F', '20', 2800], ['SA103F', '35', 0], ['SA103S', '11', 2800]]);
    const combined = buildCombinedReport({ ...data, vehicles: [vehicle({ claimMethod: 'mileage' })] }, 2024);
    assert.equal(combined.totalClaim, 2800);
  });

  it('simplified bands: 45p then 25p; motorcycles 24p', () => {
    assert.equal(calculateSimplified(12000, 'car').amount, 4500 + 500);
    assert.equal(calculateSimplified(1000, 'motorcycle').amount, 240);
  });

  it('disposal: balancing charge when proceeds exceed written-down value', () => {
    const sold = buildReport({ ...data, vehicles: [vehicle({ disposalDate: '2024-12-01T00:00:00Z', disposalProceeds: 12000 })] }, 2024, 'v1');
    assert.equal(sold.capitalAllowance.balancingType, 'balancingCharge');
    assert.equal(sold.capitalAllowance.allowance, -1000);   // (10000 − 12000) × 50%
    assert.equal(sold.sa103Boxes.find((b) => b.box === '58')?.amount, 1000);
  });
});

// ---------- CSV import ----------

describe('CSV route import', () => {
  const wt: WorkType = { id: 'w', name: 'Delivery', description: null, incomeSourceTemplates: [], isActive: true, createdAt: '', updatedAt: '' };

  it('parses JSON and pipe incomes, quoted cells, overnight shifts', () => {
    const csv = 'workTypeName,scheduleDate,fromTime,toTime,startMile,endMile,incomeSources\n' +
      'delivery,15/01/2024,0900,1700,100,150,"{""Uber"": 120.5, ""Tips"": 15}"\n' +
      'Delivery,16/01/2024,1800,0200,150,190,Deliveroo:45|Tips:8\n' +
      'Taxi,16/01/2024,0900,1000,5,1,\n';
    const { rows } = parseRoutesCsv(csv, [wt]);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0].incomes, [{ source: 'Uber', amount: 120.5 }, { source: 'Tips', amount: 15 }]);
    assert.equal(rows[0].errors.length, 0);
    assert.ok(new Date(rows[1].scheduleEnd!) > new Date(rows[1].scheduleStart!));
    assert.equal(rows[2].errors.length, 3);   // unknown work type, end < start, no incomes
  });

  it('pipe format keeps colons in the source name', () => {
    assert.deepEqual(parseIncomes('Bonus: peak:5'), [{ source: 'Bonus: peak', amount: 5 }]);
  });
});

// ---------- dashboard ----------

describe('dashboard', () => {
  it('weekly buckets Monday–Sunday and per-work-type rates', () => {
    const now = new Date(2024, 5, 5, 12);  // Wednesday 5 June 2024
    const routes = [
      route({ scheduleStart: new Date(2024, 5, 3, 9).toISOString(), scheduleEnd: new Date(2024, 5, 3, 13).toISOString(), totalIncome: 80, distance: 40 }),
      route({ scheduleStart: new Date(2024, 5, 9, 9).toISOString(), scheduleEnd: new Date(2024, 5, 9, 11).toISOString(), totalIncome: 20, workType: 'Taxi' }),
      route({ scheduleStart: new Date(2024, 5, 4, 9).toISOString(), totalIncome: 999, status: 'scheduled' }),
    ];
    const s = periodStats(routes, 'weekly', 0, 'en-GB', '04-06', now);
    assert.equal(s.buckets.length, 7);
    assert.equal(s.buckets[0].income, 80);   // Monday
    assert.equal(s.buckets[6].income, 20);   // Sunday
    assert.equal(s.total, 100);              // scheduled route excluded
    const delivery = workTypeStats(routes.slice(0, 1))[0];
    assert.equal(delivery.hourlyRate, 20);
    assert.equal(delivery.earningsPerMile, 2);
  });
});
