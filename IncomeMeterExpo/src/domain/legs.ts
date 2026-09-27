import { haversineKm } from './geo';
import { LocationPoint } from './types';

export interface Leg {
  /** 1-based stop number this leg ends at; 0 = the stretch after the last stop (to the end of the route). */
  toStop: number;
  from: LocationPoint | null;
  to: LocationPoint;
  km: number;
  minutes: number;
  /** Where `km` came from: the recorded path, the server's figure (old shortcut stops), or a straight line. */
  source: 'path' | 'server' | 'straight';
  /** Coordinates to draw for this leg. */
  path: { latitude: number; longitude: number }[];
}

const ms = (p: LocationPoint) => new Date(p.timestamp).getTime();
const coord = (p: LocationPoint) => ({ latitude: p.latitude, longitude: p.longitude });

/**
 * Distance along `pts` starting at `start`. The first point's stored step runs from the GPS point before
 * `start`, so measure it from `start` instead – keeping the smaller value, so a step recorded as 0 (MTR gap) stays 0.
 */
function pathFrom(start: LocationPoint | null, pts: LocationPoint[]): number {
  return pts.reduce((s, p, i) => {
    const stored = p.distanceFromLastKm ?? 0;
    if (i > 0 || !start || start === p) return s + stored;
    return s + Math.min(stored, haversineKm(start.latitude, start.longitude, p.latitude, p.longitude));
  }, 0);
}

/**
 * Split a route into the stretches between stops: route start → stop 1 → stop 2 … → end of route.
 * Distance uses the recorded path when there is one; routes recorded only with the old iOS shortcut use the
 * distance the server stored for each stop, else a straight line (an underestimate).
 */
export function routeLegs(points: LocationPoint[]): Leg[] {
  const sorted = [...points].sort((a, b) => ms(a) - ms(b));
  const track = sorted.filter((p) => p.kind === 'track');
  const stops = sorted.filter((p) => p.kind === 'stop');
  const legs: Leg[] = [];

  let prev: LocationPoint | null = track[0] && (!stops[0] || ms(track[0]) < ms(stops[0])) ? track[0] : null;
  stops.forEach((stop, i) => {
    const start = prev ? ms(prev) : -Infinity;
    const inLeg = track.filter((p) => ms(p) > start && ms(p) <= ms(stop));
    let km: number;
    let source: Leg['source'];
    if (inLeg.length > 0) {
      km = pathFrom(prev, inLeg)
        + haversineKm(inLeg[inLeg.length - 1].latitude, inLeg[inLeg.length - 1].longitude, stop.latitude, stop.longitude);
      source = 'path';
    } else if (i > 0 && stop.distanceFromLastKm != null) {
      km = stop.distanceFromLastKm;
      source = 'server';
    } else {
      km = prev ? haversineKm(prev.latitude, prev.longitude, stop.latitude, stop.longitude) : 0;
      source = 'straight';
    }
    legs.push({
      toStop: i + 1,
      from: prev,
      to: stop,
      km,
      minutes: prev ? (ms(stop) - ms(prev)) / 60_000 : 0,
      source,
      path: [...(prev ? [coord(prev)] : []), ...inLeg.map(coord), coord(stop)],
    });
    prev = stop;
  });

  // After the last stop: the way back / to the end of the route.
  const last = stops[stops.length - 1];
  const after = last ? track.filter((p) => ms(p) > ms(last)) : [];
  if (last && after.length > 0) {
    const end = after[after.length - 1];
    legs.push({
      toStop: 0,
      from: last,
      to: end,
      km: pathFrom(last, after),
      minutes: (ms(end) - ms(last)) / 60_000,
      source: 'path',
      path: [coord(last), ...after.map(coord)],
    });
  }
  return legs;
}
