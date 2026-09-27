import { Directory, File, Paths } from 'expo-file-system';
import { getCalendars, getLocales } from 'expo-localization';
import { getDb, newId, notify, nowIso } from '../db/database';
import { applyRemote, getAll, getById, save, saveSettings } from '../db/repo';
import { pickVehicleForDate } from '../domain/vehicleAssignment';
import { Attachment, IncomeSourceTemplate, Region, Settings, Vehicle, WorkType } from '../domain/types';

// ---------- work types ----------

const tpl = (name: string, displayOrder: number, isRequired = false): IncomeSourceTemplate =>
  ({ name, category: null, defaultAmount: null, isRequired, description: null, displayOrder });

/** Same defaults the API assigns to new users (DefaultWorkTypeService). */
const DEFAULT_WORK_TYPES: { name: string; sources: IncomeSourceTemplate[] }[] = [
  { name: 'Delivery', sources: ['UberEats', 'Deliveroo', 'Keeta', 'Foodpanda', 'JustEat', 'Tips', 'Bonuses'].map((n, i) => tpl(n, i)) },
  { name: 'Taxi', sources: [tpl('Fare', 0, true), tpl('Tips', 1), tpl('Airport', 2), tpl('LateNight', 3)] },
  { name: 'Rideshare', sources: ['Uber', 'Lyft', 'Bolt', 'Tips', 'Surge'].map((n, i) => tpl(n, i)) },
];

/** Hong Kong food delivery on foot / by bicycle. */
const HK_WORK_TYPE = {
  name: '外賣',
  sources: [tpl('Keeta', 0), tpl('foodpanda', 1), tpl('貼士', 2), tpl('惡劣天氣加成', 3), tpl('獎勵', 4)],
};

/**
 * Settings that suit each region. HK: tax year 1 April, HKD, km, walking. Language is left alone –
 * a Cantonese speaker working in the UK keeps 繁體中文.
 */
export const REGION_DEFAULTS: Record<Region, Partial<Settings>> = {
  UK: { region: 'UK', currencyCode: 'GBP', mileageUnit: 'mi', fiscalYearStart: '04-06', timeZone: 'Europe/London', defaultTravelMode: 'car' },
  HK: { region: 'HK', currencyCode: 'HKD', mileageUnit: 'km', fiscalYearStart: '04-01', timeZone: 'Asia/Hong_Kong', defaultTravelMode: 'walk' },
};

/** Switch region: apply its defaults and make sure the HK delivery work type exists. */
export function applyRegion(region: Region) {
  saveSettings(REGION_DEFAULTS[region]);
  if (region === 'HK' && !getAll('workTypes').some((w) => w.name === HK_WORK_TYPE.name)) {
    const now = nowIso();
    save('workTypes', {
      id: newId(), name: HK_WORK_TYPE.name, description: 'Keeta / foodpanda', incomeSourceTemplates: HK_WORK_TYPE.sources,
      isActive: true, createdAt: now, updatedAt: now,
    });
  }
}

/**
 * First launch: add the default work types. They are stored as "clean" (not pending upload), so the first
 * sync with an account that already has its own work types simply replaces them instead of duplicating.
 */
export function seedDefaults() {
  const seeded = getDb().getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = 'seeded'");
  if (seeded) return;
  const now = nowIso();
  // A phone in Hong Kong starts with the HK setup (HKD, km, 外賣 with Keeta / foodpanda). Judged by the
  // time zone, not the region setting: a Hong Kong-region iPhone used in the UK is on London time.
  const hk = getCalendars()[0]?.timeZone === 'Asia/Hong_Kong';
  saveSettings({
    ...(hk ? REGION_DEFAULTS.HK : {}),
    // The app's language follows the phone: any Chinese → 繁體中文, otherwise English.
    language: getLocales()[0]?.languageCode === 'zh' ? 'zh-HK' : 'en-GB',
  });
  for (const wt of hk ? [HK_WORK_TYPE] : DEFAULT_WORK_TYPES) {
    applyRemote('workTypes', {
      id: newId(), name: wt.name, description: null, incomeSourceTemplates: wt.sources, isActive: true, createdAt: now, updatedAt: now,
    } as WorkType);
  }
  getDb().runSync("INSERT OR REPLACE INTO kv (key, value) VALUES ('seeded', '1')");
  notify('workTypes');
}

export function activeWorkTypes(): WorkType[] {
  return getAll('workTypes').filter((w) => w.isActive).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- vehicles ----------

/** "Assign by date": give every record without a vehicle the vehicle that was in use on its date. */
export function assignByDate(onlyUnassigned = true): { routes: number; expenses: number; odometerReadings: number } {
  const vehicles = getAll('vehicles');
  const result = { routes: 0, expenses: 0, odometerReadings: 0 };
  for (const r of getAll('routes')) {
    if (onlyUnassigned && r.vehicleId) continue;
    const v = pickVehicleForDate(vehicles, r.scheduleStart);
    if (v && v !== r.vehicleId) { save('routes', { ...r, vehicleId: v }); result.routes++; }
  }
  for (const e of getAll('expenses')) {
    if (onlyUnassigned && e.vehicleId) continue;
    const v = pickVehicleForDate(vehicles, e.date);
    if (v && v !== e.vehicleId) { save('expenses', { ...e, vehicleId: v }); result.expenses++; }
  }
  for (const o of getAll('odometerReadings')) {
    if (onlyUnassigned && o.vehicleId) continue;
    const v = pickVehicleForDate(vehicles, o.date);
    if (v && v !== o.vehicleId) { save('odometerReadings', { ...o, vehicleId: v }); result.odometerReadings++; }
  }
  return result;
}

export function vehicleLabel(v: Vehicle | null | undefined): string {
  if (!v) return '—';
  const desc = [v.make, v.model].filter(Boolean).join(' ');
  return desc ? `${v.registration} · ${desc}` : v.registration;
}

export function newVehicle(): Vehicle {
  const now = nowIso();
  return {
    id: newId(), registration: '', make: null, model: null, vehicleType: 'car', fuelType: null, co2GPerKm: null,
    purchaseDate: null, disposalDate: null, disposalProceeds: null, purchasePrice: null, isNew: false, financeType: 'cash',
    claimMethod: 'actualCost', claimMethodLockedFromTaxYear: null, capitalAllowancePoolBroughtForward: null,
    poolBroughtForwardTaxYear: null, isActive: true, notes: null, createdAt: now, updatedAt: now,
  };
}

export function defaultVehicleId(dateIso: string): string | null {
  return pickVehicleForDate(getAll('vehicles'), dateIso);
}

// ---------- attachments (receipt / dashboard photos kept on the device) ----------

function attachmentsDir(): Directory {
  const dir = new Directory(Paths.document, 'attachments');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Copy a picked photo into app storage and register it. */
export async function addAttachment(uri: string, fileName: string | null | undefined, contentType: string | null | undefined, takenAt?: string | null): Promise<Attachment> {
  const id = newId();
  const ext = (fileName?.match(/\.[a-z0-9]{1,5}$/i)?.[0] ?? '.jpg').toLowerCase();
  const target = new File(attachmentsDir(), `${id}${ext}`);
  await new File(uri).copy(target);
  const attachment: Attachment = {
    id,
    fileName: fileName || `${id}${ext}`,
    contentType: contentType || 'image/jpeg',
    sizeBytes: target.size ?? 0,
    localUri: target.uri,
    uploaded: false,
    takenAt: takenAt ?? null,
    ocr: null,
    createdAt: nowIso(),
  };
  return save('attachments', attachment);
}

export function attachmentUri(id: string | null | undefined): string | null {
  return getById('attachments', id)?.localUri ?? null;
}
