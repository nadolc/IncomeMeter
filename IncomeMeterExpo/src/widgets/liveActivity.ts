import RouteLiveActivity from '../../modules/route-live-activity';
import { getAll, getById, getLocations, getSettings } from '../db/repo';
import { logEvent } from '../diagnostics/log';
import { kmToUnit } from '../domain/geo';
import { mergeStops } from '../domain/legs';
import { Route } from '../domain/types';
import { setTrackingListener, trackedKm } from '../tracking/tracker';
import { translate } from '../ui/i18n';

/**
 * Keeps the route's Live Activity (Lock Screen / Dynamic Island) in step with the recording: started with the
 * route, refreshed at most once a minute from the GPS task (the elapsed time ticks by itself), and ended with
 * the route. The layout and the 📍 button are native (targets/route-activity); this only sends the figures.
 * iOS builds only – the native module is absent on Android and in Expo Go.
 */
const UPDATE_EVERY_MS = 60_000;
let lastUpdate = 0;

const SYMBOLS: Record<string, string> = { walk: 'figure.walk', bicycle: 'bicycle', motorcycle: 'scooter', car: 'car.fill' };

/** ContentState of RouteActivityAttributes (Swift), as JSON. */
function stateFor(route: Route, ended = false): string {
  const s = getSettings();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, undefined, s.language);
  const income = route.totalIncome || route.estimatedIncome;
  return JSON.stringify({
    title: route.workType ?? t('routes'),
    symbol: SYMBOLS[route.travelMode ?? 'car'] ?? 'car.fill',
    startedAt: new Date(route.actualStartTime ?? route.scheduleStart).getTime() / 1000,
    distance: `${kmToUnit(trackedKm(route.id), s.mileageUnit).toFixed(1)} ${s.mileageUnit}`,
    stops: mergeStops(getLocations(route.id, 'stop')).length,
    stopsWord: t('stops'),
    elapsedLabel: t('elapsed'),
    distanceLabel: t('gpsTracked'),
    recordLabel: t('recordStop'),
    ended,
    endedText: ended ? `${t('completed')}${income ? ` · ${s.currencyCode} ${income.toFixed(2)}` : ''}` : '',
  });
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function startRouteActivity(route: Route) {
  if (!RouteLiveActivity) return;
  if (!RouteLiveActivity.isEnabled()) {
    logEvent('live-activity', 'turned off in iOS Settings');
    return;
  }
  lastUpdate = Date.now();
  RouteLiveActivity.start(route.id, `incomemeter://routes/${route.id}`, stateFor(route))
    .then(() => logEvent('live-activity', 'start'))
    .catch((e) => logEvent('live-activity-error', `start: ${errorText(e)}`));
}

export function updateRouteActivity(routeId: string, force = false) {
  if (!RouteLiveActivity || (!force && Date.now() - lastUpdate < UPDATE_EVERY_MS)) return;
  const route = getById('routes', routeId);
  if (!route || RouteLiveActivity.count() === 0) return;
  lastUpdate = Date.now();
  RouteLiveActivity.update(stateFor(route)).catch((e) => logEvent('live-activity-error', `update: ${errorText(e)}`));
}

/** Show the final figures for 10 minutes, then iOS removes it. */
export function endRouteActivity(route: Route) {
  if (!RouteLiveActivity || RouteLiveActivity.count() === 0) return;
  RouteLiveActivity.end(stateFor(route, true), 10 * 60)
    .then(() => logEvent('live-activity', 'end'))
    .catch((e) => logEvent('live-activity-error', `end: ${errorText(e)}`));
}

/** After a reinstall or restart: a route still in progress gets its Live Activity back, with current figures. */
export function ensureRouteActivity() {
  if (!RouteLiveActivity) return;
  const route = getAll('routes').find((r) => r.status === 'in_progress');
  if (!route) return;
  if (RouteLiveActivity.count() === 0) startRouteActivity(route);
  else updateRouteActivity(route.id, true);
}

let initialised = false;

/** Called once from the app entry (also when iOS starts the app in the background for GPS). */
export function initLiveActivity() {
  if (initialised || !RouteLiveActivity) return;
  initialised = true;
  setTrackingListener((routeId, kind) => updateRouteActivity(routeId, kind === 'stop'));
}
