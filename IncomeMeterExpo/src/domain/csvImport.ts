// Same CSV format as the web's BulkRouteImport:
// workTypeName, scheduleDate (dd/MM/yyyy), fromTime / toTime (HHmm), startMile, endMile,
// incomeSources as JSON {"Uber": 25.5} or pipe format Uber:25.5|Tips:5
import { IncomeItem, WorkType } from './types';

export const CSV_TEMPLATE =
  'workTypeName,scheduleDate,fromTime,toTime,startMile,endMile,incomeSources\n' +
  'Delivery,15/01/2024,0900,1700,12000,12085,"{""UberEats"": 120.50, ""Tips"": 15.00}"\n' +
  'Delivery,16/01/2024,1800,2300,12085,12130,Deliveroo:45.00|Tips:8.00\n';

const REQUIRED = ['workTypeName', 'scheduleDate', 'fromTime', 'toTime', 'startMile', 'endMile', 'incomeSources'];

/** RFC 4180-ish: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export function parseIncomes(s: string): IncomeItem[] {
  const text = s.trim();
  if (!text) return [];
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && !Array.isArray(obj))
        return Object.entries(obj)
          .map(([source, amount]) => ({ source: source.trim(), amount: Number(amount) }))
          .filter((i) => i.source && Number.isFinite(i.amount) && i.amount >= 0);
    } catch {
      return [];
    }
  }
  return text.split('|').map((p) => p.trim()).filter(Boolean).flatMap((p) => {
    const idx = p.lastIndexOf(':');
    if (idx <= 0) return [];
    const amount = Number(p.slice(idx + 1).trim());
    return Number.isFinite(amount) && amount >= 0 ? [{ source: p.slice(0, idx).trim(), amount }] : [];
  });
}

function parseDateTime(date: string, hhmm: string): Date | null {
  const d = date.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const t = hhmm.trim().padStart(4, '0').match(/^(\d{2})(\d{2})$/);
  if (!d || !t) return null;
  const [day, month, year] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, m] = [Number(t[1]), Number(t[2])];
  if (h > 23 || m > 59) return null;
  const result = new Date(year, month - 1, day, h, m);
  return result.getMonth() === month - 1 ? result : null;
}

export interface ParsedRoute {
  line: number;
  workType: WorkType | null;
  workTypeName: string;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  startMile: number | null;
  endMile: number | null;
  incomes: IncomeItem[];
  errors: string[];
}

export function parseRoutesCsv(text: string, workTypes: WorkType[]): { rows: ParsedRoute[]; errors: string[] } {
  const table = parseCsv(text.replace(/^﻿/, ''));
  if (table.length < 2) return { rows: [], errors: ['No data found in CSV file'] };
  const header = table[0].map((h) => h.trim());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], errors: [`Missing required columns: ${missing.join(', ')}`] };
  const col = (r: string[], name: string) => (r[header.indexOf(name)] ?? '').trim();

  const rows = table.slice(1).map((r, i): ParsedRoute => {
    const errors: string[] = [];
    const workTypeName = col(r, 'workTypeName');
    const workType = workTypes.find((w) => w.isActive && w.name.toLowerCase() === workTypeName.toLowerCase()) ?? null;
    if (!workType) errors.push(`Unknown work type "${workTypeName}"`);

    let start = parseDateTime(col(r, 'scheduleDate'), col(r, 'fromTime'));
    let end = parseDateTime(col(r, 'scheduleDate'), col(r, 'toTime'));
    if (!start) errors.push(`Invalid schedule start: ${col(r, 'scheduleDate')} ${col(r, 'fromTime')} (expected dd/MM/yyyy HHmm)`);
    if (!end) errors.push(`Invalid schedule end: ${col(r, 'scheduleDate')} ${col(r, 'toTime')} (expected dd/MM/yyyy HHmm)`);
    // A shift past midnight (e.g. 1800–0200) ends the next day.
    if (start && end && end <= start) end = new Date(end.getTime() + 86_400_000);

    const startMile = col(r, 'startMile') === '' ? NaN : Number(col(r, 'startMile'));
    const endMile = col(r, 'endMile') === '' ? NaN : Number(col(r, 'endMile'));
    if (!Number.isFinite(startMile) || startMile < 0) errors.push('startMile must be a number ≥ 0');
    if (!Number.isFinite(endMile) || endMile <= startMile) errors.push('endMile must be greater than startMile');

    const incomes = parseIncomes(col(r, 'incomeSources'));
    if (incomes.length === 0) errors.push('No valid income sources found. Use {"Source": amount} or Source:amount|Source2:amount2');

    return {
      line: i + 2, workType, workTypeName,
      scheduleStart: start?.toISOString() ?? null, scheduleEnd: end?.toISOString() ?? null,
      startMile: Number.isFinite(startMile) ? startMile : null, endMile: Number.isFinite(endMile) ? endMile : null,
      incomes, errors,
    };
  });
  return { rows, errors: [] };
}
