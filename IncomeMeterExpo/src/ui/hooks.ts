import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { Collection, subscribe } from '../db/database';
import { DocTypes, getAll, getSettings } from '../db/repo';
import { Settings } from '../domain/types';

type Source = Collection | 'locations' | 'kv';

/** GPS points arrive every few seconds while driving: redraw screens for them at most this often. */
const LOCATION_REDRAW_MS = 3000;

/**
 * Re-run `read` (a synchronous SQLite query) whenever one of `sources` changes or `deps` change.
 *
 * Nothing redraws while the app is in the background: a route screen re-reading every GPS point and
 * redrawing its map in the background uses enough CPU for iOS to close the app mid-route. The screen
 * catches up once when the app comes back.
 */
export function useLive<T>(read: () => T, sources: Source[], deps: unknown[] = []): T {
  const [version, setVersion] = useState(0);
  const key = sources.join(',');
  useEffect(() => {
    const wanted = key.split(',');
    let stale = false;
    let lastBump = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      lastBump = Date.now();
      setVersion((v) => v + 1);
    };
    const unsubscribe = subscribe((c) => {
      if (!wanted.includes(c)) return;
      if (AppState.currentState !== 'active') {
        stale = true;
        return;
      }
      if (c !== 'locations' || Date.now() - lastBump >= LOCATION_REDRAW_MS) bump();
      else if (!timer) timer = setTimeout(() => { timer = undefined; bump(); }, LOCATION_REDRAW_MS - (Date.now() - lastBump));
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active' && stale) {
        stale = false;
        bump();
      }
    });
    return () => {
      unsubscribe();
      appState.remove();
      clearTimeout(timer);
    };
  }, [key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [version, key, ...deps]);
}

export function useCollection<C extends Collection>(collection: C): DocTypes[C][] {
  return useLive(() => getAll(collection), [collection]);
}

export function useSettings(): Settings {
  return useLive(getSettings, ['kv']);
}
