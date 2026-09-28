import { newId, nowIso } from '../db/database';
import { logEvent } from '../diagnostics/log';
import { endRouteActivity, startRouteActivity } from '../widgets/liveActivity';
import { getAll, getById, getLocations, getSettings, save, saveSettings } from '../db/repo';
import { kmToUnit, movingMinutes } from '../domain/geo';
import { pickVehicleForDate } from '../domain/vehicleAssignment';
import { IncomeItem, Route, RouteStatus, TravelMode, usesOdometer } from '../domain/types';
import { startTracking, stopTracking, trackedKm, trackedPointCount, TrackingMode } from '../tracking/tracker';

const HOURS8 = 8 * 3_600_000;

export const totalOf = (incomes: IncomeItem[]) => Math.round(incomes.reduce((s, i) => s + (i.amount || 0), 0) * 100) / 100;

/** Distance = |end − start| when both odometer readings exist (RouteService). */
export const distanceOf = (startMile: number | null, endMile: number | null) =>
  startMile != null && endMile != null ? Math.abs(endMile - startMile) : 0;

export interface RouteInput {
  workType: string | null;
  workTypeId: string | null;
  vehicleId: string | null;
  status: RouteStatus;
  scheduleStart: string;
  scheduleEnd: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  incomes: IncomeItem[];
  estimatedIncome: number;
  startMile: number | null;
  endMile: number | null;
  /** Kept from the existing route when omitted (e.g. by the edit form). */
  travelMode?: TravelMode | null;
}

export function saveRoute(input: RouteInput, id?: string): Route {
  const existing = id ? getById('routes', id) : null;
  const vehicleId = input.vehicleId ?? pickVehicleForDate(getAll('vehicles'), input.scheduleStart);
  const travelMode = input.travelMode ?? existing?.travelMode ?? null;
  const trackedMiles = existing?.trackedMiles ?? null;
  const odometerDistance = distanceOf(input.startMile, input.endMile);
  const route: Route = {
    id: existing?.id ?? newId(),
    trackedMiles,
    movingMinutes: existing?.movingMinutes ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    ...input,
    travelMode,
    // Walking / cycling routes have no odometer: their distance is the GPS distance.
    vehicleId: usesOdometer(travelMode) ? vehicleId : null,
    totalIncome: totalOf(input.incomes),
    distance: odometerDistance || (!usesOdometer(travelMode) ? trackedMiles ?? 0 : 0),
  };
  return save('routes', route);
}

/** Start a route now (POST /api/routes/start) and begin recording GPS if enabled. */
export async function startRoute(args: {
  workType: string; workTypeId: string | null; vehicleId: string | null; startMile: number | null; estimatedIncome: number; incomes: IncomeItem[];
  travelMode: TravelMode;
}): Promise<{ route: Route; tracking: TrackingMode | 'off' }> {
  const now = new Date();
  saveSettings({ defaultTravelMode: args.travelMode });
  const route = saveRoute({
    travelMode: args.travelMode,
    workType: args.workType,
    workTypeId: args.workTypeId,
    vehicleId: args.vehicleId,
    status: 'in_progress',
    scheduleStart: now.toISOString(),
    scheduleEnd: new Date(now.getTime() + HOURS8).toISOString(),
    actualStartTime: now.toISOString(),
    actualEndTime: null,
    incomes: args.incomes,
    estimatedIncome: args.estimatedIncome,
    startMile: usesOdometer(args.travelMode) ? args.startMile : null,
    endMile: null,
  });
  const tracking = getSettings().trackRoutes ? await startTracking(route.id) : 'off';
  logEvent('route-start', `${args.travelMode}, GPS ${tracking}`);
  startRouteActivity(route);
  return { route, tracking };
}

/** Starting point for a new route: the previous route's end odometer on the same vehicle. */
export function suggestStartMile(vehicleId: string | null): number | null {
  const last = getAll('routes')
    .filter((r) => r.endMile != null && (!vehicleId || !r.vehicleId || r.vehicleId === vehicleId))
    .sort((a, b) => (b.actualEndTime ?? b.scheduleEnd).localeCompare(a.actualEndTime ?? a.scheduleEnd))[0];
  return last?.endMile ?? null;
}

export interface EndMileSuggestion {
  /** Driven distance in the odometer unit, from the recorded GPS path. */
  tracked: number;
  points: number;
  /** startMile + tracked, rounded to one decimal; null if the route has no start odometer or no path. */
  endMile: number | null;
}

export function suggestEndMile(route: Route): EndMileSuggestion {
  const unit = getSettings().mileageUnit;
  const tracked = Math.round(kmToUnit(trackedKm(route.id), unit) * 10) / 10;
  const points = trackedPointCount(route.id);
  return {
    tracked,
    points,
    endMile: route.startMile != null && points > 1 ? Math.round((route.startMile + tracked) * 10) / 10 : null,
  };
}

/** Complete a route (POST /api/routes/end): stop GPS, stamp times, total the incomes. */
export async function endRoute(route: Route, args: { endMile: number | null; incomes: IncomeItem[]; actualEndTime?: string }): Promise<Route> {
  await stopTracking();
  const end = args.actualEndTime ?? nowIso();
  const saved = saveRoute({
    ...route,
    status: 'completed',
    actualEndTime: end,
    // Like the API without a schedulePeriod: the schedule becomes the actual start → end.
    scheduleStart: route.actualStartTime ?? route.scheduleStart,
    scheduleEnd: end,
    incomes: args.incomes,
    endMile: args.endMile,
  }, route.id);
  const tracked = suggestEndMile(saved).tracked;
  logEvent('route-end', `${getLocations(route.id, 'track').length} GPS points, ${tracked} tracked`);
  const final = save('routes', {
    ...saved,
    trackedMiles: tracked,
    movingMinutes: Math.round(movingMinutes(getLocations(route.id, 'track')) * 10) / 10,
    distance: saved.distance || (!usesOdometer(saved.travelMode) ? tracked : 0),
  });
  endRouteActivity(final);
  return final;
}

export async function cancelRoute(route: Route) {
  await stopTracking();
  const cancelled = saveRoute({ ...route, status: 'cancelled' }, route.id);
  endRouteActivity(cancelled);
  return cancelled;
}

export function inProgressRoute(): Route | null {
  return getAll('routes').find((r) => r.status === 'in_progress') ?? null;
}
