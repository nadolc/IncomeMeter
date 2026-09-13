import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { createExpense, updateExpense, uploadAttachmentsBatch, getVehicles } from '../../utils/api';
import type { Expense, ExpenseCategory, CreateExpenseRequest, Vehicle } from '../../types';
import { EXPENSE_CATEGORIES } from '../../types';
import AttachmentImage from '../Common/AttachmentImage';

interface ExpenseFormModalProps {
  isOpen: boolean;
  /** Pass an expense to edit it; omit for a new one. */
  expense?: Expense | null;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Manual add / edit of a single expense, with an optional receipt photo. */
const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({ isOpen, expense, onClose, onSaved }) => {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [date, setDate] = useState(toLocalInput());
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [litres, setLitres] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [fullyBusiness, setFullyBusiness] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getVehicles().then(list => {
      setVehicles(list);
      if (!expense && list.length === 1) setVehicleId(list[0].id);
    }).catch(() => setVehicles([]));

    if (expense) {
      setVehicleId(expense.vehicleId ?? '');
      setCategory(expense.category);
      setDate(toLocalInput(expense.date));
      setAmount(String(expense.amount));
      setMerchant(expense.merchant ?? '');
      setLitres(expense.fuel?.litres != null ? String(expense.fuel.litres) : '');
      setOdometer(expense.fuel?.odometerMiles != null ? String(expense.fuel.odometerMiles) : '');
      setNotes(expense.notes ?? '');
      setFullyBusiness(expense.isFullyBusiness);
      setAttachmentIds(expense.attachmentIds);
    } else {
      setCategory('fuel');
      setDate(toLocalInput());
      setAmount('');
      setMerchant('');
      setLitres('');
      setOdometer('');
      setNotes('');
      setFullyBusiness(false);
      setAttachmentIds([]);
    }
    setFile(null);
    setError(null);
  }, [isOpen, expense]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!date || amount.trim() === '' || isNaN(amt) || amt < 0) {
      setError(t('expenses.form.errors.required', 'Date and a valid amount are required.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let ids = attachmentIds;
      if (file) {
        const [up] = await uploadAttachmentsBatch([file]);
        if (up.error || !up.attachmentId) throw new Error(up.error ?? 'upload failed');
        ids = [...ids, up.attachmentId];
      }
      const fuel = category === 'fuel' && (litres.trim() || odometer.trim())
        ? { litres: litres.trim() ? Number(litres) : null, odometerMiles: odometer.trim() ? Number(odometer) : null }
        : null;
      const payload: CreateExpenseRequest = {
        vehicleId: vehicleId || null,
        category,
        date: new Date(date).toISOString(),
        amount: amt,
        currency: 'GBP',
        merchant: merchant || null,
        notes: notes || null,
        fuel,
        attachmentIds: ids,
        isFullyBusiness: fullyBusiness,
        dateSource: 'manual'
      };
      const saved = expense ? await updateExpense(expense.id, payload) : await createExpense(payload);
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        ?? (err as Error)?.message;
      setError(msg ?? t('expenses.form.errors.save', 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';
  const label = 'block text-xs text-gray-500 mb-0.5';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {expense ? t('expenses.form.editTitle', 'Edit expense') : t('expenses.form.addTitle', 'Add expense')}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3">
          {error && <div className="col-span-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

          <label className="block">
            <span className={label}>{t('expenses.fields.date', 'Date')} *</span>
            <input type="datetime-local" className={input} value={date} onChange={e => setDate(e.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>{t('expenses.fields.category', 'Category')}</span>
            <select className={input} value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(`expenses.categories.${c}`, c)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={label}>{t('expenses.fields.amount', 'Amount (£)')} *</span>
            <input type="number" step="0.01" min="0" inputMode="decimal" className={input} value={amount} onChange={e => setAmount(e.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>{t('expenses.fields.merchant', 'Merchant')}</span>
            <input type="text" className={input} value={merchant} onChange={e => setMerchant(e.target.value)} />
          </label>

          {category === 'fuel' && (
            <>
              <label className="block">
                <span className={label}>{t('expenses.fields.litres', 'Litres')}</span>
                <input type="number" step="0.01" min="0" inputMode="decimal" className={input} value={litres} onChange={e => setLitres(e.target.value)} />
              </label>
              <label className="block">
                <span className={label}>{t('expenses.fields.odometerAtFill', 'Odometer at fill (mi)')}</span>
                <input type="number" step="1" min="0" inputMode="numeric" className={input} value={odometer} onChange={e => setOdometer(e.target.value)} />
              </label>
            </>
          )}

          {vehicles.length > 0 && (
            <label className="block col-span-2">
              <span className={label}>{t('taxReport.vehicle', 'Vehicle')}</span>
              <select className={input} value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                <option value="">{t('expenses.bulkImport.noVehicle', 'Not assigned')}</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration}{v.make ? ` · ${v.make} ${v.model ?? ''}` : ''}</option>)}
              </select>
            </label>
          )}

          <label className="block col-span-2">
            <span className={label}>{t('expenses.fields.notes', 'Notes')}</span>
            <input type="text" className={input} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>

          <label className="flex items-center gap-2 text-sm col-span-2">
            <input type="checkbox" checked={fullyBusiness} onChange={e => setFullyBusiness(e.target.checked)} />
            {t('expenses.fields.fullyBusiness', '100% business (do not apportion)')}
          </label>

          <div className="col-span-2">
            <span className={label}>{t('expenses.fields.receipt', 'Receipt')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {attachmentIds.map(id => (
                <div key={id} className="relative">
                  <AttachmentImage attachmentId={id} className="w-16 h-16 object-cover rounded border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => setAttachmentIds(prev => prev.filter(x => x !== id))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-300 text-xs text-gray-600 hover:text-red-600"
                    title={t('common.remove', 'Remove')}
                  >✕</button>
                </div>
              ))}
              {file && (
                <div className="relative">
                  <img src={URL.createObjectURL(file)} alt="" className="w-16 h-16 object-cover rounded border border-blue-300" />
                  <button type="button" onClick={() => setFile(null)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-300 text-xs text-gray-600 hover:text-red-600">✕</button>
                </div>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                {t('expenses.form.attachPhoto', 'Attach photo')}
              </button>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <p className="mt-1 text-xs text-gray-400">{t('expenses.form.noReceiptHint', 'No receipt? Fine for items like insurance paid online – keep the policy document or bank statement instead.')}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseFormModal;
