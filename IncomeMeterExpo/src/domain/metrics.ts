// Earnings rates and the "should I take this order?" helpers. Pure functions over local data.
import { haversineKm } from './geo';
import { LocationPoint, Route } from './types';

const MIN = 60_000;

// ---------- per route ----------

export interface RouteRates {
  onlineMinutes: number;
  /** null when the route has no GPS path. */
  movingMinutes: number | null;
  waitingMinutes: number | null;
  /** Income per hour online (start → end). */
  hourlyOnline: number | null;
  /** Income per hour actually moving – what the time spent travelling earned. */
  hourlyMoving: number | null;
  /** Income per km / mile (the odometer unit). */
  perDistance: number | null;
}

export function routeRates(route: Route, income = route.totalIncome, now = Date.now()): RouteRates {
  const start = route.actualStartTime ? new Date(route.actualStartTime).getTime() : null;
  const end = route.actualEndTime ? new Date(route.actualEndTime).getTime() : now;
  const onlineMinutes = start != null ? Math.max(0, (end - start) / MIN) : 0;
  const moving = route.movingMinutes ?? null;
  const distance = route.distance || route.trackedMiles || 0;
  return {
    onlineMinutes,
    movingMinutes: moving,
    waitingMinutes: moving != null ? Math.max(0, onlineMinutes - moving) : null,
    hourlyOnline: onlineMinutes > 0 ? income / (onlineMinutes / 60) : null,
    hourlyMoving: moving && moving > 0 ? income / (moving / 60) : null,
    perDistance: distance > 0 ? income / distance : null,
  };
}

// ---------- target hourly ----------

/**
 * Own average income per hour online over the last `days` days (completed routes with actual times).
 * Null until there are at least 3 such routes – then the offer tools ask for a target instead.
 */
export function averageHourly(routes: Route[], now = new Date(), days = 28): number | null {
  const from = now.getTime() - days * 24 * 60 * MIN;
  const recent = routes.filter((r) => r.status === 'completed' && r.actualStartTime && r.actualEndTime
    && new Date(r.actualEndTime).getTime() >= from);
  if (recent.length < 3) return null;
  const income = recent.reduce((s, r) => s + r.totalIncome, 0);
  const hours = recent.reduce((s, r) => s + (new Date(r.actualEndTime!).getTime() - new Date(r.actualStartTime!).getTime()) / (60 * MIN), 0);
  return hours > 0 ? income / hours : null;
}

// ---------- offers ----------

export type Verdict = 'good' | 'borderline' | 'bad';

export interface OfferInput {
  /** Order fee shown on the offer (all orders in the batch). */
  fee: number;
  /** On-time bonus ("+$6.00"), counted when the order is expected to be on time. */
  bonus?: number;
  /** Minutes from now until the last "deliver before" time. */
  minutes: number;
  /** Share of the time limit usually needed (1 = all of it). */
  completionFactor: number;
  targetHourly: number;
  /** Text to search for avoided areas (addresses read from the offer). */
  text?: string;
  /** "|"-separated place names to avoid. */
  avoidAreas?: string;
}

export interface OfferResult {
  /** If the whole time limit is used. */
  hourlyWorst: number;
  /** With the usual completion factor. */
  hourlyExpected: number;
  verdict: Verdict;
  areaHits: string[];
}

export const avoidList = (avoidAreas: string | undefined) =>
  (avoidAreas ?? '').split(/[|,，\n]/).map((a) => a.trim()).filter(Boolean);

export function evaluateOffer(o: OfferInput): OfferResult {
  const pay = o.fee + (o.bonus ?? 0);
  const minutes = Math.max(1, o.minutes);
  const hourlyWorst = pay / (minutes / 60);
  const hourlyExpected = pay / ((minutes * Math.min(1, Math.max(0.3, o.completionFactor))) / 60);
  const areaHits = avoidList(o.avoidAreas).filter((a) => (o.text ?? '').includes(a));
  const verdict: Verdict = hourlyExpected >= o.targetHourly ? 'good' : hourlyExpected >= o.targetHourly * 0.85 ? 'borderline' : 'bad';
  return { hourlyWorst, hourlyExpected, verdict, areaHits };
}

/** Minimum fee worth taking for each time limit: target × minutes × factor ÷ 60. */
export function thresholdTable(targetHourly: number, completionFactor: number, minutes = [15, 20, 25, 30, 35, 40, 50, 60]) {
  return minutes.map((m) => ({ minutes: m, minFee: Math.ceil((targetHourly * m * completionFactor) / 60) }));
}

/** Minutes from `now` until an "HH:MM" deadline today (tomorrow if it has already passed). */
export function minutesUntil(hhmm: string, now = new Date()): number | null {
  const m = hhmm.trim().match(/^(\d{1,2})[:：](\d{2})$/);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() < now.getTime() - 5 * MIN) d.setDate(d.getDate() + 1);
  return Math.max(0, Math.round((d.getTime() - now.getTime()) / MIN));
}

// ---------- areas ----------

export interface AreaStat {
  label: string;
  latitude: number;
  longitude: number;
  visits: number;
  /** Average metres climbed getting there, from the previous stop (or the route start). */
  avgClimbM: number | null;
  /** Average minutes after the stop before moving away (lifts, waiting for the next order). */
  avgIdleAfterMin: number | null;
  suggestAvoid: boolean;
}

const RADIUS_KM = 0.25;

/** First part of a stop address, e.g. "石桃樓" from "石桃樓, 石圍角路, 荃灣". */
const labelOf = (address: string | null) => (address ?? '').split(',')[0].trim();

/**
 * Group stops within 250 m, then per group: how often you went, how much climbing it took to get there,
 * and how long you were stuck there afterwards. Suggest avoiding places with big climbs or long waits.
 */
export function areaStats(stops: LocationPoint[], track: LocationPoint[], minVisits = 3): AreaStat[] {
  const byRoute = new Map<string, { stops: LocationPoint[]; track: LocationPoint[] }>();
  for (const s of stops) byRoute.set(s.routeId, { stops: [...(byRoute.get(s.routeId)?.stops ?? []), s], track: [] });
  for (const p of track) byRoute.get(p.routeId)?.track.push(p);

  type Visit = { stop: LocationPoint; climb: number | null; idleAfter: number | null };
  const visits: Visit[] = [];
  for (const { stops: rs, track: rt } of byRoute.values()) {
    rs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    rt.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const altAt = (p: LocationPoint) => p.altitude ?? nearestAltitude(rt, p.timestamp);
    rs.forEach((stop, i) => {
      const from = i > 0 ? rs[i - 1] : rt[0];
      const a1 = altAt(stop);
      const a0 = from ? altAt(from) : null;
      const t = new Date(stop.timestamp).getTime();
      const leave = rt.find((p) => new Date(p.timestamp).getTime() > t
        && haversineKm(p.latitude, p.longitude, stop.latitude, stop.longitude) > 0.05);
      visits.push({
        stop,
        climb: a1 != null && a0 != null ? a1 - a0 : null,
        idleAfter: leave ? (new Date(leave.timestamp).getTime() - t) / MIN : null,
      });
    });
  }

  const groups: Visit[][] = [];
  for (const v of visits) {
    const g = groups.find((g) => haversineKm(g[0].stop.latitude, g[0].stop.longitude, v.stop.latitude, v.stop.longitude) <= RADIUS_KM);
    if (g) g.push(v); else groups.push([v]);
  }

  const avg = (xs: (number | null)[]) => {
    const ys = xs.filter((x): x is number => x != null);
    return ys.length ? ys.reduce((s, x) => s + x, 0) / ys.length : null;
  };
  return groups
    .map((g) => {
      const labels = g.map((v) => labelOf(v.stop.address)).filter(Boolean);
      const label = mostCommon(labels) ?? `${g[0].stop.latitude.toFixed(4)}, ${g[0].stop.longitude.toFixed(4)}`;
      const avgClimbM = avg(g.map((v) => v.climb));
      const avgIdleAfterMin = avg(g.map((v) => v.idleAfter));
      return {
        label,
        latitude: g[0].stop.latitude,
        longitude: g[0].stop.longitude,
        visits: g.length,
        avgClimbM,
        avgIdleAfterMin,
        suggestAvoid: g.length >= minVisits && ((avgClimbM ?? 0) >= 30 || (avgIdleAfterMin ?? 0) >= 12),
      };
    })
    .sort((a, b) => Number(b.suggestAvoid) - Number(a.suggestAvoid) || b.visits - a.visits);
}

function nearestAltitude(track: LocationPoint[], iso: string): number | null {
  const t = new Date(iso).getTime();
  let best: LocationPoint | null = null;
  for (const p of track) {
    if (p.altitude == null) continue;
    if (!best || Math.abs(new Date(p.timestamp).getTime() - t) < Math.abs(new Date(best.timestamp).getTime() - t)) best = p;
  }
  return best && Math.abs(new Date(best.timestamp).getTime() - t) <= 5 * MIN ? best.altitude ?? null : null;
}

function mostCommon(xs: string[]): string | null {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
