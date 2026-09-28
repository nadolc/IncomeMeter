import { Platform } from 'react-native';
import { getAll, getById, getLocations, getSettings } from '../db/repo';
import { logEvent } from '../diagnostics/log';
import { kmToUnit } from '../domain/geo';
import { mergeStops } from '../domain/legs';
import { Route } from '../domain/types';
import { recordStop, setTrackingListener, trackedKm } from '../tracking/tracker';
import { translate } from '../ui/i18n';
import type { RouteActivityProps } from './RouteActivity';

/**
 * Keeps the route's Live Activity (Lock Screen / Dynamic Island) in step with the recording: started with the
 * route, refreshed at most once a minute from the GPS task (the elapsed time ticks by itself), and ended with
 * the route. Its "📍 Record stop" button records a stop while the app is running (it is, during a route).
 */
type Factory = typeof import('./RouteActivity').default;
type Instance = ReturnType<Factory['start']>;

const UPDATE_EVERY_MS = 60_000;
let factory: Factory | null | undefined;
let lastUpdate = 0;

function getFactory(): Factory | null {
  if (factory === undefined) {
    try {
      // iOS only; required lazily so Android and Expo Go never load the widget runtime.
      factory = Platform.OS === 'ios' ? require('./RouteActivity').default : null;
    } catch (e) {
      logEvent('live-activity-error', `load: ${e instanceof Error ? e.message : String(e)}`);
      factory = null;
    }
  }
  return factory ?? null;
}

function instances(): Instance[] {
  try {
    return getFactory()?.getInstances() ?? [];
  } catch {
    return [];
  }
}

const SYMBOLS: Record<string, string> = { walk: 'figure.walk', bicycle: 'bicycle', motorcycle: 'scooter', car: 'car.fill' };

function propsFor(route: Route, ended = false): RouteActivityProps {
  const s = getSettings();
  const t = (k: Parameters<typeof translate>[0]) => translate(k, undefined, s.language);
  const distance = `${kmToUnit(trackedKm(route.id), s.mileageUnit).toFixed(1)} ${s.mileageUnit}`;
  const income = route.totalIncome || route.estimatedIncome;
  return {
    title: route.workType ?? t('routes'),
    symbol: SYMBOLS[route.travelMode ?? 'car'] ?? 'car.fill',
    startedAtMs: new Date(route.actualStartTime ?? route.scheduleStart).getTime(),
    distance,
    stopsCount: mergeStops(getLocations(route.id, 'stop')).length,
    stopsWord: t('stops'),
    elapsedLabel: t('elapsed'),
    distanceLabel: t('gpsTracked'),
    recordLabel: t('recordStop'),
    ended,
    endedText: ended ? `${t('completed')}${income ? ` · ${s.currencyCode} ${income.toFixed(2)}` : ''}` : '',
  };
}

export function startRouteActivity(route: Route) {
  const f = getFactory();
  if (!f) return;
  try {
    instances().forEach((i) => i.end('immediate').catch(() => undefined));
    f.start(propsFor(route), `incomemeter://routes/${route.id}`);
    lastUpdate = Date.now();
    logEvent('live-activity', 'start');
  } catch (e) {
    logEvent('live-activity-error', `start: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function updateRouteActivity(routeId: string, force = false) {
  if (!force && Date.now() - lastUpdate < UPDATE_EVERY_MS) return;
  const route = getById('routes', routeId);
  const current = instances()[0];
  if (!route || !current) return;
  lastUpdate = Date.now();
  current.update(propsFor(route)).catch((e) => logEvent('live-activity-error', `update: ${String(e)}`));
}

/** Show the final figures for 10 minutes, then let iOS remove it. */
export function endRouteActivity(route: Route) {
  const f = getFactory();
  if (!f) return;
  try {
    const { after } = require('expo-widgets') as typeof import('expo-widgets');
    const final = propsFor(route, true);
    instances().forEach((i) => i.end(after(new Date(Date.now() + 10 * 60_000)), final).catch(() => undefined));
    logEvent('live-activity', 'end');
  } catch (e) {
    logEvent('live-activity-error', `end: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** After a reinstall or restart: a route still in progress gets its Live Activity back. */
export function ensureRouteActivity() {
  const route = getAll('routes').find((r) => r.status === 'in_progress');
  if (route && getFactory() && instances().length === 0) startRouteActivity(route);
}

let initialised = false;

/** Called once from the app entry (also when iOS starts the app in the background for GPS). */
export function initLiveActivity() {
  if (initialised || !getFactory()) return;
  initialised = true;
  setTrackingListener((routeId, kind) => updateRouteActivity(routeId, kind === 'stop'));
  try {
    const { addUserInteractionListener, widgetsDirectory } = require('expo-widgets') as typeof import('expo-widgets');
    // The Live Activity reads its layout from the app group; without it the Lock Screen shows an empty box.
    logEvent('live-activity', `app group ${widgetsDirectory ? 'ok' : 'MISSING'}`);
    addUserInteractionListener((event) => {
      if (event.source !== 'RouteActivity' || event.target !== 'record-stop') return;
      const route = getAll('routes').find((r) => r.status === 'in_progress');
      if (!route) return;
      logEvent('live-activity', 'record-stop tapped');
      recordStop(route.id).catch((e) => logEvent('live-activity-error', `record-stop: ${String(e)}`));
    });
  } catch (e) {
    logEvent('live-activity-error', `listener: ${e instanceof Error ? e.message : String(e)}`);
  }
}
