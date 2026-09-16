import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getTaxYearReport, getVehicles, downloadTaxYearReportCsv, downloadTaxYearReceiptsZip } from '../../utils/api';
import type { TaxYearReport, Vehicle } from '../../types';
import ExpensesSubNav from '../Expenses/ExpensesSubNav';

const taxYearStartFor = (date: Date): number => {
  const y = date.getFullYear();
  return date >= new Date(y, 3, 6) ? y : y - 1;
};

const TaxReport: React.FC = () => {
  const { t } = useLanguage();

  const [taxYear, setTaxYear] = useState<number>(() => taxYearStartFor(new Date()));
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [overridePct, setOverridePct] = useState<string>('');
  const [report, setReport] = useState<TaxYearReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'csv' | 'zip' | null>(null);

  useEffect(() => {
    getVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pct = overridePct.trim() === '' ? undefined : Number(overridePct);
      setReport(await getTaxYearReport(taxYear, {
        vehicleId: vehicleId || undefined,
        businessUsePercent: pct !== undefined && !isNaN(pct) ? pct : undefined
      }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('taxReport.errors.load', 'Failed to build the report.'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [taxYear, vehicleId, overridePct, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (kind: 'csv' | 'zip') => {
    setDownloading(kind);
    try {
      if (kind === 'csv') {
        const pct = overridePct.trim() === '' ? undefined : Number(overridePct);
        await downloadTaxYearReportCsv(taxYear, { vehicleId: vehicleId || undefined, businessUsePercent: pct });
      } else {
        await downloadTaxYearReceiptsZip(taxYear, { vehicleId: vehicleId || undefined });
      }
    } catch (err) {
      console.error('Download failed', err);
      setError(t('taxReport.errors.download', 'Download failed.'));
    } finally {
      setDownloading(null);
    }
  };

  const taxYearOptions = useMemo(() => {
    const current = taxYearStartFor(new Date());
    return [current, current - 1, current - 2, current - 3, current - 4];
  }, []);

  const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  const miles = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString()} mi`);
  const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}%`);
  const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const label = (y: number) => `${y}/${String(y + 1).slice(-2)}`;
  const catLabel = (c: string) => t(`expenses.categories.${c}`, c);

  const severityClass = (s: string) =>
    s === 'error' ? 'bg-red-50 border-red-200 text-red-800'
      : s === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-blue-50 border-blue-200 text-blue-800';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <ExpensesSubNav />

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('taxReport.title', 'Tax year report')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('taxReport.subtitle', 'Actual-cost method figures for your Self Assessment, with the flat-rate equivalent for comparison.')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">{t('expenses.taxYear', 'Tax year')}</span>
            <select value={taxYear} onChange={e => setTaxYear(Number(e.target.value))} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
              {taxYearOptions.map(y => <option key={y} value={y}>{label(y)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">{t('taxReport.vehicle', 'Vehicle')}</span>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">{t('taxReport.defaultVehicle', 'Default (first active)')}</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration}{v.make ? ` · ${v.make}` : ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">{t('taxReport.overridePct', 'Business % override')}</span>
            <input type="number" min="0" max="100" step="0.1" placeholder="auto" value={overridePct} onChange={e => setOverridePct(e.target.value)} className="w-24 rounded border border-gray-300 px-3 py-1.5 text-sm" />
          </label>
          <button onClick={() => handleDownload('csv')} disabled={!report || downloading !== null} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {downloading === 'csv' ? '…' : t('taxReport.downloadCsv', 'CSV')}
          </button>
          <button onClick={() => handleDownload('zip')} disabled={!report || downloading !== null} className="px-3 py-1.5 text-sm rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50">
            {downloading === 'zip' ? '…' : t('taxReport.downloadZip', 'Receipts ZIP')}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || !report ? (
        !error && <div className="py-16 text-center text-gray-500">{t('common.loading', 'Loading...')}</div>
      ) : (
        <div className="space-y-6">
          {/* Warnings */}
          {report.warnings.length > 0 && (
            <div className="space-y-2">
              {report.warnings.map((w, i) => (
                <div key={i} className={`rounded-md border px-3 py-2 text-sm ${severityClass(w.severity)}`}>
                  <span className="font-medium mr-2">{w.severity === 'error' ? '⛔' : w.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                  {w.message}
                </div>
              ))}
            </div>
          )}

          {/* Flat-rate vehicle: the claim is the mileage amount + parking/tolls */}
          {report.totals.flatRateVehicle && (
            <div className="rounded-lg border border-green-400 bg-green-50 p-4">
              <div className="text-xs text-gray-600">{t('taxReport.flatRateClaim', 'Flat-rate mileage claim for this vehicle')}</div>
              <div className="text-2xl font-semibold mt-1">{money(report.totals.flatRateClaim)}</div>
              <div className="text-xs text-gray-600 mt-1">
                {Math.round(report.simplifiedExpenses.businessMiles).toLocaleString()} mi → {money(report.simplifiedExpenses.amount)}
                {report.totals.allowable > 0 && ` + ${money(report.totals.allowable)} ${t('taxReport.parkingTolls', 'parking / tolls')}`}
                {' · '}{t('taxReport.flatRateNote', 'fuel, insurance, servicing and the vehicle cost are inside the rate')}
              </div>
            </div>
          )}

          {/* Headline comparison */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${report.totals.flatRateVehicle ? 'opacity-60' : ''}`}>
            <div className={`rounded-lg border p-4 ${report.comparison.betterMethod === 'actualCost' ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
              <div className="text-xs text-gray-500">{t('taxReport.actualCostMethod', 'Actual cost method')}</div>
              <div className="text-2xl font-semibold mt-1">{money(report.comparison.actualCostTotal)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {money(report.totals.allowable)} {t('taxReport.runningCosts', 'running costs')} + {money(report.capitalAllowance.allowance)} {t('taxReport.capitalAllowance', 'capital allowance')}
              </div>
            </div>
            <div className={`rounded-lg border p-4 ${report.comparison.betterMethod === 'mileage' ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
              <div className="text-xs text-gray-500">{t('taxReport.simplifiedMethod', 'Simplified expenses (flat rate)')}</div>
              <div className="text-2xl font-semibold mt-1">{money(report.comparison.simplifiedTotal)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(report.simplifiedExpenses.firstBandMiles).toLocaleString()} mi × {report.simplifiedExpenses.firstBandRate * 100}p
                {report.simplifiedExpenses.secondBandMiles > 0 && ` + ${Math.round(report.simplifiedExpenses.secondBandMiles).toLocaleString()} mi × ${report.simplifiedExpenses.secondBandRate * 100}p`}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{t('taxReport.difference', 'Difference')}</div>
              <div className={`text-2xl font-semibold mt-1 ${report.comparison.difference >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {report.comparison.difference >= 0 ? '+' : ''}{money(report.comparison.difference)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {report.comparison.betterMethod === 'equal'
                  ? t('taxReport.equal', 'Both methods give the same deduction')
                  : t('taxReport.better', { defaultValue: '{{method}} gives the larger deduction', method: report.comparison.betterMethod === 'actualCost' ? t('taxReport.actualCostMethod', 'Actual cost method') : t('taxReport.simplifiedMethod', 'Simplified expenses') })}
                {report.comparison.lockedToOtherMethod && ` · ${t('taxReport.locked', 'locked to current method')}`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mileage */}
            <section className="rounded-lg border border-gray-200 bg-white">
              <h2 className="px-4 py-3 border-b border-gray-100 font-medium">{t('taxReport.mileage', 'Mileage & business use')}</h2>
              <dl className="p-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-gray-500">{t('taxReport.businessMiles', 'Business miles (routes)')}</dt>
                <dd className="text-right font-medium">{miles(report.mileage.businessMiles)} <span className="text-xs text-gray-400">({report.mileage.routesCounted} {t('taxReport.routes', 'routes')})</span></dd>
                <dt className="text-gray-500">{t('taxReport.odometerOpen', 'Odometer opening')}</dt>
                <dd className="text-right">{report.mileage.odometerStart ? `${report.mileage.odometerStart.miles.toLocaleString()} · ${date(report.mileage.odometerStart.date)}` : '—'}</dd>
                <dt className="text-gray-500">{t('taxReport.odometerClose', 'Odometer closing')}</dt>
                <dd className="text-right">{report.mileage.odometerEnd ? `${report.mileage.odometerEnd.miles.toLocaleString()} · ${date(report.mileage.odometerEnd.date)}` : '—'}</dd>
                <dt className="text-gray-500">{t('taxReport.totalMiles', 'Total miles')}</dt>
                <dd className="text-right font-medium">{miles(report.mileage.totalMiles)}</dd>
                <dt className="text-gray-500">{t('taxReport.businessPct', 'Business use')}</dt>
                <dd className="text-right font-semibold text-lg">
                  {pct(report.mileage.businessUsePercent)}
                  <span className="ml-1 text-xs font-normal text-gray-400">({t(`taxReport.source.${report.mileage.businessUseSource}`, report.mileage.businessUseSource)})</span>
                </dd>
              </dl>
            </section>

            {/* Capital allowance */}
            <section className="rounded-lg border border-gray-200 bg-white">
              <h2 className="px-4 py-3 border-b border-gray-100 font-medium">{t('taxReport.capitalAllowance', 'Capital allowance')}</h2>
              <div className="p-4 text-sm">
                {report.vehicle && (
                  <div className="mb-3 text-gray-600">
                    <span className="font-mono font-semibold">{report.vehicle.registration}</span> {report.vehicle.description}
                    {report.vehicle.co2GPerKm != null && ` · ${report.vehicle.co2GPerKm} g/km`}
                  </div>
                )}
                {report.capitalAllowance.applicable && report.capitalAllowance.isDisposal ? (
                  <dl className="grid grid-cols-2 gap-y-2">
                    <dt className="text-gray-500 col-span-2 text-xs">{report.capitalAllowance.allowanceLabel}</dt>
                    <dt className="text-gray-500">{report.capitalAllowance.qualifyingExpenditure > 0 ? t('taxReport.qualifying', 'Qualifying expenditure') : t('taxReport.poolBf', 'Pool brought forward')}</dt>
                    <dd className="text-right">{money(report.capitalAllowance.qualifyingExpenditure > 0 ? report.capitalAllowance.qualifyingExpenditure : report.capitalAllowance.poolBroughtForward)}</dd>
                    <dt className="text-gray-500">− {t('taxReport.disposalProceeds', 'Disposal proceeds')}</dt>
                    <dd className="text-right">{money(report.capitalAllowance.disposalProceeds)}</dd>
                    <dt className="text-gray-500">{report.capitalAllowance.balancingType === 'balancingCharge' ? t('taxReport.balancingCharge', 'Balancing charge (gross)') : t('taxReport.balancingAllowance', 'Balancing allowance (gross)')}</dt>
                    <dd className="text-right">{money(Math.abs(report.capitalAllowance.balancingAdjustmentGross))}</dd>
                    <dt className="text-gray-500">× {t('taxReport.businessPct', 'Business use')}</dt>
                    <dd className="text-right">{pct(report.capitalAllowance.businessUsePercent)}</dd>
                    <dt className={`font-medium ${report.capitalAllowance.balancingType === 'balancingCharge' ? 'text-red-700' : 'text-gray-700'}`}>
                      {report.capitalAllowance.balancingType === 'balancingCharge' ? t('taxReport.chargeToClaim', 'Balancing charge (added to profit)') : t('taxReport.allowance', 'Allowance to claim')}
                    </dt>
                    <dd className={`text-right font-semibold text-lg ${report.capitalAllowance.balancingType === 'balancingCharge' ? 'text-red-700' : ''}`}>{money(Math.abs(report.capitalAllowance.allowance))}</dd>
                    <dd className="col-span-2 text-xs text-gray-400">{t('taxReport.disposalNote', 'Disposal year: no writing-down allowance; the pool closes at £0.')}</dd>
                  </dl>
                ) : report.capitalAllowance.applicable ? (
                  <dl className="grid grid-cols-2 gap-y-2">
                    <dt className="text-gray-500 col-span-2 text-xs">{report.capitalAllowance.allowanceLabel}</dt>
                    {report.capitalAllowance.qualifyingExpenditure > 0 && (<>
                      <dt className="text-gray-500">{t('taxReport.qualifying', 'Qualifying expenditure')}</dt>
                      <dd className="text-right">{money(report.capitalAllowance.qualifyingExpenditure)}</dd>
                    </>)}
                    {report.capitalAllowance.poolBroughtForward > 0 && (<>
                      <dt className="text-gray-500">{t('taxReport.poolBf', 'Pool brought forward')}</dt>
                      <dd className="text-right">{money(report.capitalAllowance.poolBroughtForward)}</dd>
                    </>)}
                    <dt className="text-gray-500">{t('taxReport.rate', 'Rate')}</dt>
                    <dd className="text-right">{(report.capitalAllowance.rate * 100).toFixed(0)}%</dd>
                    <dt className="text-gray-500">{t('taxReport.grossAllowance', 'Gross allowance')}</dt>
                    <dd className="text-right">{money(report.capitalAllowance.grossAllowance)}</dd>
                    <dt className="text-gray-500">× {t('taxReport.businessPct', 'Business use')}</dt>
                    <dd className="text-right">{pct(report.capitalAllowance.businessUsePercent)}</dd>
                    <dt className="text-gray-700 font-medium">{t('taxReport.allowance', 'Allowance to claim')}</dt>
                    <dd className="text-right font-semibold text-lg">{money(report.capitalAllowance.allowance)}</dd>
                    <dt className="text-gray-500">{t('taxReport.poolCf', 'Pool carried forward')}</dt>
                    <dd className="text-right">{money(report.capitalAllowance.poolCarriedForward)} <span className="text-xs text-gray-400">→ {label(report.taxYear + 1)}</span></dd>
                  </dl>
                ) : (
                  <p className="text-gray-500">{report.capitalAllowance.reason}</p>
                )}
              </div>
            </section>
          </div>

          {/* Expense categories */}
          <section className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
            <h2 className="px-4 py-3 border-b border-gray-100 font-medium">{t('taxReport.runningCostsTitle', 'Running costs by category')}</h2>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">{t('expenses.fields.category', 'Category')}</th>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">{t('taxReport.total', 'Total')}</th>
                  <th className="px-3 py-2 text-right">{t('taxReport.fullyBusiness', '100% business')}</th>
                  <th className="px-3 py-2 text-right">{t('taxReport.allowable', 'Allowable')}</th>
                  <th className="px-3 py-2 text-right">{t('taxReport.disallowable', 'Disallowable')}</th>
                  <th className="px-3 py-2 text-right">{t('taxReport.noReceipt', 'No receipt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.categories.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">{t('expenses.empty', 'No expenses in this tax year yet.')}</td></tr>
                )}
                {report.categories.map(c => (
                  <tr key={c.category} className={c.excludedFromRunningCosts || c.coveredByFlatRate ? 'text-gray-400 italic' : ''}>
                    <td className="px-3 py-2">
                      {catLabel(c.category)}
                      {c.excludedFromRunningCosts && <span className="ml-1 text-xs">({t('taxReport.viaCapitalAllowance', 'via capital allowance')})</span>}
                      {c.coveredByFlatRate && <span className="ml-1 text-xs">({t('taxReport.coveredByFlatRate', 'covered by flat rate')})</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{c.count}</td>
                    <td className="px-3 py-2 text-right">{money(c.total)}</td>
                    <td className="px-3 py-2 text-right">{c.fullyBusinessTotal > 0 ? money(c.fullyBusinessTotal) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(c.allowable)}</td>
                    <td className="px-3 py-2 text-right">{money(c.disallowable)}</td>
                    <td className="px-3 py-2 text-right">{c.receiptsMissing > 0 ? <span className="text-amber-700">{c.receiptsMissing}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-3 py-2">{t('taxReport.total', 'Total')}</td>
                  <td />
                  <td className="px-3 py-2 text-right">{money(report.totals.totalExpenses)}</td>
                  <td />
                  <td className="px-3 py-2 text-right">{money(report.totals.allowable)}</td>
                  <td className="px-3 py-2 text-right">{money(report.totals.disallowable)}</td>
                  <td className="px-3 py-2 text-right">{report.totals.receiptsMissing || '—'}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* SA103 boxes */}
          <section className="rounded-lg border border-gray-200 bg-white">
            <h2 className="px-4 py-3 border-b border-gray-100 font-medium">{t('taxReport.sa103', 'SA103 boxes – copy these into your return')}</h2>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">{t('taxReport.form', 'Form')}</th>
                  <th className="px-3 py-2 text-left">{t('taxReport.box', 'Box')}</th>
                  <th className="px-3 py-2 text-left">{t('taxReport.label', 'Label')}</th>
                  <th className="px-3 py-2 text-right">{t('taxReport.amount', 'Amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.sa103Boxes.map((b, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-500">{b.form}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{b.box}</td>
                    <td className="px-3 py-2">{b.label}{b.note && <div className="text-xs text-gray-400">{b.note}</div>}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{money(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-xs text-gray-500 border-t border-gray-200 pt-4">{report.disclaimer}</p>
        </div>
      )}
    </div>
  );
};

export default TaxReport;
