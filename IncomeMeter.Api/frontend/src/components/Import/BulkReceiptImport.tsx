import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { uploadAttachmentsBatch, createExpensesBatch, getVehicles } from '../../utils/api';
import type {
  AttachmentUploadResult,
  BatchImportItem,
  BatchImportResult,
  ExpenseCategory,
  Vehicle
} from '../../types';
import { EXPENSE_CATEGORIES } from '../../types';

/** Photos taken within this many minutes of each other are shown as one "stop" (e.g. receipt + odometer). */
const GROUP_WINDOW_MINUTES = 10;

type RowKind = 'expense' | 'odometer';

interface ReviewRow {
  key: string;
  file: File;
  previewUrl: string;
  upload: AttachmentUploadResult;
  include: boolean;
  kind: RowKind;
  /** Local wall-clock value for <input type="datetime-local"> – "YYYY-MM-DDTHH:mm" or "". */
  date: string;
  dateSource: 'exif' | 'filename' | 'ocr' | 'manual';
  category: ExpenseCategory;
  ocrConfidence: number | null;
  amount: string;
  merchant: string;
  litres: string;
  miles: string;
  notes: string;
  isFullyBusiness: boolean;
  groupIndex: number | null;
  errors: string[];
}

interface BulkReceiptImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: (result: BatchImportResult) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Convert a server "takenAt" (local wall-clock, no zone) into the datetime-local input format. */
const toInputDateTime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const assignGroups = (list: ReviewRow[]): ReviewRow[] => {
  // Sort dated rows by time; consecutive rows within the window share a group.
  const dated = list
    .filter(r => r.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let group = 0;
  let lastTime: number | null = null;
  const groupByKey = new Map<string, number>();
  const sizeByGroup = new Map<number, number>();
  for (const r of dated) {
    const time = new Date(r.date).getTime();
    if (lastTime === null || time - lastTime > GROUP_WINDOW_MINUTES * 60 * 1000) {
      group += 1;
    }
    groupByKey.set(r.key, group);
    sizeByGroup.set(group, (sizeByGroup.get(group) ?? 0) + 1);
    lastTime = time;
  }
  // Only label groups with more than one photo – a lone photo is not a "stop".
  return list.map(r => {
    const g = groupByKey.get(r.key);
    return { ...r, groupIndex: g !== undefined && (sizeByGroup.get(g) ?? 0) > 1 ? g : null };
  });
};

/**
 * Within one "stop" (photos taken minutes apart) copy the dashboard's odometer figure onto the fuel
 * receipt so the expense carries the mileage without retyping it.
 */
const pairOdometerWithReceipts = (list: ReviewRow[]): ReviewRow[] => {
  const byGroup = new Map<number, ReviewRow[]>();
  for (const r of list) if (r.groupIndex !== null) byGroup.set(r.groupIndex, [...(byGroup.get(r.groupIndex) ?? []), r]);
  const milesForKey = new Map<string, string>();
  for (const members of byGroup.values()) {
    const dash = members.find(m => m.kind === 'odometer' && m.miles);
    if (!dash) continue;
    for (const m of members) if (m.kind === 'expense' && m.category === 'fuel' && !m.miles) milesForKey.set(m.key, dash.miles);
  }
  return milesForKey.size === 0 ? list : list.map(r => (milesForKey.has(r.key) ? { ...r, miles: milesForKey.get(r.key)! } : r));
};


/** Re-derive stop groups and odometer pairing after any edit. Only ever fills EMPTY fuel odometer fields. */
const recompute = (list: ReviewRow[]): ReviewRow[] => pairOdometerWithReceipts(assignGroups(list));

const BulkReceiptImport: React.FC<BulkReceiptImportProps> = ({ isOpen, onClose, onImported }) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'pick' | 'uploading' | 'review' | 'saving' | 'done'>('pick');
  const [dragActive, setDragActive] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<BatchImportResult | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [ocrTextOpen, setOcrTextOpen] = useState<Set<string>>(new Set());

  const toggleOcrText = (key: string) =>
    setOcrTextOpen(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // Load vehicles once the modal opens so expenses can be tagged to one.
  useEffect(() => {
    if (!isOpen) return;
    getVehicles()
      .then(list => {
        setVehicles(list);
        if (list.length === 1) setVehicleId(list[0].id);
      })
      .catch(() => setVehicles([]));
  }, [isOpen]);

  // Revoke preview object URLs when the modal unmounts / resets.
  useEffect(() => {
    return () => {
      rows.forEach(r => URL.revokeObjectURL(r.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    rows.forEach(r => URL.revokeObjectURL(r.previewUrl));
    setRows([]);
    setStep('pick');
    setUploadPercent(0);
    setGlobalError(null);
    setSaveResult(null);
  }, [rows]);

  const handleClose = useCallback(() => {
    if (step === 'uploading' || step === 'saving') return;
    reset();
    onClose();
  }, [step, reset, onClose]);

  // ---------- Step 1: pick + upload ----------

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (files.length === 0) {
      setGlobalError(t('expenses.bulkImport.errors.noImages', 'Please choose image or PDF files.'));
      return;
    }

    setGlobalError(null);
    setStep('uploading');
    setUploadPercent(0);

    try {
      const results = await uploadAttachmentsBatch(files, setUploadPercent);

      const newRows: ReviewRow[] = files.map((file, i) => {
        const upload = results[i];
        const ocr = upload?.ocr ?? null;
        const isDashboard = ocr?.kind === 'dashboard';

        // Date priority. Receipt: the date printed on it → EXIF → filename.
        // Dashboard photo (nothing printed): EXIF → filename.
        let date = '';
        let dateSource: ReviewRow['dateSource'] = 'manual';
        const exifDate = toInputDateTime(upload?.takenAt ?? null);
        const ocrDate = !isDashboard ? toInputDateTime(ocr?.date ?? null) : '';
        if (ocrDate) {
          date = ocrDate;
          dateSource = 'ocr';
        } else if (exifDate) {
          date = exifDate;
          dateSource = upload?.dateSource ?? 'manual';
        }

        return {
          key: `${file.name}-${file.size}-${i}`,
          file,
          previewUrl: URL.createObjectURL(file),
          upload,
          include: !!upload?.attachmentId && !upload.isDuplicate && !upload.error,
          kind: isDashboard ? 'odometer' : 'expense',
          date,
          dateSource,
          category: 'fuel',
          ocrConfidence: ocr ? ocr.confidence : null,
          amount: !isDashboard && ocr?.total != null ? String(ocr.total) : '',
          merchant: ocr?.merchant ?? '',
          litres: ocr?.litres != null ? String(ocr.litres) : '',
          miles: isDashboard && ocr?.odometerMiles != null ? String(Math.round(ocr.odometerMiles)) : '',
          notes: isDashboard
            ? [ocr?.tripMiles != null ? `Trip ${ocr.tripMiles} mi` : null, ocr?.mpg != null ? `${ocr.mpg} MPG` : null].filter(Boolean).join(', ')
            : ocr?.fuelType ? `${ocr.fuelType}${ocr.pricePerLitre != null ? ` @ £${ocr.pricePerLitre}/L` : ''}` : '',
          isFullyBusiness: false,
          groupIndex: null,
          errors: []
        };
      });

      setRows(recompute(newRows));
      const failed = results.filter(r => r.error).length;
      if (failed > 0 && failed === results.length) {
        setGlobalError(results[0].error ?? t('expenses.bulkImport.errors.uploadFailed', 'Upload failed. Please try again.'));
      } else if (failed > 0) {
        setGlobalError(t('expenses.bulkImport.errors.partialUpload', { defaultValue: '{{failed}} of {{total}} photos failed to upload – see the red badges. The rest can still be saved.', failed, total: results.length }));
      }
      setStep('review');
    } catch (err) {
      console.error('Bulk receipt upload failed', err);
      setGlobalError(t('expenses.bulkImport.errors.uploadFailed', 'Upload failed. Please try again.'));
      setStep('pick');
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // ---------- Step 2: review ----------

  const updateRow = useCallback((key: string, patch: Partial<ReviewRow>) => {
    setRows(prev => recompute(prev.map(r => (r.key === key ? { ...r, ...patch, errors: [] } : r))));
  }, []);

  const setDate = useCallback((key: string, value: string) => {
    updateRow(key, { date: value, dateSource: 'manual' });
  }, [updateRow]);

  const validate = (row: ReviewRow): string[] => {
    const errors: string[] = [];
    if (!row.date) errors.push(t('expenses.bulkImport.errors.dateRequired', 'Date is required'));
    if (row.kind === 'expense') {
      const amount = Number(row.amount);
      if (row.amount.trim() === '' || isNaN(amount) || amount < 0) {
        errors.push(t('expenses.bulkImport.errors.amountRequired', 'Amount is required'));
      }
      if (row.category === 'fuel' && row.litres.trim() !== '' && (isNaN(Number(row.litres)) || Number(row.litres) < 0)) {
        errors.push(t('expenses.bulkImport.errors.litresInvalid', 'Litres must be a number'));
      }
      if (row.category === 'fuel' && row.miles.trim() !== '' && (isNaN(Number(row.miles)) || Number(row.miles) < 0)) {
        errors.push(t('expenses.bulkImport.errors.milesInvalid', 'Odometer must be a number'));
      }
    } else {
      const miles = Number(row.miles);
      if (row.miles.trim() === '' || isNaN(miles) || miles < 0) {
        errors.push(t('expenses.bulkImport.errors.milesRequired', 'Odometer reading is required'));
      }
    }
    return errors;
  };

  const includedRows = useMemo(() => rows.filter(r => r.include), [rows]);
  const missingDateCount = useMemo(() => includedRows.filter(r => !r.date).length, [includedRows]);

  // Rows needing attention (no date) first, then by date ascending, then undated-excluded at the end.
  const orderedRows = useMemo(() => {
    const score = (r: ReviewRow) => (!r.include ? 2 : r.date ? 1 : 0);
    return [...rows].sort((a, b) => {
      const s = score(a) - score(b);
      if (s !== 0) return s;
      if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
      return 0;
    });
  }, [rows]);

  const handleSave = useCallback(async () => {
    // Validate every included row and stop if anything is wrong.
    let hasErrors = false;
    const validated = rows.map(r => {
      if (!r.include) return r;
      const errors = validate(r);
      if (errors.length) hasErrors = true;
      return { ...r, errors };
    });
    setRows(validated);
    if (hasErrors) {
      setGlobalError(t('expenses.bulkImport.errors.fixRows', 'Please fix the highlighted rows before saving.'));
      return;
    }

    const toSave = validated.filter(r => r.include);
    if (toSave.length === 0) {
      setGlobalError(t('expenses.bulkImport.errors.nothingToSave', 'Nothing selected to save.'));
      return;
    }

    const items: BatchImportItem[] = toSave.map(r => {
      const isoDate = new Date(r.date).toISOString();
      if (r.kind === 'odometer') {
        return {
          kind: 'odometer',
          odometer: {
            vehicleId: vehicleId || null,
            date: isoDate,
            miles: Number(r.miles),
            source: 'fuelStop',
            photoAttachmentId: r.upload.attachmentId,
            dateSource: r.dateSource,
            notes: r.notes || null
          }
        };
      }
      const fuel = r.category === 'fuel' && (r.litres.trim() !== '' || r.miles.trim() !== '')
        ? {
            litres: r.litres.trim() !== '' ? Number(r.litres) : null,
            odometerMiles: r.miles.trim() !== '' ? Number(r.miles) : null
          }
        : null;
      return {
        kind: 'expense',
        expense: {
          vehicleId: vehicleId || null,
          category: r.category,
          date: isoDate,
          amount: Number(r.amount),
          currency: 'GBP',
          merchant: r.merchant || null,
          notes: r.notes || null,
          fuel,
          attachmentIds: r.upload.attachmentId ? [r.upload.attachmentId] : [],
          isFullyBusiness: r.isFullyBusiness,
          dateSource: r.dateSource
        }
      };
    });

    setStep('saving');
    setGlobalError(null);
    try {
      const result = await createExpensesBatch(items);
      setSaveResult(result);
      setStep('done');
      onImported?.(result);
    } catch (err) {
      console.error('Bulk receipt save failed', err);
      setGlobalError(t('expenses.bulkImport.errors.saveFailed', 'Saving failed. Please try again.'));
      setStep('review');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, vehicleId, onImported, t]);

  if (!isOpen) return null;

  const categoryLabel = (c: ExpenseCategory) => t(`expenses.categories.${c}`, c);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('expenses.bulkImport.title', 'Import Receipts')}
            </h2>
            {step === 'review' && (
              <p className="text-sm text-gray-500 mt-0.5">
                {t('expenses.bulkImport.summary', { defaultValue: '{{total}} photos uploaded, {{missing}} need a date',
                  total: rows.length,
                  missing: missingDateCount
                })}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={step === 'uploading' || step === 'saving'}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {globalError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {globalError}
            </div>
          )}

          {step === 'pick' && (
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-4 text-sm text-gray-600">
                {t('expenses.bulkImport.upload.dragDrop', 'Drag and drop receipt / odometer photos here, or')}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('expenses.bulkImport.upload.browse', 'browse to select photos')}
              </button>
              <p className="mt-3 text-xs text-gray-400">
                {t('expenses.bulkImport.upload.hint', 'Dates are read from the photo EXIF data or filename. Anything without a date will be flagged for you to fill in.')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
            </div>
          )}

          {step === 'uploading' && (
            <div className="py-16 text-center">
              <div className="mx-auto w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${uploadPercent}%` }} />
              </div>
              <p className="mt-4 text-sm text-gray-600">
                {t('expenses.bulkImport.uploading', { defaultValue: 'Uploading and reading photo dates… {{percent}}%', percent: uploadPercent })}
              </p>
            </div>
          )}

          {(step === 'review' || step === 'saving') && vehicles.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <label className="text-gray-600">{t('expenses.bulkImport.vehicle', 'Vehicle for these receipts')}</label>
              <select
                value={vehicleId}
                disabled={step === 'saving'}
                onChange={e => setVehicleId(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">{t('expenses.bulkImport.noVehicle', 'Not assigned')}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.registration}{v.make ? ` · ${v.make} ${v.model ?? ''}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {(step === 'review' || step === 'saving') && (
            <div className="space-y-3">
              {orderedRows.map(row => {
                const needsDate = row.include && !row.date;
                const disabled = !row.include || step === 'saving';
                return (
                  <div
                    key={row.key}
                    className={`rounded-lg border p-3 flex flex-col sm:flex-row gap-3 ${
                      row.errors.length
                        ? 'border-red-300 bg-red-50'
                        : needsDate
                          ? 'border-amber-300 bg-amber-50'
                          : row.include
                            ? 'border-gray-200 bg-white'
                            : 'border-gray-200 bg-gray-50 opacity-70'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 flex sm:flex-col items-center gap-2">
                      {row.file.type === 'application/pdf' ? (
                        <div className="w-24 h-24 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">PDF</div>
                      ) : (
                        <a href={row.previewUrl} target="_blank" rel="noreferrer">
                          <img src={row.previewUrl} alt={row.file.name} className="w-24 h-24 object-cover rounded" />
                        </a>
                      )}
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={!row.upload.attachmentId || step === 'saving'}
                          onChange={e => updateRow(row.key, { include: e.target.checked })}
                        />
                        {t('expenses.bulkImport.include', 'Include')}
                      </label>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                        <span className="font-medium text-gray-700 truncate max-w-[14rem]" title={row.file.name}>{row.file.name}</span>
                        <span className="text-gray-400">{formatBytes(row.file.size)}</span>
                        {row.upload.error && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">{row.upload.error}</span>
                        )}
                        {row.upload.isDuplicate && (
                          <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                            {t('expenses.bulkImport.duplicate', 'Duplicate – already uploaded')}
                          </span>
                        )}
                        {row.dateSource === 'exif' && row.date && (
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">EXIF</span>
                        )}
                        {row.dateSource === 'filename' && row.date && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {t('expenses.bulkImport.fromFilename', 'from filename')}
                          </span>
                        )}
                        {row.dateSource === 'ocr' && row.date && (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            {t('expenses.bulkImport.fromOcr', 'date from receipt (OCR)')}
                          </span>
                        )}
                        {row.upload.ocr?.kind === 'dashboard' && (
                          <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                            {t('expenses.bulkImport.dashboardDetected', 'Dashboard photo → odometer')}
                          </span>
                        )}
                        {row.ocrConfidence !== null && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600" title={t('expenses.bulkImport.ocrHint', 'Merchant / amount pre-filled by OCR – please check')}>
                            OCR {Math.round(row.ocrConfidence * 100)}%
                          </span>
                        )}
                        {needsDate && (
                          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                            {t('expenses.bulkImport.needsDate', 'No date found – please enter')}
                          </span>
                        )}
                        {row.groupIndex !== null && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                            {t('expenses.bulkImport.stop', { defaultValue: 'Stop #{{n}}', n: row.groupIndex })}
                          </span>
                        )}
                        {row.upload.ocr?.rawText && (
                          <button type="button" onClick={() => toggleOcrText(row.key)} className="text-gray-400 hover:text-gray-600 underline">
                            {ocrTextOpen.has(row.key) ? t('expenses.bulkImport.hideOcrText', 'hide OCR text') : t('expenses.bulkImport.showOcrText', 'show OCR text')}
                          </button>
                        )}
                      </div>
                      {ocrTextOpen.has(row.key) && row.upload.ocr?.rawText && (
                        <pre className="mb-2 max-h-40 overflow-auto rounded bg-gray-50 border border-gray-200 p-2 text-[11px] text-gray-600 whitespace-pre-wrap">{row.upload.ocr.rawText}</pre>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <label className="block">
                          <span className="block text-xs text-gray-500 mb-0.5">{t('expenses.fields.date', 'Date')}</span>
                          <input
                            type="datetime-local"
                            value={row.date}
                            disabled={disabled}
                            onChange={e => setDate(row.key, e.target.value)}
                            className={`w-full rounded border px-2 py-1 text-sm ${needsDate ? 'border-amber-400' : 'border-gray-300'}`}
                          />
                        </label>

                        <label className="block">
                          <span className="block text-xs text-gray-500 mb-0.5">{t('expenses.fields.type', 'Type')}</span>
                          <select
                            value={row.kind === 'odometer' ? '__odometer' : row.category}
                            disabled={disabled}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === '__odometer') updateRow(row.key, { kind: 'odometer' });
                              else updateRow(row.key, { kind: 'expense', category: v as ExpenseCategory });
                            }}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          >
                            {EXPENSE_CATEGORIES.map(c => (
                              <option key={c} value={c}>{categoryLabel(c)}</option>
                            ))}
                            <option value="__odometer">📷 {t('expenses.odometerReading', 'Odometer reading')}</option>
                          </select>
                        </label>

                        {row.kind === 'expense' ? (
                          <>
                            <label className="block">
                              <span className="block text-xs text-gray-500 mb-0.5">{t('expenses.fields.amount', 'Amount (£)')}</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                value={row.amount}
                                disabled={disabled}
                                onChange={e => updateRow(row.key, { amount: e.target.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                            </label>
                            <label className="block">
                              <span className="block text-xs text-gray-500 mb-0.5">{t('expenses.fields.merchant', 'Merchant')}</span>
                              <input
                                type="text"
                                value={row.merchant}
                                disabled={disabled}
                                onChange={e => updateRow(row.key, { merchant: e.target.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                            </label>
                            {row.category === 'fuel' && (
                              <>
                                <label className="block">
                                  <span className="block text-xs text-gray-500 mb-0.5">{t('expenses.fields.litres', 'Litres')}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    inputMode="decimal"
                                    value={row.litres}
                                    disabled={disabled}
                                    onChange={e => updateRow(row.key, { litres: e.target.value })}
                                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="block text-xs text-gray-500 mb-0.5">
                                    {t('expenses.fields.odometerAtFill', 'Odometer at fill (mi)')}
                                    {row.groupIndex !== null && !row.miles && (
                                      <span className="ml-1 text-amber-600">{t('expenses.bulkImport.setDashboardHint', '(set the dashboard photo in this stop to "Odometer reading")')}</span>
                                    )}
                                  </span>
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    inputMode="numeric"
                                    value={row.miles}
                                    disabled={disabled}
                                    onChange={e => updateRow(row.key, { miles: e.target.value })}
                                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                  />
                                </label>
                              </>
                            )}
                            <label className="flex items-center gap-2 text-xs text-gray-600 md:col-span-2">
                              <input
                                type="checkbox"
                                checked={row.isFullyBusiness}
                                disabled={disabled}
                                onChange={e => updateRow(row.key, { isFullyBusiness: e.target.checked })}
                              />
                              {t('expenses.fields.fullyBusiness', '100% business (do not apportion)')}
                            </label>
                          </>
                        ) : (
                          <>
                            <label className="block">
                              <span className="block text-xs text-gray-500 mb-0.5">{t('expenses.fields.odometerMiles', 'Odometer (miles)')}</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                inputMode="numeric"
                                value={row.miles}
                                disabled={disabled}
                                onChange={e => updateRow(row.key, { miles: e.target.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                            </label>
                            <label className="block">
                              <span className="block text-xs text-gray-500 mb-0.5">{t('expenses.fields.notes', 'Notes')}</span>
                              <input
                                type="text"
                                value={row.notes}
                                disabled={disabled}
                                onChange={e => updateRow(row.key, { notes: e.target.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                              />
                            </label>
                          </>
                        )}
                      </div>

                      {row.errors.length > 0 && (
                        <ul className="mt-2 text-xs text-red-700 list-disc list-inside">
                          {row.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 'done' && saveResult && (
            <div className="py-10 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-4 text-lg font-medium text-gray-900">
                {t('expenses.bulkImport.done', { defaultValue: '{{created}} saved, {{failed}} failed',
                  created: saveResult.created,
                  failed: saveResult.failed
                })}
              </p>
              {saveResult.failed > 0 && (
                <ul className="mt-3 text-sm text-red-700 text-left max-w-md mx-auto list-disc list-inside">
                  {saveResult.results.filter(r => r.error).map(r => (
                    <li key={r.index}>#{r.index + 1}: {r.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {step === 'review' && t('expenses.bulkImport.selected', { defaultValue: '{{count}} selected', count: includedRows.length })}
          </div>
          <div className="flex gap-2">
            {step === 'review' && (
              <button
                onClick={reset}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {t('expenses.bulkImport.startOver', 'Start over')}
              </button>
            )}
            {(step === 'review' || step === 'saving') && (
              <button
                onClick={handleSave}
                disabled={step === 'saving' || includedRows.length === 0}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {step === 'saving'
                  ? t('expenses.bulkImport.saving', 'Saving…')
                  : t('expenses.bulkImport.saveAll', { defaultValue: 'Save all ({{count}})', count: includedRows.length })}
              </button>
            )}
            {(step === 'pick' || step === 'done') && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm rounded-md bg-gray-800 text-white hover:bg-gray-900"
              >
                {t('common.close', 'Close')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkReceiptImport;
