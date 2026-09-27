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

export type Mode = 'car' | 'motorcycle' | 'bicycle' | 'walk';

export interface ModeProfile {
  /** Fixes worse than this are dropped – urban-canyon / indoor fixes jump around by 50–500 m. */
  maxAccuracyM: number;
  /** Ignore movement smaller than this (or than the combined accuracy) so standing-still jitter adds nothing. */
  minStepM: number;
  /** Faster than this between two nearby-in-time fixes is a GPS glitch. */
  maxSpeedMps: number;
  /** Save battery while standing still (switch to low-power location between moves). */
  adaptivePower: boolean;
  /** Mark a stop automatically after standing still this long (0 = never). */
  autoStopAfterS: number;
}

/** Tuning per travel mode. */
export const PROFILES: Record<Mode, ModeProfile> = {
  // Walking up to a jog; MTR / bus / minibus between fixes is faster than this and isn't counted as walking.
  walk: { maxAccuracyM: 40, minStepM: 12, maxSpeedMps: 4, adaptivePower: true, autoStopAfterS: 120 },
  // Bicycle and e-bike (HK e-bikes are limited to ~25 km/h).
  bicycle: { maxAccuracyM: 40, minStepM: 15, maxSpeedMps: 13, adaptivePower: true, autoStopAfterS: 120 },
  motorcycle: { maxAccuracyM: 50, minStepM: 15, maxSpeedMps: 55, adaptivePower: true, autoStopAfterS: 0 },
  // The car is usually on a charger (CarPlay); keep full accuracy and never pause.
  car: { maxAccuracyM: 50, minStepM: 15, maxSpeedMps: 55, adaptivePower: false, autoStopAfterS: 0 },
};

/** Kept for callers that don't know the mode. */
export const TRACKING = PROFILES.car;

/** Fixes further apart in time than this are a gap (tunnel, MTR, phone pocketed indoors, low-power mode). */
export const GAP_S = 120;

/**
 * Decide whether `next` should be recorded after `prev`, and the step distance in km.
 * Returns null when the fix is noise (poor accuracy, jitter, glitch).
 *
 * After a gap the fix is always accepted (so tracking re-anchors), but the distance only counts when the
 * implied speed is plausible for the mode – a walker coming out of the MTR two stations later hasn't walked it.
 */
export function acceptFix(prev: Fix | null, next: Fix, mode: Mode = 'car'): { stepKm: number } | null {
  const p = PROFILES[mode];
  if (next.accuracy != null && next.accuracy > p.maxAccuracyM) return null;
  if (!prev) return { stepKm: 0 };
  const km = haversineKm(prev.latitude, prev.longitude, next.latitude, next.longitude);
  const metres = km * 1000;
  const noise = Math.max(p.minStepM, ((prev.accuracy ?? 0) + (next.accuracy ?? 0)) / 2);
  if (metres < noise) return null;
  const seconds = (next.timestamp - prev.timestamp) / 1000;
  const speed = seconds > 0 ? metres / seconds : Infinity;
  if (seconds > GAP_S) return { stepKm: speed <= p.maxSpeedMps ? km : 0 };
  if (speed > p.maxSpeedMps) return null;
  return { stepKm: km };
}

/**
 * Minutes spent moving: consecutive driving points are only recorded after real movement, so time between
 * points that are less than GAP_S apart is moving time; longer gaps are waiting (or travel not counted).
 */
export function movingMinutes(points: { timestamp: string; distanceFromLastKm?: number | null }[]): number {
  let ms = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = new Date(points[i].timestamp).getTime() - new Date(points[i - 1].timestamp).getTime();
    if (dt > 0 && dt <= GAP_S * 1000 && (points[i].distanceFromLastKm ?? 0) > 0) ms += dt;
  }
  return ms / 60_000;
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
