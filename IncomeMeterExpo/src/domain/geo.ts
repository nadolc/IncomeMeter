export const KM_TO_MI = 0.621371;

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface Fix {
  latitude: number;
  longitude: number;
  timestamp: number; // ms
  accuracy: number | null; // metres
}

/** Tuning for turning raw GPS fixes into driven distance. */
export const TRACKING = {
  /** Fixes worse than this are dropped – urban-canyon / indoor fixes jump around by 50–500 m. */
  maxAccuracyM: 50,
  /** Ignore movement smaller than this (or than the combined accuracy) so parked jitter doesn't add miles. */
  minStepM: 15,
  /** Anything implying more than ~200 km/h between two fixes is a GPS glitch. */
  maxSpeedMps: 55,
  /** Straight-line GPS undercounts real road distance a little (corners between fixes); used for the odometer suggestion only. */
  roadFactor: 1.0,
};

/**
 * Decide whether `next` should be recorded after `prev`, and the step distance in km.
 * Returns null when the fix is noise (poor accuracy, jitter, teleport).
 */
export function acceptFix(prev: Fix | null, next: Fix): { stepKm: number } | null {
  if (next.accuracy != null && next.accuracy > TRACKING.maxAccuracyM) return null;
  if (!prev) return { stepKm: 0 };
  const km = haversineKm(prev.latitude, prev.longitude, next.latitude, next.longitude);
  const metres = km * 1000;
  const noise = Math.max(TRACKING.minStepM, ((prev.accuracy ?? 0) + (next.accuracy ?? 0)) / 2);
  if (metres < noise) return null;
  const seconds = (next.timestamp - prev.timestamp) / 1000;
  if (seconds > 0 && metres / seconds > TRACKING.maxSpeedMps) return null;
  return { stepKm: km };
}

/** Total distance of an ordered path in km (points already filtered when they were recorded). */
export function pathKm(points: { latitude: number; longitude: number }[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    km += haversineKm(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
  }
  return km;
}

export const kmToUnit = (km: number, unit: 'mi' | 'km') => (unit === 'mi' ? km * KM_TO_MI : km);
