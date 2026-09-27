// Port of DashboardController's stats. Runs in the device's local time (the server used UTC).
import { Route } from './types';

export type Period = 'weekly' | 'monthly' | 'annual';

export interface ChartBucket {
  label: string;
  start: Date;
  end: Date;
  income: number;
  routes: number;
  distance: number;
  incomeByWorkType: Record<string, number>;
}

export interface WorkTypeStats {
  workType: string;
  income: number;
  routes: number;
  hours: number;
  mileage: number;
  hourlyRate: number;
  /** Hours actually moving (GPS) – only routes that recorded it. */
  movingHours: number;
  /** Income per moving hour, from routes with moving time. */
  movingHourlyRate: number;
  earningsPerMile: number;
  incomeBySource: Record<string, number>;
}

export interface PeriodStats {
  period: Period;
  offset: number;
  title: string;
  start: Date;
  end: Date;
  total: number;
  buckets: ChartBucket[];
  byWorkType: WorkTypeStats[];
  canGoNext: boolean;
}

const DAY = 86_400_000;
const completedOnly = (routes: Route[]) => routes.filter((r) => r.status === 'completed');
const startOf = (r: Route) => new Date(r.scheduleStart).getTime();
const workTypeOf = (r: Route) => r.workType || 'Other';
export const routeIncome = (r: Route) => r.totalIncome || r.estimatedIncome || 0;

export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
  return x;
}

/** Start of the fiscal year containing `d`; fiscalStart is "MM-DD" (default 6 April, the UK tax year). */
export function fiscalYearStart(d: Date, fiscalStart = '04-06'): Date {
  const [m, day] = fiscalStart.split('-').map(Number);
  const thisYear = new Date(d.getFullYear(), m - 1, day);
  return d >= thisYear ? thisYear : new Date(d.getFullYear() - 1, m - 1, day);
}

function bucket(label: string, start: Date, end: Date, routes: Route[]): ChartBucket {
  const inside = routes.filter((r) => startOf(r) >= start.getTime() && startOf(r) <= end.getTime());
  const byWt: Record<string, number> = {};
  for (const r of inside) byWt[workTypeOf(r)] = (byWt[workTypeOf(r)] ?? 0) + r.totalIncome;
  return {
    label, start, end,
    income: inside.reduce((s, r) => s + r.totalIncome, 0),
    routes: inside.length,
    distance: inside.reduce((s, r) => s + (r.distance || 0), 0),
    incomeByWorkType: byWt,
  };
}

/** Per-work-type totals (CalculateWorkTypeStats): hours from actual times, falling back to the schedule. */
export function workTypeStats(routes: Route[]): WorkTypeStats[] {
  const groups = new Map<string, Route[]>();
  for (const r of routes) groups.set(workTypeOf(r), [...(groups.get(workTypeOf(r)) ?? []), r]);
  return [...groups.entries()].map(([workType, rs]) => {
    const income = rs.reduce((s, r) => s + r.totalIncome, 0);
    let ms = rs.reduce((s, r) => s + (r.actualStartTime && r.actualEndTime
      ? Math.max(0, new Date(r.actualEndTime).getTime() - new Date(r.actualStartTime).getTime()) : 0), 0);
    if (ms === 0) ms = rs.reduce((s, r) => s + Math.max(0, new Date(r.scheduleEnd).getTime() - new Date(r.scheduleStart).getTime()), 0);
    const hours = ms / 3_600_000;
    const mileage = rs.reduce((s, r) => s + (r.distance || 0), 0);
    const withMoving = rs.filter((r) => (r.movingMinutes ?? 0) > 0);
    const movingHours = withMoving.reduce((s, r) => s + r.movingMinutes! / 60, 0);
    const movingIncome = withMoving.reduce((s, r) => s + r.totalIncome, 0);
    const incomeBySource: Record<string, number> = {};
    for (const r of rs) for (const i of r.incomes) incomeBySource[i.source] = (incomeBySource[i.source] ?? 0) + i.amount;
    return {
      workType, income, routes: rs.length, hours, mileage,
      hourlyRate: hours > 0 ? income / hours : 0,
      movingHours,
      movingHourlyRate: movingHours > 0 ? movingIncome / movingHours : 0,
      earningsPerMile: mileage > 0 ? income / mileage : 0,
      incomeBySource,
    };
  }).sort((a, b) => b.income - a.income);
}

export function periodStats(allRoutes: Route[], period: Period, offset: number, locale: string, fiscalStart = '04-06', now = new Date()): PeriodStats {
  const routes = completedOnly(allRoutes);
  const buckets: ChartBucket[] = [];
  let start: Date;
  let end: Date;
  let title: string;

  if (period === 'weekly') {
    start = mondayOf(new Date(now.getTime() + offset * 7 * DAY));
    end = new Date(start.getTime() + 7 * DAY - 1);
    for (let i = 0; i < 7; i++) {
      const s = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1, 0, 0, 0, -1);
      buckets.push(bucket(s.toLocaleDateString(locale, { weekday: 'short' }), s, e, routes));
    }
    const weekNo = Math.max(1, Math.floor((start.getTime() - fiscalYearStart(start, fiscalStart).getTime()) / DAY / 7) + 1);
    title = `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })} · W${weekNo}`;
  } else if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, -1);
    let ws = mondayOf(start);
    let n = 1;
    while (ws <= end) {
      const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 7, 0, 0, 0, -1);
      const s = ws < start ? start : ws;
      const e = we > end ? end : we;
      buckets.push(bucket(`W${n++}`, s, e, routes));
      ws = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 7);
    }
    title = start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  } else {
    const fy = fiscalYearStart(now, fiscalStart);
    start = new Date(fy.getFullYear() + offset, fy.getMonth(), fy.getDate());
    end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate(), 0, 0, 0, -1);
    for (let i = 0; i < 12; i++) {
      const s = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
      const e = new Date(start.getFullYear(), start.getMonth() + i + 1, start.getDate(), 0, 0, 0, -1);
      buckets.push(bucket(s.toLocaleDateString(locale, { month: 'short' }), s, e, routes));
    }
    title = `${start.getFullYear()}/${String((start.getFullYear() + 1) % 100).padStart(2, '0')}`;
  }

  const inPeriod = routes.filter((r) => startOf(r) >= start.getTime() && startOf(r) <= end.getTime());
  return {
    period, offset, title, start, end, buckets,
    total: inPeriod.reduce((s, r) => s + r.totalIncome, 0),
    byWorkType: workTypeStats(inPeriod),
    canGoNext: now.getTime() > end.getTime(),
  };
}

export interface SummaryStats {
  last7Days: number;
  previous7Days: number;
  changePercent: number | null;
  thisMonth: number;
  totalRoutes: number;
  activeDaysThisMonth: number;
  averageDailyIncome: number;
}

export function summaryStats(allRoutes: Route[], now = new Date()): SummaryStats {
  const routes = completedOnly(allRoutes);
  const t = now.getTime();
  const sum = (from: number, to: number) => routes.filter((r) => startOf(r) >= from && startOf(r) < to).reduce((s, r) => s + r.totalIncome, 0);
  const last7Days = sum(t - 7 * DAY, t + 1);
  const previous7Days = sum(t - 14 * DAY, t - 7 * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthRoutes = routes.filter((r) => startOf(r) >= monthStart);
  const thisMonth = monthRoutes.reduce((s, r) => s + r.totalIncome, 0);
  const activeDays = new Set(monthRoutes.map((r) => new Date(r.actualEndTime ?? r.scheduleStart).toDateString())).size;
  return {
    last7Days, previous7Days,
    changePercent: previous7Days > 0 ? ((last7Days - previous7Days) / previous7Days) * 100 : null,
    thisMonth,
    totalRoutes: allRoutes.length,
    activeDaysThisMonth: activeDays,
    averageDailyIncome: activeDays > 0 ? thisMonth / activeDays : 0,
  };
}
