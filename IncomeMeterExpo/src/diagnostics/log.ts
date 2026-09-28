import { AppState } from 'react-native';
import { getDb } from '../db/database';

/**
 * A small on-device log to explain gaps in a recorded route: when the app process started (a start with
 * the app not on screen = iOS relaunched it in the background), app state changes, GPS batches and errors.
 * Kept in the local database, last 300 entries; shared from Settings → Diagnostics.
 */
const KEY = 'diag.log';
const MAX = 300;

export interface DiagEntry { t: string; kind: string; detail?: string }

export function readLog(): DiagEntry[] {
  try {
    const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', KEY);
    return row ? JSON.parse(row.value) : [];
  } catch {
    return [];
  }
}

export function logEvent(kind: string, detail?: string) {
  try {
    const entries = readLog();
    entries.push({ t: new Date().toISOString(), kind, ...(detail ? { detail } : {}) });
    getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', KEY, JSON.stringify(entries.slice(-MAX)));
  } catch {
    // Logging must never break tracking.
  }
}

export function clearLog() {
  getDb().runSync('DELETE FROM kv WHERE key = ?', KEY);
}

export function logText(): string {
  return readLog().map((e) => `${e.t}  ${e.kind}${e.detail ? `  ${e.detail}` : ''}`).join('\n');
}

let started = false;

/** Call once at module load: records every process start and app state change. */
export function startDiagnostics() {
  if (started) return;
  started = true;
  logEvent('process-start', `appState=${AppState.currentState}`);
  AppState.addEventListener('change', (s) => logEvent('app-state', s));
}
