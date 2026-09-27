import {
  Attachment, DEFAULT_SETTINGS, Expense, LocationPoint, OdometerReading, Route, Settings, Vehicle, WorkType,
} from '../domain/types';
import { Collection, getDb, notify, nowIso } from './database';

export interface DocTypes {
  routes: Route;
  vehicles: Vehicle;
  expenses: Expense;
  odometerReadings: OdometerReading;
  workTypes: WorkType;
  attachments: Attachment;
}

type DocRow = { id: string; data: string; updated_at: string; dirty: number; deleted: number };

// ---------- documents ----------

export function getAll<C extends Collection>(collection: C): DocTypes[C][] {
  const rows = getDb().getAllSync<DocRow>(
    'SELECT data FROM docs WHERE collection = ? AND deleted = 0', collection);
  return rows.map((r) => JSON.parse(r.data));
}

export function getById<C extends Collection>(collection: C, id: string | null | undefined): DocTypes[C] | null {
  if (!id) return null;
  const row = getDb().getFirstSync<DocRow>(
    'SELECT data FROM docs WHERE collection = ? AND id = ? AND deleted = 0', collection, id);
  return row ? JSON.parse(row.data) : null;
}

/** Insert or replace a document from a local edit: stamps updatedAt and marks it for upload. */
export function save<C extends Collection>(collection: C, doc: DocTypes[C]): DocTypes[C] {
  const stamped = { ...doc } as DocTypes[C] & { updatedAt?: string };
  if ('updatedAt' in stamped) stamped.updatedAt = nowIso();
  const updatedAt = stamped.updatedAt ?? nowIso();
  getDb().runSync(
    `INSERT INTO docs (collection, id, data, updated_at, dirty, deleted) VALUES (?, ?, ?, ?, 1, 0)
     ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, dirty = 1, deleted = 0`,
    collection, doc.id, JSON.stringify(stamped), updatedAt);
  notify(collection);
  return stamped;
}

/** Delete locally and leave a tombstone so the deletion is pushed on the next sync. */
export function remove(collection: Collection, id: string) {
  getDb().runSync(
    'UPDATE docs SET deleted = 1, dirty = 1, updated_at = ? WHERE collection = ? AND id = ?', nowIso(), collection, id);
  if (collection === 'routes') deleteLocationsForRoute(id);
  notify(collection);
}

// ---------- sync helpers ----------

export interface DirtyDoc { id: string; deleted: boolean; updatedAt: string; doc: any }

export function getDirty(collection: Collection): DirtyDoc[] {
  return getDb()
    .getAllSync<DocRow>('SELECT id, data, updated_at, deleted FROM docs WHERE collection = ? AND dirty = 1', collection)
    .map((r) => ({ id: r.id, deleted: r.deleted === 1, updatedAt: r.updated_at, doc: JSON.parse(r.data) }));
}

/**
 * Mark records as uploaded. With `sentVersions`, a record edited again after it was sent (updated_at moved on)
 * stays dirty so the newer edit goes up next time.
 */
export function markClean(collection: Collection, ids: string[], sentVersions?: Map<string, string>) {
  const db = getDb();
  db.withTransactionSync(() => {
    for (const id of ids) {
      const version = sentVersions?.get(id);
      const guard = version ? ' AND updated_at = ?' : '';
      const args = version ? [collection, id, version] : [collection, id];
      db.runSync(`DELETE FROM docs WHERE collection = ? AND id = ? AND deleted = 1${guard}`, ...args);
      db.runSync(`UPDATE docs SET dirty = 0 WHERE collection = ? AND id = ?${guard}`, ...args);
    }
  });
}

/**
 * Apply a server copy. A pending local edit wins unless the server copy is newer (last write wins).
 * Returns true when the local copy changed.
 */
export function applyRemote(collection: Collection, doc: { id: string; updatedAt?: string }): boolean {
  const db = getDb();
  const local = db.getFirstSync<DocRow>('SELECT data, updated_at, dirty, deleted FROM docs WHERE collection = ? AND id = ?', collection, doc.id);
  const remoteUpdated = doc.updatedAt ?? nowIso();
  if (local?.dirty && Date.parse(local.updated_at) >= Date.parse(remoteUpdated)) return false;
  const merged = local && !local.deleted ? { ...JSON.parse(local.data), ...doc } : doc;
  db.runSync(
    `INSERT INTO docs (collection, id, data, updated_at, dirty, deleted) VALUES (?, ?, ?, ?, 0, 0)
     ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, dirty = 0, deleted = 0`,
    collection, doc.id, JSON.stringify(merged), remoteUpdated);
  return true;
}

/** Drop local copies the server no longer has (deleted on the web), except ones with unsent edits. */
export function removeMissing(collection: Collection, serverIds: Set<string>): number {
  const db = getDb();
  const rows = db.getAllSync<{ id: string }>('SELECT id FROM docs WHERE collection = ? AND dirty = 0', collection);
  let n = 0;
  for (const r of rows) {
    if (!serverIds.has(r.id)) {
      db.runSync('DELETE FROM docs WHERE collection = ? AND id = ?', collection, r.id);
      if (collection === 'routes') deleteLocationsForRoute(r.id);
      n++;
    }
  }
  return n;
}

/** Re-key a document (e.g. an attachment that the server de-duplicated to an existing id). */
export function changeId(collection: Collection, oldId: string, newId: string) {
  const db = getDb();
  const row = db.getFirstSync<DocRow>('SELECT data FROM docs WHERE collection = ? AND id = ?', collection, oldId);
  if (!row) return;
  const doc = { ...JSON.parse(row.data), id: newId };
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM docs WHERE collection = ? AND id = ?', collection, oldId);
    db.runSync(
      `INSERT OR REPLACE INTO docs (collection, id, data, updated_at, dirty, deleted) VALUES (?, ?, ?, ?, 0, 0)`,
      collection, newId, JSON.stringify(doc), nowIso());
  });
}

// ---------- locations ----------

type LocRow = {
  id: string; route_id: string; latitude: number; longitude: number; timestamp: string;
  accuracy: number | null; speed: number | null; address: string | null; distance_km: number | null; distance_mi: number | null;
};

const toPoint = (r: LocRow): LocationPoint => ({
  id: r.id, routeId: r.route_id, latitude: r.latitude, longitude: r.longitude, timestamp: r.timestamp,
  accuracy: r.accuracy, speed: r.speed, address: r.address, distanceFromLastKm: r.distance_km, distanceFromLastMi: r.distance_mi,
});

export function getLocations(routeId: string): LocationPoint[] {
  return getDb()
    .getAllSync<LocRow>('SELECT * FROM locations WHERE route_id = ? ORDER BY timestamp', routeId)
    .map(toPoint);
}

export function getLastLocation(routeId: string): LocationPoint | null {
  const r = getDb().getFirstSync<LocRow>('SELECT * FROM locations WHERE route_id = ? ORDER BY timestamp DESC LIMIT 1', routeId);
  return r ? toPoint(r) : null;
}

export function insertLocations(points: LocationPoint[], dirty = true) {
  if (points.length === 0) return;
  const db = getDb();
  db.withTransactionSync(() => {
    for (const p of points) {
      db.runSync(
        `INSERT OR IGNORE INTO locations (id, route_id, latitude, longitude, timestamp, accuracy, speed, address, distance_km, distance_mi, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.routeId, p.latitude, p.longitude, p.timestamp, p.accuracy, p.speed, p.address,
        p.distanceFromLastKm, p.distanceFromLastMi, dirty ? 1 : 0);
    }
  });
  notify('locations');
}

export function getDirtyLocations(limit = 500): LocationPoint[] {
  return getDb().getAllSync<LocRow>('SELECT * FROM locations WHERE dirty = 1 ORDER BY timestamp LIMIT ?', limit).map(toPoint);
}

export function markLocationsClean(ids: string[]) {
  const db = getDb();
  db.withTransactionSync(() => ids.forEach((id) => db.runSync('UPDATE locations SET dirty = 0 WHERE id = ?', id)));
}

export function deleteLocationsForRoute(routeId: string) {
  getDb().runSync('DELETE FROM locations WHERE route_id = ?', routeId);
  notify('locations');
}

// ---------- settings ----------

export function getSettings(): Settings {
  const row = getDb().getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = 'settings'");
  return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.value) : {}) };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  getDb().runSync("INSERT OR REPLACE INTO kv (key, value) VALUES ('settings', ?)", JSON.stringify(next));
  notify('kv');
  return next;
}
