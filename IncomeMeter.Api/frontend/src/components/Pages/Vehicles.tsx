import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from '../../utils/api';
import type { Vehicle, VehicleInput } from '../../types';
import ExpensesSubNav from '../Expenses/ExpensesSubNav';

const emptyForm: VehicleInput = {
  registration: '',
  make: '',
  model: '',
  vehicleType: 'car',
  fuelType: 'petrol',
  co2GPerKm: null,
  purchaseDate: null,
  purchasePrice: null,
  isNew: false,
  financeType: 'cash',
  claimMethod: 'actualCost',
  claimMethodLockedFromTaxYear: null,
  capitalAllowancePoolBroughtForward: null,
  poolBroughtForwardTaxYear: null,
  notes: ''
};

const Vehicles: React.FC = () => {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [form, setForm] = useState<VehicleInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVehicles(await getVehicles(true));
    } catch (err) {
      console.error('Failed to load vehicles', err);
      setError(t('vehicles.errors.load', 'Failed to load vehicles.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setEditing('new');
  };

  const openEdit = (v: Vehicle) => {
    setForm({
      registration: v.registration,
      make: v.make ?? '',
      model: v.model ?? '',
      vehicleType: v.vehicleType,
      fuelType: v.fuelType ?? 'petrol',
      co2GPerKm: v.co2GPerKm ?? null,
      purchaseDate: v.purchaseDate ? v.purchaseDate.slice(0, 10) : null,
      purchasePrice: v.purchasePrice ?? null,
      isNew: v.isNew,
      financeType: v.financeType,
      claimMethod: v.claimMethod,
      claimMethodLockedFromTaxYear: v.claimMethodLockedFromTaxYear ?? null,
      capitalAllowancePoolBroughtForward: v.capitalAllowancePoolBroughtForward ?? null,
      poolBroughtForwardTaxYear: v.poolBroughtForwardTaxYear ?? null,
      isActive: v.isActive,
      notes: v.notes ?? ''
    });
    setEditing(v);
  };

  const set = <K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.registration.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: VehicleInput = {
        ...form,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null
      };
      if (editing === 'new') await createVehicle(payload);
      else if (editing) await updateVehicle(editing.id, payload);
      setEditing(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('vehicles.errors.save', 'Failed to save vehicle.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Vehicle) => {
    if (!window.confirm(t('vehicles.confirmDelete', { defaultValue: 'Delete {{reg}}? Expenses linked to it are kept.', reg: v.registration }))) return;
    try {
      await deleteVehicle(v.id);
      await load();
    } catch (err) {
      console.error('Failed to delete vehicle', err);
      setError(t('vehicles.errors.delete', 'Failed to delete vehicle.'));
    }
  };

  const fmtMoney = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  const input = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';
  const label = 'block text-xs text-gray-500 mb-0.5';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <ExpensesSubNav />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('vehicles.title', 'Vehicles')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('vehicles.subtitle', 'CO2, purchase details and the claim method drive the capital allowance and the HMRC method lock.')}
          </p>
        </div>
        <button onClick={openNew} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          {t('vehicles.add', 'Add vehicle')}
        </button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-gray-500">{t('common.loading', 'Loading...')}</div>
      ) : vehicles.length === 0 ? (
        <div className="py-16 text-center text-gray-500">{t('vehicles.empty', 'No vehicles yet. Add the vehicle you use for work.')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map(v => (
            <div key={v.id} className={`rounded-lg border bg-white p-4 ${v.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-lg font-semibold tracking-wider">{v.registration}</div>
                  <div className="text-sm text-gray-600">{[v.make, v.model].filter(Boolean).join(' ') || '—'}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{t(`vehicles.types.${v.vehicleType}`, v.vehicleType)}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-gray-500">{t('vehicles.fields.co2', 'CO2 g/km')}</dt>
                <dd>{v.co2GPerKm ?? '—'}</dd>
                <dt className="text-gray-500">{t('vehicles.fields.purchase', 'Purchase')}</dt>
                <dd>{v.purchaseDate ? new Date(v.purchaseDate).toLocaleDateString('en-GB') : '—'}{v.purchasePrice != null ? ` · ${fmtMoney(v.purchasePrice)}` : ''}{v.isNew ? ` · ${t('vehicles.new', 'new')}` : ''}</dd>
                <dt className="text-gray-500">{t('vehicles.fields.claimMethod', 'Claim method')}</dt>
                <dd>
                  {t(`vehicles.claimMethods.${v.claimMethod}`, v.claimMethod)}
                  {v.claimMethodLockedFromTaxYear != null && (
                    <span className="ml-1 text-amber-700">🔒 {v.claimMethodLockedFromTaxYear}/{String(v.claimMethodLockedFromTaxYear + 1).slice(-2)}</span>
                  )}
                </dd>
                {v.capitalAllowancePoolBroughtForward != null && (
                  <>
                    <dt className="text-gray-500">{t('vehicles.fields.poolBf', 'Pool b/f')}</dt>
                    <dd>{fmtMoney(v.capitalAllowancePoolBroughtForward)}{v.poolBroughtForwardTaxYear ? ` (${v.poolBroughtForwardTaxYear}/${String(v.poolBroughtForwardTaxYear + 1).slice(-2)})` : ''}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex gap-3 text-xs">
                <button onClick={() => openEdit(v)} className="text-blue-600 hover:text-blue-800">{t('common.edit', 'Edit')}</button>
                <button onClick={() => handleDelete(v)} className="text-red-600 hover:text-red-800">{t('common.delete', 'Delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing === 'new' ? t('vehicles.add', 'Add vehicle') : t('vehicles.edit', 'Edit vehicle')}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-3">
              <label className="block">
                <span className={label}>{t('vehicles.fields.registration', 'Registration')} *</span>
                <input className={`${input} font-mono uppercase`} value={form.registration} onChange={e => set('registration', e.target.value)} required maxLength={16} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.type', 'Type')}</span>
                <select className={input} value={form.vehicleType} onChange={e => set('vehicleType', e.target.value as VehicleInput['vehicleType'])}>
                  <option value="car">{t('vehicles.types.car', 'Car')}</option>
                  <option value="van">{t('vehicles.types.van', 'Van')}</option>
                  <option value="motorcycle">{t('vehicles.types.motorcycle', 'Motorcycle')}</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.make', 'Make')}</span>
                <input className={input} value={form.make ?? ''} onChange={e => set('make', e.target.value)} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.model', 'Model')}</span>
                <input className={input} value={form.model ?? ''} onChange={e => set('model', e.target.value)} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.fuel', 'Fuel')}</span>
                <select className={input} value={form.fuelType ?? 'petrol'} onChange={e => set('fuelType', e.target.value)}>
                  {['petrol', 'diesel', 'hybrid', 'electric', 'other'].map(f => (
                    <option key={f} value={f}>{t(`vehicles.fuels.${f}`, f)}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.co2', 'CO2 g/km')} <span className="text-gray-400">({t('vehicles.fields.co2Hint', 'from V5C – decides 18% / 6% rate')})</span></span>
                <input type="number" min="0" className={input} value={form.co2GPerKm ?? ''} onChange={e => set('co2GPerKm', numOrNull(e.target.value))} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.purchaseDate', 'Purchase date')}</span>
                <input type="date" className={input} value={form.purchaseDate ?? ''} onChange={e => set('purchaseDate', e.target.value || null)} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.purchasePrice', 'Purchase price (£)')}</span>
                <input type="number" min="0" step="0.01" className={input} value={form.purchasePrice ?? ''} onChange={e => set('purchasePrice', numOrNull(e.target.value))} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isNew} onChange={e => set('isNew', e.target.checked)} />
                {t('vehicles.fields.isNew', 'Bought new (unused)')}
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.finance', 'Finance')}</span>
                <select className={input} value={form.financeType} onChange={e => set('financeType', e.target.value as VehicleInput['financeType'])}>
                  {['cash', 'hp', 'lease', 'none'].map(f => (
                    <option key={f} value={f}>{t(`vehicles.finance.${f}`, f)}</option>
                  ))}
                </select>
              </label>

              <div className="col-span-2 border-t border-gray-100 pt-3 mt-1 text-xs font-medium text-gray-500 uppercase">
                {t('vehicles.sections.hmrc', 'HMRC method & capital allowance pool')}
              </div>
              <label className="block">
                <span className={label}>{t('vehicles.fields.claimMethod', 'Claim method')}</span>
                <select className={input} value={form.claimMethod} onChange={e => set('claimMethod', e.target.value as VehicleInput['claimMethod'])}>
                  <option value="actualCost">{t('vehicles.claimMethods.actualCost', 'Actual costs')}</option>
                  <option value="mileage">{t('vehicles.claimMethods.mileage', 'Flat-rate mileage (45p/25p)')}</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.lockedFrom', 'Method first used in tax year')} <span className="text-gray-400">({t('vehicles.fields.lockedFromHint', 'e.g. 2023 = 2023/24; leave blank if not yet filed')})</span></span>
                <input type="number" min="2000" max="2100" className={input} value={form.claimMethodLockedFromTaxYear ?? ''} onChange={e => set('claimMethodLockedFromTaxYear', numOrNull(e.target.value))} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.poolBf', 'Pool b/f')} <span className="text-gray-400">({t('vehicles.fields.poolBfHint', 'written-down value from last return')})</span></span>
                <input type="number" min="0" step="0.01" className={input} value={form.capitalAllowancePoolBroughtForward ?? ''} onChange={e => set('capitalAllowancePoolBroughtForward', numOrNull(e.target.value))} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.poolYear', 'Pool b/f for tax year')}</span>
                <input type="number" min="2000" max="2100" className={input} value={form.poolBroughtForwardTaxYear ?? ''} onChange={e => set('poolBroughtForwardTaxYear', numOrNull(e.target.value))} />
              </label>
              <label className="block col-span-2">
                <span className={label}>{t('vehicles.fields.notes', 'Notes')}</span>
                <textarea className={input} rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
              </label>
              {editing !== 'new' && (
                <label className="flex items-center gap-2 text-sm col-span-2">
                  <input type="checkbox" checked={form.isActive ?? true} onChange={e => set('isActive', e.target.checked)} />
                  {t('vehicles.fields.active', 'Active (currently in use)')}
                </label>
              )}
              <p className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                {t('vehicles.lockHint', 'HMRC: once you have claimed the flat-rate mileage method for a vehicle you must keep using it for that vehicle. Actual costs can only be chosen for a vehicle that has never been claimed at the flat rate.')}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
