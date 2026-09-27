import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getDb, newId, notify } from '../db/database';
import { getById, getLastLocation, getLocations, getSettings, insertLocations } from '../db/repo';
import { acceptFix, Fix, GAP_S, haversineKm, KM_TO_MI, Mode, pathKm, PROFILES } from '../domain/geo';
import { LocationKind, LocationPoint, TravelMode } from '../domain/types';
import { logEvent, startDiagnostics } from '../diagnostics/log';
import { syncQuietly } from '../sync/sync';

/**
 * Records where you go while a route is in progress, so the end odometer can be suggested and walking /
 * cycling routes get their distance, moving time and stops from GPS.
 *
 * Uses a background location task (foreground-service notification on Android) when the user grants
 * "Allow all the time"; otherwise falls back to watching position while the app is open.
 *
 * Battery: walking, cycling and motorcycle routes drop to low-power location after 2 minutes without
 * movement (waiting for food, lifts) and go back to GPS as soon as the phone moves away.
 */
export const TRACKING_TASK = 'incomemeter-route-tracking';
const ACTIVE_KEY = 'tracking.activeRouteId';
const POWER_KEY = 'tracking.power';
const MODE_KEY = 'tracking.mode';

/** How the active route is being recorded right now – shown to the rider, so a silent fallback is visible. */
export function getTrackingMode(): TrackingMode | null {
  return (kvGet(MODE_KEY) as TrackingMode | null) ?? null;
}

function setTrackingMode(mode: TrackingMode | null) {
  if (mode) logEvent('tracking', mode);
  kvSet(MODE_KEY, mode);
  notify('kv');
}

/** 'fixed' = this phone won't change location settings from the background (Android): keep them as they are. */
type Power = 'moving' | 'still' | 'fixed';

let foregroundSub: Location.LocationSubscription | null = null;

// ---------- kv helpers ----------

const kvGet = (key: string) => getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key)?.value ?? null;
const kvSet = (key: string, value: string | null) => {
  if (value == null) getDb().runSync('DELETE FROM kv WHERE key = ?', key);
  else getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
};

// ---------- active route (persisted so the background task and restarts know where to write) ----------

export function getActiveTrackingRouteId(): string | null {
  return kvGet(ACTIVE_KEY) || null;
}

function setActiveTrackingRouteId(routeId: string | null) {
  kvSet(ACTIVE_KEY, routeId);
  kvSet(POWER_KEY, routeId ? 'moving' : null);
  if (!routeId) kvSet(MODE_KEY, null);
  notify('kv');
}

function modeOf(routeId: string): Mode {
  return (getById('routes', routeId)?.travelMode as TravelMode | null | undefined) ?? 'car';
}

// ---------- location options per mode ----------

function movingOptions(mode: Mode): Location.LocationTaskOptions {
  switch (mode) {
    case 'walk':
      // Points every ~15 m; Android hands them over in batches so the app wakes up once a minute.
      return { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 10_000, deferredUpdatesInterval: 60_000,
        activityType: Location.ActivityType.Fitness };
    case 'bicycle':
      return { accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 5_000, deferredUpdatesInterval: 30_000,
        activityType: Location.ActivityType.Fitness };
    case 'motorcycle':
      return { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 5_000, activityType: Location.ActivityType.AutomotiveNavigation };
    default:
      return { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 20, timeInterval: 5_000,
        activityType: Location.ActivityType.AutomotiveNavigation };
  }
}

/** Standing still: Wi-Fi / cell location every 30 s is enough to notice when you start moving again. */
const STILL_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 30_000,
};

function taskOptions(mode: Mode, power: Power): Location.LocationTaskOptions {
  return {
    ...(power === 'still' ? STILL_OPTIONS : movingOptions(mode)),
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'IncomeMeter – route in progress',
      notificationBody: power === 'still' ? 'Standing still – saving battery.' : 'Recording the distance you travel.',
      killServiceOnDestroy: false,
    },
  };
}

// ---------- recording ----------

const toFix = (p: LocationPoint): Fix => ({
  latitude: p.latitude, longitude: p.longitude, timestamp: new Date(p.timestamp).getTime(), accuracy: p.accuracy,
});

/** Filter raw fixes against the last stored point and save the ones that are real movement. */
export function recordFixes(routeId: string, locations: Location.LocationObject[], mode: Mode = modeOf(routeId)): number {
  const last = getLastLocation(routeId);
  let prev: Fix | null = last && toFix(last);
  const points: LocationPoint[] = [];
  for (const loc of [...locations].sort((a, b) => a.timestamp - b.timestamp)) {
    if (prev && loc.timestamp <= prev.timestamp) continue;
    const fix: Fix = {
      latitude: loc.coords.latitude, longitude: loc.coords.longitude, timestamp: loc.timestamp, accuracy: loc.coords.accuracy ?? null,
    };
    const accepted = acceptFix(prev, fix, mode);
    if (!accepted) continue;
    points.push({
      id: newId(),
      routeId,
      kind: 'track',
      latitude: Math.round(fix.latitude * 1e6) / 1e6,
      longitude: Math.round(fix.longitude * 1e6) / 1e6,
      timestamp: new Date(fix.timestamp).toISOString(),
      accuracy: fix.accuracy,
      speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
      altitude: loc.coords.altitude ?? null,
      address: null,
      distanceFromLastKm: Math.round(accepted.stepKm * 1000) / 1000,
      distanceFromLastMi: Math.round(accepted.stepKm * KM_TO_MI * 1000) / 1000,
    });
    prev = fix;
  }
  insertLocations(points);
  return points.length;
}

/**
 * After each batch: switch between GPS and low-power location, and mark a stop when a walker / cyclist has
 * been standing still. Returns the power state to use from now on.
 */
async function afterFixes(routeId: string, mode: Mode, locations: Location.LocationObject[], background: boolean) {
  const profile = PROFILES[mode];
  const last = getLastLocation(routeId);
  const latest = locations.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  if (!last) return;
  const lastMs = new Date(last.timestamp).getTime();
  const power = (kvGet(POWER_KEY) as Power | null) ?? 'moving';

  if (power !== 'still' && latest.timestamp - lastMs > GAP_S * 1000) {
    if (profile.autoStopAfterS > 0 && getSettings().autoStops) await autoStop(routeId, last);
    if (profile.adaptivePower && background && power === 'moving') await switchPower(mode, 'still');
  } else if (power === 'still') {
    // Moved away from where we stopped (by more than the fix's own uncertainty) → back to GPS.
    const away = locations.some((l) => {
      const metres = haversineKm(last.latitude, last.longitude, l.coords.latitude, l.coords.longitude) * 1000;
      return metres > Math.max(60, l.coords.accuracy ?? 0);
    });
    if (away) await switchPower(mode, 'moving');
  }
}

async function switchPower(mode: Mode, power: Power) {
  logEvent('power', power);
  kvSet(POWER_KEY, power);
  try {
    // Calling start again on a running task updates its options.
    await Location.startLocationUpdatesAsync(TRACKING_TASK, taskOptions(mode, power));
  } catch {
    // Android doesn't allow restarting the location service from the background. Keep the current settings
    // for the rest of the route (costs battery, loses nothing) and stop trying.
    logEvent('power-switch-refused', power);
    kvSet(POWER_KEY, power === 'moving' ? 'fixed' : 'moving');
  }
}

/** Standing still for 2 minutes = a pickup or drop-off. Skipped if a stop was already marked here. */
async function autoStop(routeId: string, at: LocationPoint) {
  const since = new Date(at.timestamp).getTime() - 10 * 60_000;
  const nearby = getLocations(routeId, 'stop').some((s) =>
    new Date(s.timestamp).getTime() >= since && haversineKm(s.latitude, s.longitude, at.latitude, at.longitude) < 0.08);
  if (nearby) return;
  insertLocations([{
    id: newId(), routeId, kind: 'stop', latitude: at.latitude, longitude: at.longitude, timestamp: at.timestamp,
    accuracy: at.accuracy, speed: null, altitude: at.altitude ?? null,
    address: await addressFor(at.latitude, at.longitude), distanceFromLastKm: null, distanceFromLastMi: null,
  }]);
}

/**
 * Distance travelled so far, in km: the sum of the recorded path. Routes with no path (GPS off or denied,
 * or recorded by the old iOS shortcut) fall back to straight lines between their stops – an underestimate.
 */
export function trackedKm(routeId: string): number {
  const row = getDb().getFirstSync<{ km: number | null; n: number }>(
    "SELECT SUM(distance_km) AS km, COUNT(*) AS n FROM locations WHERE route_id = ? AND kind = 'track'", routeId);
  if (row && row.n >= 2) return row.km ?? 0;
  return pathKm(getLocations(routeId, 'stop'));
}

/** Points that make up the distance: driving points, or the stops when there is no driving path. */
export function trackedPointCount(routeId: string): number {
  const count = (kind: LocationKind) =>
    getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM locations WHERE route_id = ? AND kind = ?', routeId, kind)?.n ?? 0;
  const track = count('track');
  return track >= 2 ? track : count('stop');
}

/**
 * One-line address from the phone's geocoder, building / estate first – e.g. "石桃樓, 石圍角路, 荃灣".
 * Best effort – null offline.
 */
async function addressFor(latitude: number, longitude: number): Promise<string | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!a) return null;
    const street = [a.streetNumber, a.street].filter(Boolean).join(' ');
    const parts = [a.name && a.name !== street && a.name !== a.streetNumber ? a.name : null, street, a.district ?? a.subregion ?? a.city];
    return [...new Set(parts.filter(Boolean))].join(', ') || null;
  } catch {
    return null;
  }
}

/**
 * Mark a stop (pickup / drop-off) on a route – what the iOS "記錄位置" shortcut did. Uses the given
 * coordinates (e.g. passed in by a Shortcut) or the phone's current position.
 */
export async function recordStop(routeId: string, coords?: { latitude: number; longitude: number }): Promise<LocationPoint> {
  let position = coords;
  let accuracy: number | null = null;
  let altitude: number | null = null;
  if (!position) {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') throw new Error('Location permission denied');
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .catch(() => Location.getLastKnownPositionAsync());
    if (!loc) throw new Error('Current location unavailable');
    position = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    accuracy = loc.coords.accuracy ?? null;
    altitude = loc.coords.altitude ?? null;
  }
  const point: LocationPoint = {
    id: newId(),
    routeId,
    kind: 'stop',
    latitude: Math.round(position.latitude * 1e6) / 1e6,
    longitude: Math.round(position.longitude * 1e6) / 1e6,
    timestamp: new Date().toISOString(),
    accuracy,
    speed: null,
    altitude,
    address: await addressFor(position.latitude, position.longitude),
    // Stops don't add distance – the path already covers it.
    distanceFromLastKm: null,
    distanceFromLastMi: null,
  };
  insertLocations([point]);
  // Send it up now, so a CarPlay-shortcut stop at the same place moments later is recognised as the same stop.
  syncQuietly();
  return point;
}

startDiagnostics();
let lastBatchAt = 0;

// Must be defined at module load (imported from the app entry) so the OS can wake it in the background.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    logEvent('gps-error', String(error.message ?? error));
    return;
  }
  if (!data?.locations?.length) return;
  const routeId = getActiveTrackingRouteId();
  if (!routeId) return;
  try {
    const mode = modeOf(routeId);
    const kept = recordFixes(routeId, data.locations, mode);
    // Log the first batch after a (re)start and any resume after a silence – that's where gaps come from.
    const now = Date.now();
    if (lastBatchAt === 0 || now - lastBatchAt > 60_000)
      logEvent('gps-batch', `${lastBatchAt === 0 ? 'first after process start' : `after ${Math.round((now - lastBatchAt) / 1000)}s silence`}: ${data.locations.length} fixes, kept ${kept}`);
    lastBatchAt = now;
    await afterFixes(routeId, mode, data.locations, true);
  } catch (e) {
    logEvent('gps-task-error', e instanceof Error ? e.message : String(e));
  }
});

// ---------- start / stop ----------

export type TrackingMode = 'background' | 'foreground' | 'denied';

export async function startTracking(routeId: string): Promise<TrackingMode> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  setActiveTrackingRouteId(routeId);
  const mode = modeOf(routeId);

  // Grab a fix right away so the route has its starting point even before moving.
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    .then((loc) => recordFixes(routeId, [loc], mode))
    .catch(() => undefined);

  // "Always" lets iOS relaunch the app to keep recording if it gets closed; ask, but don't depend on it.
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted' && bg.canAskAgain) Location.requestBackgroundPermissionsAsync().catch(() => undefined);

  // The background task only needs "While using the app" when it is started with the app open: iOS keeps
  // it running in the background (blue location pill), Android as a foreground service. Only Expo Go, or a
  // failure to start, falls back to recording while the app is on screen.
  if (await Location.isBackgroundLocationAvailableAsync()) {
    try {
      await Location.startLocationUpdatesAsync(TRACKING_TASK, taskOptions(mode, 'moving'));
      setTrackingMode('background');
      return 'background';
    } catch {
      // fall through
    }
  }

  await startForegroundWatch(routeId, mode);
  setTrackingMode('foreground');
  return 'foreground';
}

async function startForegroundWatch(routeId: string, mode: Mode) {
  foregroundSub?.remove();
  const { accuracy, distanceInterval, timeInterval } = movingOptions(mode);
  foregroundSub = await Location.watchPositionAsync({ accuracy, distanceInterval, timeInterval }, (loc) => {
    if (getActiveTrackingRouteId() !== routeId) return;
    recordFixes(routeId, [loc], mode);
    afterFixes(routeId, mode, [loc], false).catch(() => undefined);
  });
}

export async function stopTracking() {
  logEvent('tracking', 'stop');
  setActiveTrackingRouteId(null);
  foregroundSub?.remove();
  foregroundSub = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  } catch {
    // Task was never registered on this device (e.g. permission never granted).
  }
}

/** On launch: keep recording for a route that was left in progress (app killed, phone restarted). */
export async function resumeTrackingIfNeeded(): Promise<TrackingMode | null> {
  const routeId = getActiveTrackingRouteId();
  if (!routeId) return null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) {
      setTrackingMode('background');
      return 'background';
    }
  } catch {
    // fall through
  }
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  return startTracking(routeId);
}
