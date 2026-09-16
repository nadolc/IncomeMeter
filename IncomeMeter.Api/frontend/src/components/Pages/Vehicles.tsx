import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getVehicles, createVehicle, updateVehicle, deleteVehicle, lookupVehicle, backfillVehicle, assignVehiclesByDate } from '../../utils/api';
import type { Vehicle, VehicleInput, VehicleLookupResult } from '../../types';
import ExpensesSubNav from '../Expenses/ExpensesSubNav';
import { invalidateVehicleCache } from '../../utils/vehicleCache';

const emptyForm: VehicleInput = {
  registration: '',
  make: '',
  model: '',
  vehicleType: 'car',
  fuelType: 'petrol',
  co2GPerKm: null,
  purchaseDate: null,
  disposalDate: null,
  disposalProceeds: null,
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
  const [formError, setFormError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookup, setLookup] = useState<VehicleLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!form.registration.trim()) return;
    setLookingUp(true);
    setLookupError(null);
    setLookup(null);
    try {
      const r = await lookupVehicle(form.registration);
      setLookup(r);
      setForm(prev => ({
        ...prev,
        registration: r.registration || prev.registration,
        make: r.make || prev.make,
        model: r.model || prev.model,
        fuelType: r.fuelType || prev.fuelType,
        co2GPerKm: r.co2GPerKm ?? prev.co2GPerKm,
        vehicleType: r.vehicleType || prev.vehicleType
      }));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setLookupError(
        status === 503 ? t('vehicles.lookup.notConfigured', 'Lookup is not configured on the server (Dvla / Dvsa settings).')
          : status === 404 ? t('vehicles.lookup.notFound', 'No DVLA / DVSA record for that registration.')
            : status === 429 ? t('vehicles.lookup.throttled', 'Rate limit hit – wait a few seconds and try again.')
              : msg ?? t('vehicles.lookup.failed', 'Lookup failed.')
      );
    } finally {
      setLookingUp(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      invalidateVehicleCache();
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
    setLookup(null);
    setLookupError(null);
    setFormError(null);
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
      disposalDate: v.disposalDate ? v.disposalDate.slice(0, 10) : null,
      disposalProceeds: v.disposalProceeds ?? null,
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
    setFormError(null);
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
    setFormError(null);
    try {
      const payload: VehicleInput = {
        ...form,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null,
        disposalDate: form.disposalDate ? new Date(form.disposalDate).toISOString() : null,
        // editing an existing vehicle and blanking the field clears it server-side
        clearDisposalDate: editing !== 'new' && !form.disposalDate,
        // Blank "first used" = not filed yet: clear the HMRC lock so the method can still be changed.
        clearClaimMethodLock: editing !== 'new' && form.claimMethodLockedFromTaxYear == null
      };
      if (editing === 'new') await createVehicle(payload);
      else if (editing) await updateVehicle(editing.id, payload);
      setEditing(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? t('vehicles.errors.save', 'Failed to save vehicle.'));
    } finally {
      setSaving(false);
    }
  };

  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const handleAssignByDate = async () => {
    if (!window.confirm(t('vehicles.assignByDate.confirm', 'Re-link ALL routes, expenses and odometer readings to the vehicle in use on their date (purchase date to disposal date)? Existing links are re-evaluated.'))) return;
    setAssigning(true);
    setBackfillMsg(null);
    setError(null);
    try {
      const r = await assignVehiclesByDate(false);
      const per = Object.entries(r.byVehicle).map(([reg, n]) => `${reg}: ${n}`).join(', ');
      setBackfillMsg(t('vehicles.assignByDate.done', {
        defaultValue: 'Updated {{routes}} routes, {{expenses}} expenses, {{readings}} odometer readings ({{per}}). {{unmatched}} records matched no vehicle.',
        routes: r.routesUpdated, expenses: r.expensesUpdated, readings: r.odometerReadingsUpdated, per: per || '-', unmatched: r.unmatched
      }));
    } catch (err) {
      console.error('Assign by date failed', err);
      setError(t('vehicles.assignByDate.failed', 'Assign by date failed.'));
    } finally {
      setAssigning(false);
    }
  };

  const handleBackfill = async (v: Vehicle, reassignAll: boolean) => {
    const fromLabel = v.purchaseDate ? new Date(v.purchaseDate).toLocaleDateString('en-GB') : t('vehicles.backfill.allTime', 'all time');
    const question = reassignAll
      ? t('vehicles.backfill.confirmAll', { defaultValue: 'Assign {{reg}} to ALL routes, expenses and odometer readings since {{from}}, even ones already linked to another vehicle?', reg: v.registration, from: fromLabel })
      : t('vehicles.backfill.confirm', { defaultValue: 'Assign {{reg}} to every route, expense and odometer reading since {{from}} that has no vehicle yet?', reg: v.registration, from: fromLabel });
    if (!window.confirm(question)) return;
    setBackfilling(v.id);
    setBackfillMsg(null);
    setError(null);
    try {
      const r = await backfillVehicle(v.id, { onlyUnassigned: !reassignAll });
      setBackfillMsg(t('vehicles.backfill.done', {
        defaultValue: '{{reg}}: {{routes}} routes, {{expenses}} expenses, {{readings}} odometer readings updated.',
        reg: v.registration, routes: r.routesUpdated, expenses: r.expensesUpdated, readings: r.odometerReadingsUpdated
      }));
    } catch (err) {
      console.error('Backfill failed', err);
      setError(t('vehicles.backfill.failed', 'Backfill failed.'));
    } finally {
      setBackfilling(null);
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAssignByDate}
            disabled={assigning || vehicles.length === 0}
            className="px-4 py-2 rounded-md border border-indigo-600 text-indigo-700 text-sm font-medium hover:bg-indigo-50 disabled:opacity-50"
            title={t('vehicles.assignByDate.hint', 'Link every route, expense and odometer reading to the vehicle in use on its date')}
          >
            {assigning ? '...' : t('vehicles.assignByDate.button', 'Assign by date')}
          </button>
          <button onClick={openNew} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            {t('vehicles.add', 'Add vehicle')}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {backfillMsg && <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">{backfillMsg}</div>}

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
                {v.disposalDate && (
                  <>
                    <dt className="text-gray-500">{t('vehicles.fields.disposalDate', 'Sold / disposed date')}</dt>
                    <dd>{new Date(v.disposalDate).toLocaleDateString('en-GB')}{v.disposalProceeds != null ? ` · ${fmtMoney(v.disposalProceeds)}` : ''}</dd>
                  </>
                )}
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
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <button onClick={() => openEdit(v)} className="text-blue-600 hover:text-blue-800">{t('common.edit', 'Edit')}</button>
                <button
                  onClick={() => handleBackfill(v, false)}
                  disabled={backfilling === v.id}
                  className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  title={t('vehicles.backfill.hint', 'Link past routes, expenses and odometer readings that have no vehicle to this one')}
                >
                  {backfilling === v.id ? '...' : t('vehicles.backfill.button', 'Backfill history')}
                </button>
                <button
                  onClick={() => handleBackfill(v, true)}
                  disabled={backfilling === v.id}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  title={t('vehicles.backfill.hintAll', 'Reassign everything in the date range, including records already linked to another vehicle')}
                >
                  {t('vehicles.backfill.buttonAll', 'Reassign all')}
                </button>
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
              {formError && (
                <div className="col-span-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
              <label className="block">
                <span className={label}>{t('vehicles.fields.registration', 'Registration')} *</span>
                <div className="flex gap-2">
                  <input className={`${input} font-mono uppercase`} value={form.registration} onChange={e => set('registration', e.target.value)} required maxLength={16} />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookingUp || !form.registration.trim()}
                    className="whitespace-nowrap px-3 py-1.5 text-sm rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    title={t('vehicles.lookup.hint', 'Fetch make, fuel and CO2 from the DVLA')}
                  >
                    {lookingUp ? '…' : t('vehicles.lookup.button', 'Look up')}
                  </button>
                </div>
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
                <span className={label}>{t('vehicles.fields.disposalDate', 'Sold / disposed date')} <span className="text-gray-400">({t('vehicles.fields.disposalDateHint', 'blank = still in use')})</span></span>
                <input type="date" className={input} value={form.disposalDate ?? ''} onChange={e => set('disposalDate', e.target.value || null)} />
              </label>
              <label className="block">
                <span className={label}>{t('vehicles.fields.disposalProceeds', 'Sale / scrap proceeds (£)')} <span className="text-gray-400">({t('vehicles.fields.disposalProceedsHint', '0 if scrapped for nothing')})</span></span>
                <input type="number" min="0" step="0.01" className={input} value={form.disposalProceeds ?? ''} onChange={e => set('disposalProceeds', numOrNull(e.target.value))} disabled={!form.disposalDate} />
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

              {lookupError && <p className="col-span-2 text-xs text-red-700">{lookupError}</p>}
              {lookup && (
                <div className="col-span-2 text-xs text-green-800 bg-green-50 border border-green-200 rounded p-2 space-y-1">
                  <div>
                    ✅ {t('vehicles.lookup.filled', 'Filled from')} {lookup.sources.join(' + ')}: {[lookup.make, lookup.model, lookup.colour, lookup.fuelTypeRaw, lookup.engineCapacityCc ? `${lookup.engineCapacityCc} cc` : null, lookup.yearOfManufacture, lookup.co2GPerKm != null ? `${lookup.co2GPerKm} g/km` : null, lookup.euroStatus].filter(Boolean).join(' · ')}
                    {lookup.motExpiryDate && ` · MOT ${t('vehicles.lookup.until', 'until')} ${new Date(lookup.motExpiryDate).toLocaleDateString('en-GB')}`}
                    {lookup.taxDueDate && ` · ${t('vehicles.lookup.taxDue', 'tax due')} ${new Date(lookup.taxDueDate).toLocaleDateString('en-GB')}`}
                  </div>
                  {lookup.co2GPerKm == null && (
                    <div className="text-amber-700">⚠️ {t('vehicles.lookup.noCo2', 'No CO2 figure returned – enter it from the V5C to get the capital allowance rate.')}</div>
                  )}
                  {lookup.motTests.length > 0 && (
                    <div>
                      {t('vehicles.lookup.motHistory', 'MOT odometer history')}:{' '}
                      {lookup.motTests.slice(0, 4).map(m => `${m.completedDate ? new Date(m.completedDate).toLocaleDateString('en-GB') : '?'} ${m.odometerValue != null ? `${m.odometerValue.toLocaleString()} ${m.odometerUnit ?? ''}` : ''} (${m.result ?? '?'})`).join(' · ')}
                    </div>
                  )}
                  {lookup.warnings.map((w, i) => <div key={i} className="text-amber-700">⚠️ {w}</div>)}
                </div>
              )}

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
