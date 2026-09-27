// Port of IncomeMeter.Api/Services/TaxYearReportService.cs – runs on the device over local data.
// HMRC figures mirror TaxRulesSettings (2024/25 – 2025/26 defaults) and must be checked before each filing.
import { taxYearLabel, taxYearRange } from './taxYear';
import { EXPENSE_CATEGORIES, Expense, OdometerReading, Route, Vehicle } from './types';

export const TAX_RULES = {
  mileageRateFirstBand: 0.45,
  mileageRateSecondBand: 0.25,
  mileageFirstBandMiles: 10_000,
  motorcycleMileageRate: 0.24,
  mainRateWda: 0.18,
  specialRateWda: 0.06,
  mainRateCo2Threshold: 50,
  zeroEmissionCarFya: 1.0,
  aiaRate: 1.0,
  odometerGapWarningDays: 60,
  odometerBoundaryToleranceDays: 14,
};

export const DISCLAIMER =
  'This report is an aid to record-keeping, not tax advice. Check the figures and current HMRC rules before filing.';

export type Severity = 'info' | 'warning' | 'error';
export interface Warning { severity: Severity; code: string; message: string }
export interface OdometerPoint { date: string; miles: number; source: 'reading' | 'fuelReceipt' }

export interface CategoryLine {
  category: string; count: number; total: number; fullyBusinessTotal: number; allowable: number; disallowable: number;
  receiptsMissing: number; excludedFromRunningCosts: boolean; coveredByFlatRate: boolean;
}

export interface CapitalAllowance {
  applicable: boolean; reason: string | null; allowanceType: string | null; allowanceLabel: string | null;
  sa103Box: string | null; rate: number; qualifyingExpenditure: number | null; poolBroughtForward: number;
  grossAllowance: number; allowance: number; poolCarriedForward: number; businessUsePercent: number | null;
  isDisposal: boolean; disposalDate: string | null; disposalProceeds: number | null;
  balancingAdjustmentGross: number | null; balancingType: 'balancingAllowance' | 'balancingCharge' | null;
}

export interface Simplified {
  businessMiles: number; firstBandMiles: number; firstBandRate: number; secondBandMiles: number; secondBandRate: number; amount: number;
}

export interface Box { form: 'SA103F' | 'SA103S'; box: string; label: string; amount: number; note: string }

export interface TaxReport {
  taxYear: number; taxYearLabel: string; periodFrom: string; periodTo: string; generatedAt: string;
  vehicle: (Pick<Vehicle, 'id' | 'registration' | 'vehicleType' | 'claimMethod' | 'claimMethodLockedFromTaxYear' | 'co2GPerKm' | 'isNew' | 'purchaseDate' | 'purchasePrice' | 'disposalDate' | 'disposalProceeds'> & { description: string }) | null;
  mileage: {
    businessMiles: number; routesCounted: number; routesWithoutMileage: number; odometerReadingsInPeriod: number;
    odometerStart: OdometerPoint | null; odometerEnd: OdometerPoint | null; totalMiles: number | null;
    businessUsePercent: number | null; businessUseSource: 'odometer' | 'override' | null;
  };
  categories: CategoryLine[];
  totals: { totalExpenses: number; allowable: number; disallowable: number; receiptsMissing: number; flatRateVehicle: boolean; flatRateClaim: number };
  capitalAllowance: CapitalAllowance;
  simplifiedExpenses: Simplified;
  comparison: { actualCostTotal: number; simplifiedTotal: number; difference: number; betterMethod: string; lockedToOtherMethod: boolean };
  sa103Boxes: Box[];
  warnings: Warning[];
  disclaimer: string;
}

export interface CombinedReport {
  taxYear: number; taxYearLabel: string; periodFrom: string; periodTo: string;
  vehicles: TaxReport[]; totalBusinessMiles: number; totalClaim: number;
  unassignedRoutes: number; unassignedExpenses: number; unassignedOdometerReadings: number;
  sa103Boxes: Box[]; warnings: Warning[]; disclaimer: string;
}

export interface TaxData {
  routes: Route[];
  expenses: Expense[];
  odometerReadings: OdometerReading[];
  vehicles: Vehicle[];
  /** Attachment ids that exist (on device or server) – used for the "receipt missing" count. */
  attachmentIds: Set<string>;
}

// ---------- helpers ----------

const round2 = (v: number) => Math.sign(v) * Math.round(Math.abs(v) * 100 + Number.EPSILON) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;
const n0 = (v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
const n2 = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct0 = (v: number) => `${Math.round(v * 100)}%`;
const dmy = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dm = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const t = (iso: string) => new Date(iso).getTime();
const DAY = 86_400_000;
const warn = (severity: Severity, code: string, message: string): Warning => ({ severity, code, message });

const inRange = (iso: string, from: Date, to: Date) => t(iso) >= from.getTime() && t(iso) <= to.getTime();

// ---------- report ----------

export function buildReport(
  data: TaxData, taxYear: number, vehicleId?: string | null, businessUsePercentOverride?: number | null, strictVehicle = false,
): TaxReport {
  const { from, to } = taxYearRange(taxYear);
  const warnings: Warning[] = [];

  // --- Vehicle ---
  let vehicle: Vehicle | null = null;
  if (vehicleId) {
    vehicle = data.vehicles.find((v) => v.id === vehicleId) ?? null;
    if (!vehicle) throw new Error('Vehicle not found');
  } else {
    const active = data.vehicles.filter((v) => v.isActive);
    vehicle = active[0] ?? null;
    if (active.length > 1)
      warnings.push(warn('info', 'MULTIPLE_VEHICLES', `You have ${active.length} active vehicles; this report uses ${vehicle!.registration}. Choose a vehicle to report on another.`));
  }

  if (vehicle?.claimMethod === 'mileage') {
    warnings.push(warn('info', 'FLAT_RATE_VEHICLE',
      `${vehicle.registration} is claimed with the flat-rate mileage method` +
      (vehicle.claimMethodLockedFromTaxYear != null ? ` (since ${taxYearLabel(vehicle.claimMethodLockedFromTaxYear)}; HMRC does not allow switching this vehicle to actual costs)` : '') +
      '. Fuel, insurance, servicing and the vehicle cost are covered by the rate; only parking and tolls can be claimed on top.'));
  } else if (!vehicle) {
    warnings.push(warn('warning', 'NO_VEHICLE', 'No vehicle is set up. Add your vehicle (CO2, purchase price/date) to calculate capital allowances.'));
  }

  const belongs = (vid: string | null) => !vehicle || vid === vehicle.id || (!strictVehicle && vid == null);

  // --- Business miles from routes ---
  const completed = data.routes.filter((r) => r.status === 'completed' && inRange(r.scheduleStart, from, to) && belongs(r.vehicleId));
  let businessMiles = 0;
  let withoutMileage = 0;
  for (const r of completed) {
    if (r.startMile != null && r.endMile != null && r.endMile > r.startMile) businessMiles += r.endMile - r.startMile;
    else if (r.distance > 0) businessMiles += r.distance;
    else withoutMileage++;
  }
  if (withoutMileage > 0)
    warnings.push(warn('warning', 'ROUTES_WITHOUT_MILEAGE', `${withoutMileage} completed route(s) have no start/end mileage and were not counted.`));
  if (completed.length === 0)
    warnings.push(warn('warning', 'NO_ROUTES', 'No completed routes in this tax year – business miles are zero.'));

  // --- Total miles from odometer readings (+ odometer on fuel receipts) ---
  const tol = TAX_RULES.odometerBoundaryToleranceDays * DAY;
  const tolFrom = new Date(from.getTime() - tol);
  const tolTo = new Date(to.getTime() + tol);
  const readings = data.odometerReadings.filter((r) => inRange(r.date, tolFrom, tolTo) && belongs(r.vehicleId));
  const expenses = data.expenses.filter((e) => inRange(e.date, from, to) && belongs(e.vehicleId));

  const points: OdometerPoint[] = [
    ...readings.map((r) => ({ date: r.date, miles: r.miles, source: 'reading' as const })),
    ...expenses.filter((e) => (e.fuel?.odometerMiles ?? 0) > 0).map((e) => ({ date: e.date, miles: e.fuel!.odometerMiles!, source: 'fuelReceipt' as const })),
  ].sort((a, b) => t(a.date) - t(b.date));

  const mileage: TaxReport['mileage'] = {
    businessMiles: round1(businessMiles), routesCounted: completed.length, routesWithoutMileage: withoutMileage,
    odometerReadingsInPeriod: points.filter((p) => inRange(p.date, from, to)).length,
    odometerStart: null, odometerEnd: null, totalMiles: null, businessUsePercent: null, businessUseSource: null,
  };

  const lastAtOrBefore = [...points].reverse().find((p) => t(p.date) <= from.getTime());
  const opening = lastAtOrBefore ?? points.find((p) => t(p.date) >= from.getTime()) ?? null;
  const closing = points.find((p) => t(p.date) >= to.getTime()) ?? [...points].reverse().find((p) => t(p.date) <= to.getTime()) ?? null;

  if (opening && closing && t(closing.date) > t(opening.date) && closing.miles > opening.miles) {
    mileage.odometerStart = opening;
    mileage.odometerEnd = closing;
    mileage.totalMiles = round1(closing.miles - opening.miles);
    if (t(opening.date) > from.getTime() + 7 * DAY)
      warnings.push(warn('warning', 'NO_OPENING_READING', `No odometer reading near 6 April ${taxYear}; the earliest reading (${dmy(opening.date)}) is used as the opening figure. Miles before it are not counted.`));
    if (t(closing.date) < to.getTime() - 7 * DAY)
      warnings.push(warn('warning', 'NO_CLOSING_READING', `No odometer reading near 5 April ${taxYear + 1}; the latest reading (${dmy(closing.date)}) is used as the closing figure. Miles after it are not counted.`));

    const within = points.filter((p) => t(p.date) >= t(opening.date) && t(p.date) <= t(closing.date));
    for (let i = 1; i < within.length; i++) {
      const gapDays = (t(within[i].date) - t(within[i - 1].date)) / DAY;
      if (gapDays > TAX_RULES.odometerGapWarningDays) {
        warnings.push(warn('info', 'ODOMETER_GAP', `${Math.round(gapDays)} days between odometer readings on ${dm(within[i - 1].date)} and ${dm(within[i].date)}.`));
        break;
      }
      if (within[i].miles < within[i - 1].miles)
        warnings.push(warn('error', 'ODOMETER_DECREASING', `Odometer reading on ${dmy(within[i].date)} (${n0(within[i].miles)}) is lower than the previous one (${n0(within[i - 1].miles)}). Check for a typo.`));
    }
  } else {
    warnings.push(warn('warning', 'NO_TOTAL_MILES', 'At least two odometer readings (ideally on 6 April and 5 April) are needed to work out total miles and the business-use percentage.'));
  }

  // --- Business-use percentage ---
  if (businessUsePercentOverride != null) {
    mileage.businessUsePercent = Math.min(100, Math.max(0, round2(businessUsePercentOverride)));
    mileage.businessUseSource = 'override';
  } else if (mileage.totalMiles != null && mileage.totalMiles > 0) {
    let pct = (businessMiles / mileage.totalMiles) * 100;
    if (pct > 100) {
      warnings.push(warn('error', 'BUSINESS_EXCEEDS_TOTAL', `Business miles (${n0(businessMiles)}) exceed total odometer miles (${n0(mileage.totalMiles)}). One of the two records is wrong; capped at 100%.`));
      pct = 100;
    }
    mileage.businessUsePercent = round2(pct);
    mileage.businessUseSource = 'odometer';
  }
  const fraction = mileage.businessUsePercent != null ? mileage.businessUsePercent / 100 : null;

  // --- Expense categories ---
  const flatRate = vehicle?.claimMethod === 'mileage';
  const categories: CategoryLine[] = [];
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
  const order = (c: string) => (EXPENSE_CATEGORIES as readonly string[]).indexOf(c);
  for (const [category, items] of [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]))) {
    const total = items.reduce((s, e) => s + e.amount, 0);
    const fullyBusinessTotal = items.filter((e) => e.isFullyBusiness).reduce((s, e) => s + e.amount, 0);
    const cat: CategoryLine = {
      category, count: items.length, total, fullyBusinessTotal,
      receiptsMissing: items.filter((e) => !e.attachmentIds.some((id) => data.attachmentIds.has(id))).length,
      excludedFromRunningCosts: category === 'vehiclePurchase',
      coveredByFlatRate: flatRate && category !== 'parking' && category !== 'tolls',
      allowable: 0, disallowable: 0,
    };
    if (cat.excludedFromRunningCosts || cat.coveredByFlatRate) {
      cat.allowable = 0;
      cat.disallowable = cat.coveredByFlatRate ? cat.total : 0;
    } else if (fraction != null) {
      cat.allowable = round2(fullyBusinessTotal + (total - fullyBusinessTotal) * fraction);
      cat.disallowable = round2(total - cat.allowable);
    } else {
      cat.allowable = fullyBusinessTotal;
      cat.disallowable = round2(total - fullyBusinessTotal);
    }
    categories.push(cat);
  }

  const totals: TaxReport['totals'] = {
    totalExpenses: categories.filter((c) => !c.excludedFromRunningCosts).reduce((s, c) => s + c.total, 0),
    allowable: categories.reduce((s, c) => s + c.allowable, 0),
    disallowable: categories.filter((c) => !c.excludedFromRunningCosts).reduce((s, c) => s + c.disallowable, 0),
    receiptsMissing: categories.reduce((s, c) => s + c.receiptsMissing, 0),
    flatRateVehicle: flatRate,
    flatRateClaim: 0,
  };
  if (flatRate && categories.some((c) => c.coveredByFlatRate && c.total > 0))
    warnings.push(warn('info', 'COSTS_COVERED_BY_FLAT_RATE',
      `£${n2(categories.filter((c) => c.coveredByFlatRate).reduce((s, c) => s + c.total, 0))} of recorded costs are covered by the flat rate and are not claimable separately (kept for your records).`));
  if (fraction == null && totals.totalExpenses > 0)
    warnings.push(warn('warning', 'NO_BUSINESS_PERCENT', 'Business-use % is unknown, so only items marked 100% business are counted as allowable. Add odometer readings or supply a percentage override.'));
  if (totals.receiptsMissing > 0)
    warnings.push(warn('warning', 'RECEIPTS_MISSING', `${totals.receiptsMissing} expense(s) have no receipt attached. HMRC can ask for evidence for 5 years after the filing deadline.`));
  if (expenses.length === 0)
    warnings.push(warn('info', 'NO_EXPENSES', 'No expenses recorded in this tax year.'));

  const capitalAllowance = calculateCapitalAllowance(vehicle, taxYear, from, to, fraction, expenses, warnings);
  const simplifiedExpenses = calculateSimplified(businessMiles, vehicle?.vehicleType ?? 'car');

  const actualTotal = round2(totals.allowable + capitalAllowance.allowance);
  const simplifiedTotal = simplifiedExpenses.amount;
  if (flatRate) totals.flatRateClaim = round2(simplifiedTotal + totals.allowable);
  const comparison = {
    actualCostTotal: actualTotal,
    simplifiedTotal,
    difference: round2(actualTotal - simplifiedTotal),
    betterMethod: actualTotal > simplifiedTotal ? 'actualCost' : actualTotal < simplifiedTotal ? 'mileage' : 'equal',
    lockedToOtherMethod: !!vehicle && vehicle.claimMethodLockedFromTaxYear != null &&
      ((vehicle.claimMethod === 'mileage' && actualTotal > simplifiedTotal) || (vehicle.claimMethod === 'actualCost' && simplifiedTotal > actualTotal)),
  };
  if (comparison.lockedToOtherMethod)
    warnings.push(warn('info', 'BETTER_METHOD_LOCKED', 'The other method would give a larger deduction this year, but this vehicle is locked to its current method.'));

  const report: TaxReport = {
    taxYear, taxYearLabel: taxYearLabel(taxYear), periodFrom: from.toISOString(), periodTo: to.toISOString(), generatedAt: new Date().toISOString(),
    vehicle: vehicle && {
      id: vehicle.id, registration: vehicle.registration, vehicleType: vehicle.vehicleType, claimMethod: vehicle.claimMethod,
      claimMethodLockedFromTaxYear: vehicle.claimMethodLockedFromTaxYear, co2GPerKm: vehicle.co2GPerKm, isNew: vehicle.isNew,
      purchaseDate: vehicle.purchaseDate, purchasePrice: vehicle.purchasePrice, disposalDate: vehicle.disposalDate, disposalProceeds: vehicle.disposalProceeds,
      description: [vehicle.make, vehicle.model].filter((s) => s && s.trim()).join(' '),
    },
    mileage, categories, totals, capitalAllowance, simplifiedExpenses, comparison, sa103Boxes: [], warnings, disclaimer: DISCLAIMER,
  };
  report.sa103Boxes = buildBoxes(report);
  return report;
}

// ---------- combined (all vehicles) ----------

export function buildCombinedReport(data: TaxData, taxYear: number, overrides: Record<string, number> = {}): CombinedReport {
  const { from, to } = taxYearRange(taxYear);
  const inYear = data.vehicles
    .filter((v) => (!v.purchaseDate || t(v.purchaseDate) <= to.getTime()) && (!v.disposalDate || t(v.disposalDate) >= from.getTime()))
    .sort((a, b) => (a.purchaseDate ?? '').localeCompare(b.purchaseDate ?? ''));

  const combined: CombinedReport = {
    taxYear, taxYearLabel: taxYearLabel(taxYear), periodFrom: from.toISOString(), periodTo: to.toISOString(),
    vehicles: [], totalBusinessMiles: 0, totalClaim: 0, unassignedRoutes: 0, unassignedExpenses: 0, unassignedOdometerReadings: 0,
    sa103Boxes: [], warnings: [], disclaimer: DISCLAIMER,
  };

  for (const v of inYear) {
    const r = buildReport(data, taxYear, v.id, overrides[v.id] ?? null, true);
    combined.vehicles.push(r);
    combined.totalBusinessMiles += r.mileage.businessMiles;
    combined.totalClaim += r.totals.flatRateVehicle ? r.totals.flatRateClaim : round2(r.totals.allowable + r.capitalAllowance.allowance);
  }
  combined.totalClaim = round2(combined.totalClaim);

  combined.unassignedRoutes = data.routes.filter((r) => r.status === 'completed' && !r.vehicleId && inRange(r.scheduleStart, from, to)).length;
  combined.unassignedExpenses = data.expenses.filter((e) => !e.vehicleId && inRange(e.date, from, to)).length;
  combined.unassignedOdometerReadings = data.odometerReadings.filter((r) => !r.vehicleId && inRange(r.date, from, to)).length;
  if (combined.unassignedRoutes + combined.unassignedExpenses + combined.unassignedOdometerReadings > 0)
    combined.warnings.push(warn('warning', 'UNASSIGNED_RECORDS',
      `${combined.unassignedRoutes} route(s), ${combined.unassignedExpenses} expense(s) and ${combined.unassignedOdometerReadings} odometer reading(s) have no vehicle and are not included. Use "Assign by date" on the Vehicles screen.`));
  if (inYear.length === 0)
    combined.warnings.push(warn('warning', 'NO_VEHICLES_IN_YEAR', 'No vehicle was in use during this tax year (check purchase / disposal dates).'));

  const grouped = new Map<string, { box: Box; reg: string }[]>();
  for (const r of combined.vehicles)
    for (const b of r.sa103Boxes) {
      const key = `${b.form}|${b.box}`;
      grouped.set(key, [...(grouped.get(key) ?? []), { box: b, reg: r.vehicle?.registration ?? '?' }]);
    }
  combined.sa103Boxes = [...grouped.values()]
    .map((g) => ({
      form: g[0].box.form, box: g[0].box.box,
      label: g[0].box.label.replace(' (flat-rate mileage + parking/tolls)', '').replace(' (total)', ''),
      amount: round2(g.reduce((s, x) => s + x.box.amount, 0)),
      note: g.map((x) => `${x.reg} £${n2(x.box.amount)}`).join(' + '),
    }))
    .sort((a, b) => (a.form === b.form ? (parseInt(a.box, 10) || 999) - (parseInt(b.box, 10) || 999) : a.form === 'SA103F' ? -1 : 1));

  const flatRateReports = combined.vehicles.filter((r) => r.totals.flatRateVehicle);
  const flatRateMiles = flatRateReports.reduce((s, r) => s + r.simplifiedExpenses.businessMiles, 0);
  if (flatRateMiles > TAX_RULES.mileageFirstBandMiles && flatRateReports.length > 1)
    combined.warnings.push(warn('warning', 'FLAT_RATE_BAND_SHARED',
      `Flat-rate vehicles together exceed ${n0(TAX_RULES.mileageFirstBandMiles)} business miles; the ${pct0(TAX_RULES.mileageRateSecondBand)} band applies across the business, so the summed mileage claim is slightly overstated.`));

  return combined;
}

// ---------- capital allowances ----------

function calculateCapitalAllowance(
  vehicle: Vehicle | null, taxYear: number, from: Date, to: Date, fraction: number | null, expenses: Expense[], warnings: Warning[],
): CapitalAllowance {
  const ca: CapitalAllowance = {
    applicable: false, reason: null, allowanceType: null, allowanceLabel: null, sa103Box: null, rate: 0,
    qualifyingExpenditure: null, poolBroughtForward: 0, grossAllowance: 0, allowance: 0, poolCarriedForward: 0,
    businessUsePercent: fraction != null ? fraction * 100 : null, isDisposal: false, disposalDate: null, disposalProceeds: null,
    balancingAdjustmentGross: null, balancingType: null,
  };
  const set = (type: string, label: string, rate: number, box: string) => {
    ca.allowanceType = type; ca.allowanceLabel = label; ca.rate = rate; ca.sa103Box = box;
  };
  const label = taxYearLabel;

  if (!vehicle) { ca.reason = 'No vehicle configured.'; return ca; }
  const disposedThisYear = !!vehicle.disposalDate && inRange(vehicle.disposalDate, from, to);
  if (vehicle.claimMethod === 'mileage') {
    ca.reason = disposedThisYear
      ? 'Flat-rate mileage vehicle: no capital allowances were ever claimed, so its disposal has no balancing allowance or charge.'
      : 'Capital allowances cannot be claimed alongside the flat-rate mileage method (the rate already includes the cost of the vehicle).';
    return ca;
  }
  if (vehicle.financeType === 'lease') {
    ca.reason = 'Leased vehicles are not owned, so no capital allowance – the lease payments are a running cost instead.';
    return ca;
  }

  const boughtThisYear = !!vehicle.purchaseDate && inRange(vehicle.purchaseDate, from, to);
  const purchaseExpenses = expenses.filter((e) => e.category === 'vehiclePurchase');
  const purchasePrice = vehicle.purchasePrice ?? (purchaseExpenses.length ? purchaseExpenses.reduce((s, e) => s + e.amount, 0) : null);

  if (disposedThisYear) {
    ca.isDisposal = true;
    ca.disposalDate = vehicle.disposalDate;
    let wdv: number;
    if (boughtThisYear) {
      if (purchasePrice == null || purchasePrice <= 0) {
        ca.reason = 'Vehicle was bought and disposed of this tax year but no purchase price is recorded.';
        warnings.push(warn('warning', 'NO_PURCHASE_PRICE', 'Enter the vehicle purchase price to calculate the balancing adjustment.'));
        return ca;
      }
      wdv = purchasePrice;
      ca.qualifyingExpenditure = wdv;
    } else {
      if (vehicle.poolBroughtForwardTaxYear != null && vehicle.poolBroughtForwardTaxYear !== taxYear) {
        ca.reason = `The pool value on record is for ${label(vehicle.poolBroughtForwardTaxYear)}, not ${label(taxYear)}. Enter the written-down value carried forward into the disposal year.`;
        warnings.push(warn('warning', 'POOL_YEAR_MISMATCH', ca.reason));
        return ca;
      }
      if (vehicle.capitalAllowancePoolBroughtForward == null || vehicle.capitalAllowancePoolBroughtForward <= 0) {
        ca.reason = `Disposed of in ${label(taxYear)} but no written-down value brought forward is recorded. Enter the pool b/f (value after last year's allowance) on the Vehicles screen.`;
        warnings.push(warn('warning', 'NO_POOL_BF_DISPOSAL', ca.reason));
        return ca;
      }
      wdv = vehicle.capitalAllowancePoolBroughtForward;
      ca.poolBroughtForward = wdv;
    }

    let proceeds = vehicle.disposalProceeds ?? 0;
    if (vehicle.disposalProceeds == null)
      warnings.push(warn('warning', 'NO_DISPOSAL_PROCEEDS', 'No disposal proceeds recorded – treated as £0 (scrapped for nothing). Enter the sale / scrap / insurance amount on the Vehicles screen if you received anything.'));
    if (purchasePrice != null && proceeds > purchasePrice) {
      warnings.push(warn('info', 'PROCEEDS_CAPPED', `Disposal proceeds (£${n0(proceeds)}) exceed the original cost (£${n0(purchasePrice)}); the balancing charge is capped at cost.`));
      proceeds = purchasePrice;
    }
    ca.disposalProceeds = proceeds;

    const gross = round2(wdv - proceeds);
    ca.balancingAdjustmentGross = gross;
    ca.applicable = true;
    ca.rate = 0;
    ca.poolCarriedForward = 0;
    ca.grossAllowance = gross;
    ca.allowance = fraction != null ? round2(gross * fraction) : 0;
    if (gross >= 0) {
      ca.balancingType = 'balancingAllowance';
      set('balancingAllowance', `Balancing allowance on disposal (${dmy(vehicle.disposalDate!)}): written-down value £${n2(wdv)} − proceeds £${n2(proceeds)}`, 0, '56');
    } else {
      ca.balancingType = 'balancingCharge';
      set('balancingCharge', `Balancing charge on disposal (${dmy(vehicle.disposalDate!)}): proceeds £${n2(proceeds)} − written-down value £${n2(wdv)}`, 0, '58');
      warnings.push(warn('info', 'BALANCING_CHARGE', `Proceeds exceed the written-down value: a balancing charge of £${n2(-ca.allowance)} (business share) is added to your profit.`));
    }
    if (fraction == null)
      warnings.push(warn('warning', 'CA_NO_BUSINESS_PERCENT', 'The balancing adjustment is shown as £0 because the business-use % is unknown.'));
    return ca;
  }

  let base: number;
  if (boughtThisYear) {
    if (purchasePrice == null || purchasePrice <= 0) {
      ca.reason = 'Vehicle was bought this tax year but no purchase price is recorded.';
      warnings.push(warn('warning', 'NO_PURCHASE_PRICE', 'Enter the vehicle purchase price to calculate the capital allowance.'));
      return ca;
    }
    ca.qualifyingExpenditure = purchasePrice;
    base = purchasePrice;
  } else {
    if (vehicle.poolBroughtForwardTaxYear != null && vehicle.poolBroughtForwardTaxYear !== taxYear) {
      ca.reason = `The pool value on record is for ${label(vehicle.poolBroughtForwardTaxYear)}, not ${label(taxYear)}. Update the vehicle with the written-down value carried forward into this year.`;
      warnings.push(warn('warning', 'POOL_YEAR_MISMATCH', ca.reason));
      return ca;
    }
    if (vehicle.capitalAllowancePoolBroughtForward == null || vehicle.capitalAllowancePoolBroughtForward <= 0) {
      if (vehicle.purchaseDate && t(vehicle.purchaseDate) > to.getTime()) {
        ca.reason = `The vehicle's purchase date (${dmy(vehicle.purchaseDate)}) is after this tax year – check the year on the Vehicles screen.`;
        warnings.push(warn('warning', 'PURCHASE_AFTER_YEAR', ca.reason));
      } else if (vehicle.purchaseDate && t(vehicle.purchaseDate) < from.getTime()) {
        ca.reason = `Bought in an earlier year: enter the written-down value carried forward into ${label(taxYear)} on the Vehicles screen (pool b/f) to claim the writing-down allowance.`;
        warnings.push(warn('warning', 'NO_POOL_BF', ca.reason));
      } else {
        ca.reason = 'No purchase date recorded for this vehicle.';
        warnings.push(warn('warning', 'NO_PURCHASE_DATE', "Enter the vehicle's purchase date and price to calculate the capital allowance."));
      }
      return ca;
    }
    ca.poolBroughtForward = vehicle.capitalAllowancePoolBroughtForward;
    base = ca.poolBroughtForward;
  }

  const R = TAX_RULES;
  const isZeroEmission = vehicle.co2GPerKm === 0 || vehicle.fuelType === 'electric';
  if (vehicle.vehicleType === 'van' || vehicle.vehicleType === 'motorcycle') {
    if (boughtThisYear) set('aia', 'Annual Investment Allowance (van / motorcycle)', R.aiaRate, '49');
    else set('mainRateWda', `${pct0(R.mainRateWda)} main rate writing-down allowance`, R.mainRateWda, '50');
  } else if (boughtThisYear && vehicle.isNew && isZeroEmission) {
    set('fyaZeroEmission', '100% first-year allowance (new zero-emission car)', R.zeroEmissionCarFya, '52');
  } else if (vehicle.co2GPerKm != null && vehicle.co2GPerKm <= R.mainRateCo2Threshold) {
    set('mainRateWda', `${pct0(R.mainRateWda)} main rate writing-down allowance (CO2 ≤ ${R.mainRateCo2Threshold} g/km)`, R.mainRateWda, '50');
  } else if (vehicle.co2GPerKm != null) {
    set('specialRateWda', `${pct0(R.specialRateWda)} special rate writing-down allowance (CO2 > ${R.mainRateCo2Threshold} g/km)`, R.specialRateWda, '51');
  } else {
    set('specialRateWda', `${pct0(R.specialRateWda)} special rate writing-down allowance (no CO2 figure recorded)`, R.specialRateWda, '51');
    warnings.push(warn('warning', 'NO_CO2',
      `No CO2 figure is recorded for this car, so HMRC's default of the ${pct0(R.specialRateWda)} special rate has been applied. ` +
      `If the V5C (field V.7) or the DVLA lookup shows ${R.mainRateCo2Threshold} g/km or less, enter it to get the ${pct0(R.mainRateWda)} main rate; ` +
      'cars first registered before 1 March 2001 qualify for the main rate regardless.'));
  }

  ca.applicable = true;
  ca.grossAllowance = round2(base * ca.rate);
  ca.allowance = fraction != null ? round2(ca.grossAllowance * fraction) : 0;
  ca.poolCarriedForward = round2(base - ca.grossAllowance);
  if (fraction == null)
    warnings.push(warn('warning', 'CA_NO_BUSINESS_PERCENT', 'The capital allowance is shown as £0 because the business-use % is unknown.'));
  return ca;
}

// ---------- simplified expenses ----------

export function calculateSimplified(businessMiles: number, vehicleType: string): Simplified {
  const R = TAX_RULES;
  if (vehicleType === 'motorcycle')
    return {
      businessMiles, firstBandMiles: businessMiles, firstBandRate: R.motorcycleMileageRate, secondBandMiles: 0,
      secondBandRate: R.motorcycleMileageRate, amount: round2(businessMiles * R.motorcycleMileageRate),
    };
  const first = Math.min(businessMiles, R.mileageFirstBandMiles);
  const second = Math.max(0, businessMiles - R.mileageFirstBandMiles);
  return {
    businessMiles, firstBandMiles: first, firstBandRate: R.mileageRateFirstBand, secondBandMiles: second, secondBandRate: R.mileageRateSecondBand,
    amount: round2(first * R.mileageRateFirstBand + second * R.mileageRateSecondBand),
  };
}

// ---------- SA103 ----------

const CA_BOX_LABELS: Record<string, string> = {
  '49': 'Annual Investment Allowance',
  '50': 'Capital allowances at 18% on equipment, including cars with lower CO2 emissions',
  '51': 'Capital allowances at 6% on equipment, including cars with higher CO2 emissions',
  '52': 'Zero-emission car allowance',
  '56': 'Other capital allowances (balancing allowance on disposal)',
  '58': 'Balancing charge on sale or cessation of business use',
};

function buildBoxes(r: TaxReport): Box[] {
  if (r.totals.flatRateVehicle) {
    return [
      { form: 'SA103F', box: '20', label: 'Car, van and travel expenses (flat-rate mileage + parking/tolls)', amount: r.totals.flatRateClaim,
        note: `${n0(r.simplifiedExpenses.businessMiles)} business miles at the flat rate = £${n2(r.simplifiedExpenses.amount)}, plus £${n2(r.totals.allowable)} allowable parking/tolls. Enter the same figure on SA103S box 11.` },
      { form: 'SA103F', box: '35', label: 'Disallowable car, van and travel expenses', amount: 0, note: 'Simplified expenses are entered net – nothing to disallow.' },
      { form: 'SA103S', box: '11', label: 'Car, van and travel expenses (short form – enter the allowable amount)', amount: r.totals.flatRateClaim, note: 'Same flat-rate figure as box 20.' },
    ];
  }
  const boxes: Box[] = [
    { form: 'SA103F', box: '20', label: 'Car, van and travel expenses (total)', amount: r.totals.totalExpenses, note: 'Full amount of running costs before the private-use adjustment.' },
    { form: 'SA103F', box: '35', label: 'Disallowable car, van and travel expenses', amount: r.totals.disallowable, note: 'Private-use share (100% − business %).' },
  ];
  const ca = r.capitalAllowance;
  if (ca.applicable && ca.sa103Box)
    boxes.push({
      form: 'SA103F', box: ca.sa103Box, label: CA_BOX_LABELS[ca.sa103Box] ?? 'Capital allowance', amount: Math.abs(ca.allowance),
      note: ca.balancingType === 'balancingCharge' ? 'Added to profit (business share). Already reduced for private use.' : 'Already reduced for private use.',
    });
  boxes.push({ form: 'SA103S', box: '11', label: 'Car, van and travel expenses (short form – enter the allowable amount)', amount: r.totals.allowable, note: 'The short form takes the net allowable figure directly.' });
  return boxes;
}

// ---------- CSV ----------

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(r: TaxReport): string {
  const lines: string[] = [];
  const row = (...cells: unknown[]) => lines.push(cells.map(csvCell).join(','));
  const d = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);
  const m2 = (v: number | null | undefined) => (v == null ? null : v.toFixed(2));

  row('IncomeMeter tax year report', r.taxYearLabel);
  row('Period', d(r.periodFrom), d(r.periodTo));
  row('Generated', r.generatedAt.slice(0, 16).replace('T', ' ') + ' UTC');
  if (r.vehicle) row('Vehicle', r.vehicle.registration, r.vehicle.description, r.vehicle.vehicleType, 'claim method: ' + r.vehicle.claimMethod);
  lines.push('');
  row('MILEAGE');
  row('Business miles (routes)', r.mileage.businessMiles);
  row('Routes counted', r.mileage.routesCounted);
  row('Odometer opening', d(r.mileage.odometerStart?.date), r.mileage.odometerStart?.miles);
  row('Odometer closing', d(r.mileage.odometerEnd?.date), r.mileage.odometerEnd?.miles);
  row('Total miles', r.mileage.totalMiles);
  row('Business use %', r.mileage.businessUsePercent, r.mileage.businessUseSource);
  lines.push('');
  row('EXPENSES', 'Count', 'Total', '100% business', 'Allowable', 'Disallowable', 'Receipts missing');
  for (const c of r.categories) row(c.category, c.count, m2(c.total), m2(c.fullyBusinessTotal), m2(c.allowable), m2(c.disallowable), c.receiptsMissing);
  row('TOTAL', r.categories.reduce((s, c) => s + c.count, 0), m2(r.totals.totalExpenses), m2(r.categories.reduce((s, c) => s + c.fullyBusinessTotal, 0)),
    m2(r.totals.allowable), m2(r.totals.disallowable), r.totals.receiptsMissing);
  lines.push('');
  const ca = r.capitalAllowance;
  row('CAPITAL ALLOWANCE');
  row('Applicable', ca.applicable, ca.reason ?? ca.allowanceLabel);
  row('Qualifying expenditure', m2(ca.qualifyingExpenditure));
  row('Pool brought forward', m2(ca.poolBroughtForward));
  row('Rate', ca.rate);
  row('Gross allowance', m2(ca.grossAllowance));
  row('Allowance (business share)', m2(ca.allowance));
  row('Pool carried forward', m2(ca.poolCarriedForward));
  lines.push('');
  row('SIMPLIFIED EXPENSES (for comparison)');
  row('First band miles', r.simplifiedExpenses.firstBandMiles, r.simplifiedExpenses.firstBandRate);
  row('Second band miles', r.simplifiedExpenses.secondBandMiles, r.simplifiedExpenses.secondBandRate);
  row('Amount', m2(r.simplifiedExpenses.amount));
  lines.push('');
  row('COMPARISON');
  row('Actual cost method (allowable + capital allowance)', m2(r.comparison.actualCostTotal));
  row('Simplified expenses', m2(r.comparison.simplifiedTotal));
  row('Better method', r.comparison.betterMethod, r.comparison.lockedToOtherMethod ? 'locked to current method' : '');
  lines.push('');
  row('SA103 BOXES', 'Form', 'Box', 'Amount', 'Note');
  for (const b of r.sa103Boxes) row(b.label, b.form, b.box, m2(b.amount), b.note);
  lines.push('');
  row('WARNINGS');
  for (const w of r.warnings) row(w.severity, w.code, w.message);
  lines.push('');
  row('Disclaimer', r.disclaimer);
  return lines.join('\n') + '\n';
}
