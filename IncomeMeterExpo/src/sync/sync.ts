import { Collection, notify } from '../db/database';
import {
  applyRemote, changeId, getAll, getById, getDirty, getDirtyLocations, getSettings, insertLocations, markClean, markLocationsClean,
  removeMissing, save, saveSettings,
} from '../db/repo';
import { Attachment } from '../domain/types';
import { api, isSignedIn, RemoteLocation, toLocalPoint, uploadAttachment } from './api';

const SYNCED: Exclude<Collection, 'attachments'>[] = ['vehicles', 'workTypes', 'routes', 'expenses', 'odometerReadings'];

export interface SyncResult {
  pushed: number;
  pulled: number;
  removed: number;
  photos: number;
  locations: number;
}

interface SyncResponse {
  serverTime: string;
  accepted: Record<string, string[]>;
  rejected: Record<string, string[]>;
  acceptedLocations: string[];
  changes: Record<string, any[]>;
  ids: Record<string, string[]>;
  /** Stops added on the server since the last sync (e.g. by the iOS shortcut). */
  locations?: RemoteLocation[];
}

let running: Promise<SyncResult> | null = null;
let applyingRemote = false;

/** True while server data is being written locally – those changes shouldn't trigger another sync. */
export const isApplyingRemote = () => applyingRemote;

/** One sync at a time; callers share the in-flight run. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = runSync().finally(() => { running = null; });
  return running;
}

/** Upload photos taken on the device. The server may return an existing id for the same bytes, so re-key. */
export async function uploadPendingAttachments(): Promise<number> {
  let n = 0;
  for (const a of getAll('attachments').filter((x) => !x.uploaded && x.localUri)) {
    const r = await uploadAttachment(a.localUri!, a.fileName, a.contentType);
    const serverId = r.attachmentId!;
    if (serverId !== a.id) {
      changeId('attachments', a.id, serverId);
      rewriteAttachmentRefs(a.id, serverId);
    }
    const updated: Attachment = { ...getById('attachments', serverId)!, uploaded: true, ocr: r.ocr ?? a.ocr, takenAt: r.takenAt ?? a.takenAt };
    save('attachments', updated);
    markClean('attachments', [serverId]);
    n++;
  }
  return n;
}

/**
 * Upload one photo straight away and return what the server's OCR read from it (merchant, total,
 * litres, odometer…). Returns the attachment's id, which may have changed if the server already had the photo.
 */
export async function readAttachmentNow(id: string): Promise<{ id: string; ocr: Attachment['ocr'] }> {
  const a = getById('attachments', id);
  if (!a?.localUri) throw new Error('Photo not found');
  if (a.uploaded) return { id, ocr: a.ocr };
  const r = await uploadAttachment(a.localUri, a.fileName, a.contentType);
  const serverId = r.attachmentId!;
  if (serverId !== id) {
    changeId('attachments', id, serverId);
    rewriteAttachmentRefs(id, serverId);
  }
  save('attachments', { ...getById('attachments', serverId)!, uploaded: true, ocr: r.ocr, takenAt: r.takenAt ?? a.takenAt });
  markClean('attachments', [serverId]);
  return { id: serverId, ocr: r.ocr };
}

function rewriteAttachmentRefs(oldId: string, newId: string) {
  for (const e of getAll('expenses'))
    if (e.attachmentIds.includes(oldId)) save('expenses', { ...e, attachmentIds: e.attachmentIds.map((x) => (x === oldId ? newId : x)) });
  for (const o of getAll('odometerReadings'))
    if (o.photoAttachmentId === oldId) save('odometerReadings', { ...o, photoAttachmentId: newId });
}

async function runSync(): Promise<SyncResult> {
  if (!(await isSignedIn())) throw new Error('Not signed in');
  const settings = getSettings();
  const photos = await uploadPendingAttachments();

  const changes: Record<string, unknown[]> = {};
  const deletions: Record<string, string[]> = {};
  const sent = new Map<string, Map<string, string>>();
  for (const c of SYNCED) {
    const dirty = getDirty(c);
    sent.set(c, new Map(dirty.map((d) => [d.id, d.updatedAt])));
    changes[c] = dirty.filter((d) => !d.deleted).map((d) => d.doc);
    deletions[c] = dirty.filter((d) => d.deleted).map((d) => d.id);
  }
  // Routes are upserted before locations in the same request, so points of a new route are safe to send.
  const locations = getDirtyLocations(2000);

  const res = await api<SyncResponse>('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ since: settings.lastSyncAt, changes, deletions, locations }),
  });

  // Everything below is synchronous, so no user edit can interleave; its change notifications
  // must not schedule another auto-sync.
  applyingRemote = true;
  try {
    return applyResponse(res, sent, photos);
  } finally {
    applyingRemote = false;
  }
}

function applyResponse(res: SyncResponse, sent: Map<string, Map<string, string>>, photos: number): SyncResult {
  let pushed = 0;
  for (const c of SYNCED) {
    const done = [...(res.accepted[c] ?? []), ...(res.rejected[c] ?? [])];
    markClean(c, done, sent.get(c));
    pushed += res.accepted[c]?.length ?? 0;
  }
  markLocationsClean(res.acceptedLocations ?? []);
  // Already clean: they came from the server.
  insertLocations((res.locations ?? []).map(toLocalPoint), false);

  let pulled = 0;
  for (const c of SYNCED) for (const doc of res.changes[c] ?? []) if (applyRemote(c, doc)) pulled++;
  for (const a of res.changes.attachments ?? []) {
    const local = getById('attachments', a.id);
    applyRemote('attachments', {
      id: a.id, fileName: a.fileName, contentType: a.contentType, sizeBytes: a.sizeBytes, takenAt: a.takenAt, ocr: a.ocr,
      localUri: local?.localUri ?? null, uploaded: true, createdAt: a.uploadedAt, updatedAt: a.uploadedAt,
    } as Attachment & { updatedAt: string });
  }

  let removed = 0;
  for (const c of SYNCED) {
    if (!res.ids[c]) continue;
    if (c === 'workTypes' && res.ids[c].length === 0) {
      // The account has no work types yet: keep the app's defaults and upload them on the next sync.
      getAll('workTypes').forEach((w) => save('workTypes', w));
      continue;
    }
    removed += removeMissing(c, new Set(res.ids[c]));
  }

  saveSettings({ lastSyncAt: res.serverTime });
  SYNCED.forEach(notify);
  notify('attachments');
  return { pushed, pulled, removed, photos, locations: res.acceptedLocations?.length ?? 0 };
}

/** Best-effort background sync (after edits / on launch). Silent when offline or signed out. */
export async function syncQuietly() {
  if (!getSettings().syncEnabled) return;
  try {
    await syncNow();
  } catch {
    // Offline or server unavailable – the data is safe locally and goes up next time.
  }
}
