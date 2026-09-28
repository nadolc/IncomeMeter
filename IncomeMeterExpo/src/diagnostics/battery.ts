import * as Battery from 'expo-battery';
import { getDb } from '../db/database';
import { logEvent } from './log';

/**
 * Battery use per route, in the diagnostics log: level at the start, every 15 minutes, and "%/h" at the end
 * (only meaningful while unplugged – a phone charging in the car is marked as such).
 */
const KEY = 'battery.route';
const EVERY_MS = 15 * 60_000;

interface Mark { level: number; at: number; charging: boolean }
interface RouteBattery { start: Mark; last: Mark }

async function read(): Promise<Mark | null> {
  try {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    if (level < 0) return null;
    const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
    return { level: Math.round(level * 100), at: Date.now(), charging };
  } catch {
    return null;
  }
}

const load = (): RouteBattery | null => {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', KEY);
  return row ? JSON.parse(row.value) : null;
};
const store = (v: RouteBattery | null) => {
  if (v) getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', KEY, JSON.stringify(v));
  else getDb().runSync('DELETE FROM kv WHERE key = ?', KEY);
};

const describe = (m: Mark) => `${m.level}%${m.charging ? ' charging' : ''}`;

export async function batteryRouteStart() {
  const m = await read();
  if (!m) return;
  store({ start: m, last: m });
  logEvent('battery', `start ${describe(m)}`);
}

/** Called from the GPS task; logs at most every 15 minutes. */
export async function batteryTick() {
  const v = load();
  if (!v || Date.now() - v.last.at < EVERY_MS) return;
  const m = await read();
  if (!m) return;
  logEvent('battery', `${describe(m)} (${m.level - v.last.level >= 0 ? '+' : ''}${m.level - v.last.level}% in ${Math.round((m.at - v.last.at) / 60_000)} min)`);
  store({ ...v, last: m });
}

export async function batteryRouteEnd() {
  const v = load();
  store(null);
  const m = await read();
  if (!v || !m) return;
  const hours = (m.at - v.start.at) / 3_600_000;
  const used = v.start.level - m.level;
  const plugged = v.start.charging || m.charging;
  logEvent('battery', `end ${describe(m)}: ${used}% over ${Math.round(hours * 60)} min` +
    (hours > 0.1 && !plugged ? ` = ${(used / hours).toFixed(1)}%/h` : plugged ? ' (charging – no rate)' : ''));
}
