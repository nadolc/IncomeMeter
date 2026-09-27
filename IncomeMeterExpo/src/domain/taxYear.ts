/** Start year of the UK tax year (6 Apr – 5 Apr) containing `date`. Mirrors TaxYearReportService.TaxYearFor. */
export function taxYearFor(date: Date): number {
  const startThisYear = Date.UTC(date.getUTCFullYear(), 3, 6);
  return date.getTime() >= startThisYear ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

export function taxYearRange(taxYear: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(taxYear, 3, 6, 0, 0, 0, 0)),
    to: new Date(Date.UTC(taxYear + 1, 3, 5, 23, 59, 59, 999)),
  };
}

export const taxYearLabel = (taxYear: number) => `${taxYear}/${String((taxYear + 1) % 100).padStart(2, '0')}`;

/** Current tax year plus the four before it, newest first (the web's year picker). */
export function recentTaxYears(now = new Date(), count = 5): number[] {
  const current = taxYearFor(now);
  return Array.from({ length: count }, (_, i) => current - i);
}
