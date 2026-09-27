import { getSettings } from '../db/repo';

export function money(amount: number | null | undefined, currency?: string, locale?: string): string {
  const s = getSettings();
  try {
    return new Intl.NumberFormat(locale ?? s.language, {
      style: 'currency', currency: currency ?? s.currencyCode, minimumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `${currency ?? s.currencyCode} ${(amount ?? 0).toFixed(2)}`;
  }
}

export const num = (v: number | null | undefined, digits = 1) =>
  v == null ? '—' : v.toLocaleString(getSettings().language, { maximumFractionDigits: digits });

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(getSettings().language, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function time(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(getSettings().language, { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(iso: string | null | undefined): string {
  return iso ? `${date(iso)} ${time(iso)}` : '—';
}

/** "2h 30m" (utils/time.ts formatHours). */
export function hours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

export function duration(fromIso: string | null, toIso: string | null = null): string {
  if (!fromIso) return '—';
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  return hours(Math.max(0, ms) / 3_600_000);
}

/** Parse a user-typed number; empty → null. */
export function parseNum(s: string): number | null {
  const v = parseFloat(s.replace(/,/g, '').trim());
  return Number.isFinite(v) ? v : null;
}

export const numText = (v: number | null | undefined) => (v == null ? '' : String(v));

/** yyyy-mm-dd of a Date in local time. */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
