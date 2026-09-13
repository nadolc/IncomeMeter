import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { createOdometerReading, uploadAttachmentsBatch, getVehicles } from '../../utils/api';
import type { OdometerReading, OdometerSource, Vehicle } from '../../types';

interface OdometerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (reading: OdometerReading) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const nowLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const SOURCES: OdometerSource[] = ['manual', 'fuelStop', 'taxYearStart', 'taxYearEnd'];

/** Manual odometer reading, e.g. the 6 April / 5 April tax-year bookends. */
const OdometerFormModal: React.FC<OdometerFormModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(nowLocal());
  const [miles, setMiles] = useState('');
  const [source, setSource] = useState<OdometerSource>('manual');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getVehicles().then(list => {
      setVehicles(list);
      if (list.length === 1) setVehicleId(list[0].id);
    }).catch(() => setVehicles([]));
    setDate(nowLocal());
    setMiles('');
    setSource('manual');
    setNotes('');
    setFile(null);
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(miles);
    if (!date || miles.trim() === '' || isNaN(m) || m < 0) {
      setError(t('expenses.form.errors.milesRequired', 'Date and a valid odometer reading are required.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let photoAttachmentId: string | null = null;
      if (file) {
        const [up] = await uploadAttachmentsBatch([file]);
        if (up.error || !up.attachmentId) throw new Error(up.error ?? 'upload failed');
        photoAttachmentId = up.attachmentId;
      }
      const saved = await createOdometerReading({
        vehicleId: vehicleId || null,
        date: new Date(date).toISOString(),
        miles: m,
        source,
        photoAttachmentId,
        dateSource: 'manual',
        notes: notes || null
      });
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
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('expenses.form.addOdometerTitle', 'Add odometer reading')}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3">
          {error && <div className="col-span-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <label className="block">
            <span className={label}>{t('expenses.fields.date', 'Date')} *</span>
            <input type="datetime-local" className={input} value={date} onChange={e => setDate(e.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>{t('expenses.fields.odometerMiles', 'Odometer (miles)')} *</span>
            <input type="number" step="1" min="0" inputMode="numeric" className={input} value={miles} onChange={e => setMiles(e.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>{t('expenses.fields.source', 'Source')}</span>
            <select className={input} value={source} onChange={e => setSource(e.target.value as OdometerSource)}>
              {SOURCES.map(s => <option key={s} value={s}>{t(`expenses.odometerSources.${s}`, s)}</option>)}
            </select>
          </label>
          {vehicles.length > 0 && (
            <label className="block">
              <span className={label}>{t('taxReport.vehicle', 'Vehicle')}</span>
              <select className={input} value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                <option value="">{t('expenses.bulkImport.noVehicle', 'Not assigned')}</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration}</option>)}
              </select>
            </label>
          )}
          <label className="block col-span-2">
            <span className={label}>{t('expenses.fields.notes', 'Notes')}</span>
            <input type="text" className={input} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
          <div className="col-span-2 flex items-center gap-2">
            {file && <img src={URL.createObjectURL(file)} alt="" className="w-16 h-16 object-cover rounded border border-blue-300" />}
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
              {file ? t('expenses.form.changePhoto', 'Change photo') : t('expenses.form.attachPhoto', 'Attach photo')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <p className="col-span-2 text-xs text-gray-400">
            {t('expenses.form.odometerHint', 'Tip: log a reading on 6 April and 5 April each year – those two numbers set your business-use percentage.')}
          </p>
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

export default OdometerFormModal;
