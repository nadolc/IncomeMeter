import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getExpenses, getOdometerReadings, deleteExpense, deleteOdometerReading } from '../../utils/api';
import type { Expense, OdometerReading, ExpenseCategory } from '../../types';
import { EXPENSE_CATEGORIES } from '../../types';
import BulkReceiptImport from '../Import/BulkReceiptImport';
import AttachmentImage from '../Common/AttachmentImage';
import ExpensesSubNav from '../Expenses/ExpensesSubNav';
import ExpenseFormModal from '../Expenses/ExpenseFormModal';
import OdometerFormModal from '../Expenses/OdometerFormModal';

/** UK tax year runs 6 April – 5 April. Returns the start year for the tax year containing `date`. */
const taxYearStartFor = (date: Date): number => {
  const y = date.getFullYear();
  const startThisYear = new Date(y, 3, 6); // 6 April
  return date >= startThisYear ? y : y - 1;
};

const taxYearRange = (startYear: number) => ({
  from: new Date(startYear, 3, 6, 0, 0, 0),
  to: new Date(startYear + 1, 3, 5, 23, 59, 59)
});

const Expenses: React.FC = () => {
  const { t } = useLanguage();

  const [taxYear, setTaxYear] = useState<number>(() => taxYearStartFor(new Date()));
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [readings, setReadings] = useState<OdometerReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [expenseForm, setExpenseForm] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [showOdometerForm, setShowOdometerForm] = useState(false);
  const [tab, setTab] = useState<'expenses' | 'odometer'>('expenses');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = taxYearRange(taxYear);
      const params = { from: from.toISOString(), to: to.toISOString() };
      const [e, o] = await Promise.all([
        getExpenses({ ...params, category: category || undefined }),
        getOdometerReadings(params)
      ]);
      setExpenses(e);
      setReadings(o);
    } catch (err) {
      console.error('Failed to load expenses', err);
      setError(t('expenses.errors.load', 'Failed to load expenses.'));
    } finally {
      setLoading(false);
    }
  }, [taxYear, category, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm(t('expenses.confirmDelete', 'Delete this expense?'))) return;
    try {
      await deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Failed to delete expense', err);
      setError(t('expenses.errors.delete', 'Failed to delete.'));
    }
  };

  const handleDeleteReading = async (id: string) => {
    if (!window.confirm(t('expenses.confirmDeleteReading', 'Delete this odometer reading?'))) return;
    try {
      await deleteOdometerReading(id);
      setReadings(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete odometer reading', err);
      setError(t('expenses.errors.delete', 'Failed to delete.'));
    }
  };

  const totalsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return map;
  }, [expenses]);

  const grandTotal = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const sortedReadings = useMemo(
    () => [...readings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [readings]
  );
  const milesCovered = sortedReadings.length >= 2
    ? sortedReadings[sortedReadings.length - 1].miles - sortedReadings[0].miles
    : null;

  const fmtMoney = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const categoryLabel = (c: string) => t(`expenses.categories.${c}`, c);

  const taxYearOptions = useMemo(() => {
    const current = taxYearStartFor(new Date());
    return [current, current - 1, current - 2, current - 3, current - 4];
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <ExpensesSubNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('expenses.title', 'Vehicle Expenses')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('expenses.subtitle', 'Receipts and odometer readings for your Self Assessment (actual cost method).')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setExpenseForm({ open: true, expense: null })}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          + {t('expenses.addExpense', 'Add expense')}
        </button>
        <button
          onClick={() => setShowOdometerForm(true)}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          + {t('expenses.addOdometer', 'Add odometer')}
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {t('expenses.importReceipts', 'Import receipts')}
        </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">{t('expenses.taxYear', 'Tax year')}</span>
          <select
            value={taxYear}
            onChange={e => setTaxYear(Number(e.target.value))}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            {taxYearOptions.map(y => (
              <option key={y} value={y}>{`${y}/${String(y + 1).slice(-2)}`}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">{t('expenses.fields.category', 'Category')}</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as ExpenseCategory | '')}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t('expenses.allCategories', 'All categories')}</option>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500">{t('expenses.summary.total', 'Total expenses')}</div>
          <div className="text-xl font-semibold text-gray-900 mt-1">{fmtMoney(grandTotal)}</div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500">{t('expenses.summary.fuel', 'Fuel')}</div>
          <div className="text-xl font-semibold text-gray-900 mt-1">{fmtMoney(totalsByCategory.get('fuel') ?? 0)}</div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500">{t('expenses.summary.receipts', 'Receipts')}</div>
          <div className="text-xl font-semibold text-gray-900 mt-1">{expenses.length}</div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-xs text-gray-500">{t('expenses.summary.odometerSpan', 'Odometer span')}</div>
          <div className="text-xl font-semibold text-gray-900 mt-1">
            {milesCovered === null ? '—' : `${milesCovered.toLocaleString()} mi`}
          </div>
          <div className="text-[11px] text-gray-400">
            {t('expenses.summary.readingsCount', { defaultValue: '{{count}} readings', count: readings.length })}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex gap-6">
          {(['expenses', 'odometer'] as const).map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`py-2 text-sm font-medium border-b-2 ${
                tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {key === 'expenses'
                ? t('expenses.tabs.expenses', 'Expenses')
                : t('expenses.tabs.odometer', 'Odometer readings')}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-500">{t('common.loading', 'Loading...')}</div>
      ) : tab === 'expenses' ? (
        expenses.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            {t('expenses.empty', 'No expenses in this tax year yet. Import your receipts to get started.')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">{t('expenses.fields.receipt', 'Receipt')}</th>
                  <th className="px-3 py-2 text-left">{t('expenses.fields.date', 'Date')}</th>
                  <th className="px-3 py-2 text-left">{t('expenses.fields.category', 'Category')}</th>
                  <th className="px-3 py-2 text-left">{t('expenses.fields.merchant', 'Merchant')}</th>
                  <th className="px-3 py-2 text-right">{t('expenses.fields.amount', 'Amount')}</th>
                  <th className="px-3 py-2 text-left">{t('expenses.fields.details', 'Details')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {e.attachmentIds[0] ? (
                        <AttachmentImage
                          attachmentId={e.attachmentIds[0]}
                          className="w-12 h-12 object-cover rounded cursor-pointer"
                          onClick={() => setPreviewId(e.attachmentIds[0])}
                        />
                      ) : (
                        <span className="inline-block w-12 h-12 rounded bg-amber-50 border border-amber-200 text-amber-600 text-[10px] flex items-center justify-center text-center">
                          {t('expenses.noReceipt', 'No receipt')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDate(e.date)}
                      {e.dateSource !== 'manual' && (
                        <span className="ml-1 text-[10px] text-gray-400 uppercase">{e.dateSource}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{categoryLabel(e.category)}</td>
                    <td className="px-3 py-2 text-gray-600">{e.merchant || '—'}</td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{fmtMoney(e.amount)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {e.fuel?.litres != null && <span className="mr-2">{e.fuel.litres} L</span>}
                      {e.fuel?.odometerMiles != null && <span className="mr-2">{e.fuel.odometerMiles.toLocaleString()} mi</span>}
                      {e.isFullyBusiness && (
                        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">100%</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setExpenseForm({ open: true, expense: e })}
                        className="text-xs text-blue-600 hover:text-blue-800 mr-3"
                      >
                        {t('common.edit', 'Edit')}
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-xs text-gray-500 uppercase">
                    {t('expenses.summary.total', 'Total expenses')}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtMoney(grandTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )
      ) : sortedReadings.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          {t('expenses.emptyOdometer', 'No odometer readings yet. Log one at each fuel stop and on 6 April each year.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">{t('expenses.fields.photo', 'Photo')}</th>
                <th className="px-3 py-2 text-left">{t('expenses.fields.date', 'Date')}</th>
                <th className="px-3 py-2 text-right">{t('expenses.fields.odometerMiles', 'Odometer (miles)')}</th>
                <th className="px-3 py-2 text-right">{t('expenses.fields.sinceLast', 'Since last')}</th>
                <th className="px-3 py-2 text-left">{t('expenses.fields.source', 'Source')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedReadings.map((r, i) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {r.photoAttachmentId ? (
                      <AttachmentImage
                        attachmentId={r.photoAttachmentId}
                        className="w-12 h-12 object-cover rounded cursor-pointer"
                        onClick={() => setPreviewId(r.photoAttachmentId!)}
                      />
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 text-right font-medium">{r.miles.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {i === 0 ? '—' : `+${(r.miles - sortedReadings[i - 1].miles).toLocaleString()}`}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {t(`expenses.odometerSources.${r.source}`, r.source)}
                    {r.notes && <div className="text-gray-400">{r.notes}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDeleteReading(r.id)} className="text-xs text-red-600 hover:text-red-800">
                      {t('common.delete', 'Delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Full-size preview */}
      {previewId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewId(null)}
        >
          <AttachmentImage attachmentId={previewId} full className="max-h-full max-w-full object-contain rounded" />
        </div>
      )}

      <BulkReceiptImport
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => load()}
      />
      <ExpenseFormModal
        isOpen={expenseForm.open}
        expense={expenseForm.expense}
        onClose={() => setExpenseForm({ open: false, expense: null })}
        onSaved={() => load()}
      />
      <OdometerFormModal
        isOpen={showOdometerForm}
        onClose={() => setShowOdometerForm(false)}
        onSaved={() => load()}
      />
    </div>
  );
};

export default Expenses;
