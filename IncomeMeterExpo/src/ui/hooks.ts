import { useEffect, useMemo, useState } from 'react';
import { Collection, subscribe } from '../db/database';
import { DocTypes, getAll, getSettings } from '../db/repo';
import { Settings } from '../domain/types';

type Source = Collection | 'locations' | 'kv';

/** Re-run `read` (a synchronous SQLite query) whenever one of `sources` changes or `deps` change. */
export function useLive<T>(read: () => T, sources: Source[], deps: unknown[] = []): T {
  const [version, setVersion] = useState(0);
  const key = sources.join(',');
  useEffect(() => subscribe((c) => { if (key.split(',').includes(c)) setVersion((v) => v + 1); }), [key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [version, key, ...deps]);
}

export function useCollection<C extends Collection>(collection: C): DocTypes[C][] {
  return useLive(() => getAll(collection), [collection]);
}

export function useSettings(): Settings {
  return useLive(getSettings, ['kv']);
}
