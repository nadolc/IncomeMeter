import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getDb, newId, notify } from '../db/database';
import { getLastLocation, getLocations, insertLocations } from '../db/repo';
import { acceptFix, Fix, KM_TO_MI, pathKm } from '../domain/geo';
import { LocationKind, LocationPoint } from '../domain/types';

/**
 * Records where the car goes while a route is in progress, so the end odometer can be suggested
 * from the distance actually driven instead of the gap between two points.
 *
 * Uses a background location task (foreground-service notification on Android) when the user grants
 * "Allow all the time"; otherwise falls back to watching position while the app is open.
 */
export const TRACKING_TASK = 'incomemeter-route-tracking';
const ACTIVE_KEY = 'tracking.activeRouteId';

let foregroundSub: Location.LocationSubscription | null = null;

// ---------- active route (persisted so the background task and restarts know where to write) ----------

export function getActiveTrackingRouteId(): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', ACTIVE_KEY);
  return row?.value || null;
}

function setActiveTrackingRouteId(routeId: string | null) {
  if (routeId) getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', ACTIVE_KEY, routeId);
  else getDb().runSync('DELETE FROM kv WHERE key = ?', ACTIVE_KEY);
  notify('kv');
}

// ---------- recording ----------

/** Filter raw fixes against the last stored point and save the ones that are real movement. */
export function recordFixes(routeId: string, locations: Location.LocationObject[]): number {
  const last = getLastLocation(routeId);
  let prev: Fix | null = last && {
    latitude: last.latitude, longitude: last.longitude, timestamp: new Date(last.timestamp).getTime(), accuracy: last.accuracy,
  };
  const points: LocationPoint[] = [];
  for (const loc of [...locations].sort((a, b) => a.timestamp - b.timestamp)) {
    if (prev && loc.timestamp <= prev.timestamp) continue;
    const fix: Fix = {
      latitude: loc.coords.latitude, longitude: loc.coords.longitude, timestamp: loc.timestamp, accuracy: loc.coords.accuracy ?? null,
    };
    const accepted = acceptFix(prev, fix);
    if (!accepted) continue;
    points.push({
      id: newId(),
      routeId,
      latitude: Math.round(fix.latitude * 1e6) / 1e6,
      longitude: Math.round(fix.longitude * 1e6) / 1e6,
      timestamp: new Date(fix.timestamp).toISOString(),
      accuracy: fix.accuracy,
      speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
      address: null,
      distanceFromLastKm: Math.round(accepted.stepKm * 1000) / 1000,
      distanceFromLastMi: Math.round(accepted.stepKm * KM_TO_MI * 1000) / 1000,
      kind: 'track',
    });
    prev = fix;
  }
  insertLocations(points);
  return points.length;
}

/**
 * Distance driven so far, in km: the sum of the recorded driving path. Routes with no path (GPS off or denied,
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

export function stopCount(routeId: string): number {
  return getDb().getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM locations WHERE route_id = ? AND kind = 'stop'", routeId)?.n ?? 0;
}

/** One-line address from the phone's geocoder, e.g. "12 High Street, Leeds". Best effort – null offline. */
async function addressFor(latitude: number, longitude: number): Promise<string | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!a) return null;
    const street = [a.streetNumber, a.street].filter(Boolean).join(' ') || a.name;
    return [street, a.city ?? a.subregion, a.postalCode].filter(Boolean).join(', ') || null;
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
  if (!position) {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') throw new Error('Location permission denied');
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .catch(() => Location.getLastKnownPositionAsync());
    if (!loc) throw new Error('Current location unavailable');
    position = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    accuracy = loc.coords.accuracy ?? null;
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
    address: await addressFor(position.latitude, position.longitude),
    // Stops don't add distance – the driving path already covers it.
    distanceFromLastKm: null,
    distanceFromLastMi: null,
  };
  insertLocations([point]);
  return point;
}

// Must be defined at module load (imported from the app entry) so the OS can wake it in the background.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACKING_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const routeId = getActiveTrackingRouteId();
  if (routeId) recordFixes(routeId, data.locations);
});

// ---------- start / stop ----------

export type TrackingMode = 'background' | 'foreground' | 'denied';

const LOCATION_OPTIONS = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 20,
  timeInterval: 5000,
};

export async function startTracking(routeId: string): Promise<TrackingMode> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  setActiveTrackingRouteId(routeId);

  // Grab a fix right away so the route has its starting point even if the car hasn't moved yet.
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    .then((loc) => recordFixes(routeId, [loc]))
    .catch(() => undefined);

  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted' && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();

  if (bg.status === 'granted' && (await Location.isBackgroundLocationAvailableAsync())) {
    await Location.startLocationUpdatesAsync(TRACKING_TASK, {
      ...LOCATION_OPTIONS,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'IncomeMeter – route in progress',
        notificationBody: 'Recording the distance you drive.',
        killServiceOnDestroy: false,
      },
    });
    return 'background';
  }

  await startForegroundWatch(routeId);
  return 'foreground';
}

async function startForegroundWatch(routeId: string) {
  foregroundSub?.remove();
  foregroundSub = await Location.watchPositionAsync(LOCATION_OPTIONS, (loc) => {
    if (getActiveTrackingRouteId() === routeId) recordFixes(routeId, [loc]);
  });
}

export async function stopTracking() {
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
    if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) return 'background';
  } catch {
    // fall through
  }
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  return startTracking(routeId);
}
