import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

/**
 * Offline-first store. Every synced entity lives as a JSON document in `docs`, keyed by
 * (collection, id). `dirty` marks local changes not yet pushed; `deleted` is a tombstone kept
 * until the deletion reaches the server. GPS points live in their own table because a single
 * route can hold thousands of them.
 */
export type Collection = 'routes' | 'vehicles' | 'expenses' | 'odometerReadings' | 'workTypes' | 'attachments';

let db: SQLite.SQLiteDatabase | null = null;

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS docs (
     collection TEXT NOT NULL,
     id TEXT NOT NULL,
     data TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     dirty INTEGER NOT NULL DEFAULT 1,
     deleted INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (collection, id)
   );
   CREATE INDEX IF NOT EXISTS ix_docs_dirty ON docs (dirty) WHERE dirty = 1;
   CREATE TABLE IF NOT EXISTS locations (
     id TEXT PRIMARY KEY NOT NULL,
     route_id TEXT NOT NULL,
     latitude REAL NOT NULL,
     longitude REAL NOT NULL,
     timestamp TEXT NOT NULL,
     accuracy REAL,
     speed REAL,
     address TEXT,
     distance_km REAL,
     distance_mi REAL,
     dirty INTEGER NOT NULL DEFAULT 1
   );
   CREATE INDEX IF NOT EXISTS ix_locations_route ON locations (route_id, timestamp);
   CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
];

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('incomemeter.db');
    db.execSync('PRAGMA journal_mode = WAL;');
    const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version ?? 0;
    for (let i = version; i < MIGRATIONS.length; i++) {
      db.withTransactionSync(() => {
        db!.execSync(MIGRATIONS[i]);
        db!.execSync(`PRAGMA user_version = ${i + 1}`);
      });
    }
  }
  return db;
}

// ---------- change notifications (drive screen refreshes) ----------

type Listener = (collection: Collection | 'locations' | 'kv') => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(collection: Collection | 'locations' | 'kv') {
  listeners.forEach((l) => l(collection));
}

// ---------- ids ----------

/** 24-hex id in MongoDB ObjectId layout, so records keep the same id on the server after sync. */
export function newId(): string {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const rand = Array.from(Crypto.getRandomBytes(8), (b) => b.toString(16).padStart(2, '0')).join('');
  return ts + rand;
}

export const nowIso = () => new Date().toISOString();
