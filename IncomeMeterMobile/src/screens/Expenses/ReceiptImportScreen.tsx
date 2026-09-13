import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera, Asset } from 'react-native-image-picker';
import { format, isValid, parse } from 'date-fns';
import {
  ExpensesApiService,
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  AttachmentUploadResult,
  BatchImportItem,
  BatchImportResult,
  DateSource,
  ExpenseCategory,
  Vehicle,
} from '../../services/expensesApi';

const DATE_FORMAT = 'yyyy-MM-dd HH:mm';
/** Photos within this window are shown as the same "stop" (receipt + odometer). */
const GROUP_WINDOW_MS = 10 * 60 * 1000;

type RowKind = 'expense' | 'odometer';

interface ReviewRow {
  key: string;
  asset: Asset;
  upload: AttachmentUploadResult;
  include: boolean;
  kind: RowKind;
  date: string; // "yyyy-MM-dd HH:mm" or ""
  dateSource: DateSource;
  category: ExpenseCategory;
  amount: string;
  merchant: string;
  litres: string;
  miles: string;
  notes: string;
  ocrConfidence: number | null;
  groupIndex: number | null;
  error: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onImported?: (result: BatchImportResult) => void;
}

const toDisplayDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return isValid(d) ? format(d, DATE_FORMAT) : '';
};

const parseDisplayDate = (value: string): Date | null => {
  if (!value.trim()) return null;
  const d = parse(value.trim(), DATE_FORMAT, new Date());
  if (isValid(d)) return d;
  const dateOnly = parse(value.trim(), 'yyyy-MM-dd', new Date());
  return isValid(dateOnly) ? dateOnly : null;
};

const assignGroups = (rows: ReviewRow[]): ReviewRow[] => {
  const dated = rows
    .map(r => ({ key: r.key, time: parseDisplayDate(r.date)?.getTime() ?? null }))
    .filter((x): x is { key: string; time: number } => x.time !== null)
    .sort((a, b) => a.time - b.time);
  let group = 0;
  let last: number | null = null;
  const groupByKey = new Map<string, number>();
  const size = new Map<number, number>();
  for (const d of dated) {
    if (last === null || d.time - last > GROUP_WINDOW_MS) group += 1;
    groupByKey.set(d.key, group);
    size.set(group, (size.get(group) ?? 0) + 1);
    last = d.time;
  }
  return rows.map(r => {
    const g = groupByKey.get(r.key);
    return { ...r, groupIndex: g !== undefined && (size.get(g) ?? 0) > 1 ? g : null };
  });
};

/** Copy the dashboard odometer figure onto the fuel receipt from the same stop. */
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

const ReceiptImportScreen: React.FC<Props> = ({ visible, onClose, onImported }) => {
  const [step, setStep] = useState<'pick' | 'uploading' | 'review' | 'saving' | 'done'>('pick');
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchImportResult | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null); // row key with the category picker open

  useEffect(() => {
    if (!visible) return;
    ExpensesApiService.getVehicles()
      .then(list => {
        setVehicles(list);
        if (list.length === 1) setVehicleId(list[0].id);
      })
      .catch(() => setVehicles([]));
  }, [visible]);

  const reset = useCallback(() => {
    setRows([]);
    setStep('pick');
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'uploading' || step === 'saving') return;
    reset();
    onClose();
  }, [step, reset, onClose]);

  // ---------- pick + upload ----------

  const uploadAssets = useCallback(async (assets: Asset[]) => {
    if (assets.length === 0) return;
    setError(null);
    setStep('uploading');
    setProgress(0);
    try {
      const results = await ExpensesApiService.uploadAttachments(assets, setProgress);
      const newRows: ReviewRow[] = assets.map((asset, i) => {
        const upload = results[i];
        const ocr = upload?.ocr ?? null;
        const isDashboard = ocr?.kind === 'dashboard';

        // Receipt: printed date → EXIF → filename. Dashboard photo: EXIF → filename.
        let date = '';
        let dateSource: DateSource = 'manual';
        const exifDate = toDisplayDate(upload?.takenAt ?? null);
        const ocrDate = !isDashboard ? toDisplayDate(ocr?.date ?? null) : '';
        if (ocrDate) {
          date = ocrDate;
          dateSource = 'ocr';
        } else if (exifDate) {
          date = exifDate;
          dateSource = upload?.dateSource ?? 'manual';
        }

        return {
          key: `${asset.uri}-${i}`,
          asset,
          upload,
          include: !!upload?.attachmentId && !upload.isDuplicate && !upload.error,
          kind: isDashboard ? 'odometer' : 'expense',
          date,
          dateSource,
          category: 'fuel',
          amount: !isDashboard && ocr?.total != null ? String(ocr.total) : '',
          merchant: ocr?.merchant ?? '',
          litres: ocr?.litres != null ? String(ocr.litres) : '',
          miles: isDashboard && ocr?.odometerMiles != null ? String(Math.round(ocr.odometerMiles)) : '',
          notes: isDashboard
            ? [ocr?.tripMiles != null ? `Trip ${ocr.tripMiles} mi` : null, ocr?.mpg != null ? `${ocr.mpg} MPG` : null].filter(Boolean).join(', ')
            : ocr?.fuelType ? `${ocr.fuelType}${ocr.pricePerLitre != null ? ` @ £${ocr.pricePerLitre}/L` : ''}` : '',
          ocrConfidence: ocr ? ocr.confidence : null,
          groupIndex: null,
          error: null,
        };
      });
      setRows(pairOdometerWithReceipts(assignGroups(newRows)));
      setStep('review');
    } catch (err) {
      console.error('Receipt upload failed', err);
      setError('Upload failed. Check your connection and try again.');
      setStep('pick');
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 0, quality: 0.9 });
    if (res.didCancel || !res.assets) return;
    if (res.errorCode) {
      setError(res.errorMessage ?? 'Could not open the photo library.');
      return;
    }
    uploadAssets(res.assets);
  }, [uploadAssets]);

  const takePhoto = useCallback(async () => {
    const res = await launchCamera({ mediaType: 'photo', quality: 0.9, saveToPhotos: true });
    if (res.didCancel || !res.assets) return;
    if (res.errorCode) {
      setError(res.errorMessage ?? 'Could not open the camera.');
      return;
    }
    uploadAssets(res.assets);
  }, [uploadAssets]);

  // ---------- review ----------

  const updateRow = useCallback((key: string, patch: Partial<ReviewRow>) => {
    // Re-derive stop groups and odometer pairing on every edit (only fills EMPTY fuel odometer fields).
    setRows(prev => pairOdometerWithReceipts(assignGroups(prev.map(r => (r.key === key ? { ...r, ...patch, error: null } : r)))));
  }, []);

  const included = useMemo(() => rows.filter(r => r.include), [rows]);
  const missingDates = useMemo(() => included.filter(r => !parseDisplayDate(r.date)).length, [included]);

  const ordered = useMemo(() => {
    const score = (r: ReviewRow) => (!r.include ? 2 : parseDisplayDate(r.date) ? 1 : 0);
    return [...rows].sort((a, b) => {
      const s = score(a) - score(b);
      if (s !== 0) return s;
      const ta = parseDisplayDate(a.date)?.getTime() ?? 0;
      const tb = parseDisplayDate(b.date)?.getTime() ?? 0;
      return ta - tb;
    });
  }, [rows]);

  const validate = (r: ReviewRow): string | null => {
    if (!parseDisplayDate(r.date)) return 'Date is required (yyyy-MM-dd HH:mm)';
    if (r.kind === 'expense') {
      const n = Number(r.amount);
      if (r.amount.trim() === '' || isNaN(n) || n < 0) return 'Amount is required';
    } else {
      const n = Number(r.miles);
      if (r.miles.trim() === '' || isNaN(n) || n < 0) return 'Odometer reading is required';
    }
    return null;
  };

  const handleSave = useCallback(async () => {
    let bad = false;
    const validated = rows.map(r => {
      if (!r.include) return r;
      const e = validate(r);
      if (e) bad = true;
      return { ...r, error: e };
    });
    setRows(validated);
    if (bad) {
      setError('Please fix the highlighted items.');
      return;
    }
    const toSave = validated.filter(r => r.include);
    if (toSave.length === 0) {
      setError('Nothing selected.');
      return;
    }

    const items: BatchImportItem[] = toSave.map(r => {
      const iso = parseDisplayDate(r.date)!.toISOString();
      if (r.kind === 'odometer') {
        return {
          kind: 'odometer',
          odometer: {
            vehicleId,
            date: iso,
            miles: Number(r.miles),
            source: 'fuelStop',
            photoAttachmentId: r.upload.attachmentId,
            dateSource: r.dateSource,
            notes: r.notes || null,
          },
        };
      }
      const fuel = r.category === 'fuel' && (r.litres.trim() || r.miles.trim())
        ? { litres: r.litres.trim() ? Number(r.litres) : null, odometerMiles: r.miles.trim() ? Number(r.miles) : null }
        : null;
      return {
        kind: 'expense',
        expense: {
          vehicleId,
          category: r.category,
          date: iso,
          amount: Number(r.amount),
          currency: 'GBP',
          merchant: r.merchant || null,
          notes: r.notes || null,
          fuel,
          attachmentIds: r.upload.attachmentId ? [r.upload.attachmentId] : [],
          isFullyBusiness: false,
          dateSource: r.dateSource,
        },
      };
    });

    setStep('saving');
    setError(null);
    try {
      const res = await ExpensesApiService.createBatch(items);
      setResult(res);
      setStep('done');
      onImported?.(res);
    } catch (err) {
      console.error('Receipt save failed', err);
      setError('Saving failed. Please try again.');
      setStep('review');
    }
  }, [rows, vehicleId, onImported]);

  // ---------- render ----------

  const renderRow = ({ item: row }: { item: ReviewRow }) => {
    const needsDate = row.include && !parseDisplayDate(row.date);
    const disabled = !row.include || step === 'saving';
    return (
      <View style={[styles.card, row.error ? styles.cardError : needsDate ? styles.cardWarn : null, !row.include && styles.cardExcluded]}>
        <View style={styles.cardTop}>
          <Image source={{ uri: row.asset.uri }} style={styles.thumb} />
          <View style={styles.cardMeta}>
            <Text style={styles.fileName} numberOfLines={1}>{row.asset.fileName ?? 'photo'}</Text>
            <View style={styles.badges}>
              {row.upload.error && <Text style={[styles.badge, styles.badgeError]}>{row.upload.error}</Text>}
              {row.upload.isDuplicate && <Text style={[styles.badge, styles.badgeGrey]}>Duplicate</Text>}
              {row.dateSource === 'exif' && row.date ? <Text style={[styles.badge, styles.badgeGreen]}>EXIF</Text> : null}
              {row.dateSource === 'filename' && row.date ? <Text style={[styles.badge, styles.badgeBlue]}>filename</Text> : null}
              {row.dateSource === 'ocr' && row.date ? <Text style={[styles.badge, styles.badgeIndigo]}>OCR date</Text> : null}
              {row.upload.ocr?.kind === 'dashboard' && <Text style={[styles.badge, styles.badgeTeal]}>Dashboard → odometer</Text>}
              {row.ocrConfidence !== null && <Text style={[styles.badge, styles.badgeIndigo]}>OCR {Math.round(row.ocrConfidence * 100)}%</Text>}
              {needsDate && <Text style={[styles.badge, styles.badgeAmber]}>No date – enter</Text>}
              {row.groupIndex !== null && <Text style={[styles.badge, styles.badgePurple]}>Stop #{row.groupIndex}</Text>}
            </View>
          </View>
          <Switch
            value={row.include}
            disabled={!row.upload.attachmentId || step === 'saving'}
            onValueChange={v => updateRow(row.key, { include: v })}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={[styles.input, needsDate && styles.inputWarn]}
              value={row.date}
              editable={!disabled}
              placeholder="yyyy-MM-dd HH:mm"
              onChangeText={v => updateRow(row.key, { date: v, dateSource: 'manual' })}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <TouchableOpacity style={styles.input} disabled={disabled} onPress={() => setPickerFor(row.key)}>
              <Text>{row.kind === 'odometer' ? '📷 Odometer reading' : CATEGORY_LABELS[row.category]}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {row.kind === 'expense' ? (
          <>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.label}>Amount (£)</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" value={row.amount} editable={!disabled}
                  onChangeText={v => updateRow(row.key, { amount: v })} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Merchant</Text>
                <TextInput style={styles.input} value={row.merchant} editable={!disabled}
                  onChangeText={v => updateRow(row.key, { merchant: v })} />
              </View>
            </View>
            {row.category === 'fuel' && (
              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Litres</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" value={row.litres} editable={!disabled}
                    onChangeText={v => updateRow(row.key, { litres: v })} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Odometer at fill (mi)</Text>
                  <TextInput style={styles.input} keyboardType="number-pad" value={row.miles} editable={!disabled}
                    onChangeText={v => updateRow(row.key, { miles: v })} />
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Odometer (miles)</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={row.miles} editable={!disabled}
                onChangeText={v => updateRow(row.key, { miles: v })} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput style={styles.input} value={row.notes} editable={!disabled}
                onChangeText={v => updateRow(row.key, { notes: v })} />
            </View>
          </View>
        )}

        {row.error && <Text style={styles.rowError}>{row.error}</Text>}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Import receipts</Text>
            {step === 'review' && (
              <Text style={styles.subtitle}>{rows.length} photos · {missingDates} need a date</Text>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} disabled={step === 'uploading' || step === 'saving'}>
            <Icon name="close" size={26} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {step === 'pick' && (
          <View style={styles.pick}>
            <Icon name="receipt-long" size={64} color="#9CA3AF" />
            <Text style={styles.pickText}>
              Select all your fuel receipts and odometer photos at once. Dates are read from each photo; anything without a date is flagged for you.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={pickFromLibrary}>
              <Icon name="photo-library" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>Choose from gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={takePhoto}>
              <Icon name="photo-camera" size={20} color="#6366F1" />
              <Text style={styles.secondaryButtonText}>Take a photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'uploading' && (
          <View style={styles.pick}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.pickText}>Uploading and reading photo dates… {progress}%</Text>
          </View>
        )}

        {(step === 'review' || step === 'saving') && (
          <>
            {vehicles.length > 0 && (
              <View style={styles.vehicleRow}>
                <Text style={styles.label}>Vehicle</Text>
                <View style={styles.chips}>
                  <TouchableOpacity style={[styles.chip, vehicleId === null && styles.chipActive]} onPress={() => setVehicleId(null)}>
                    <Text style={[styles.chipText, vehicleId === null && styles.chipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {vehicles.map(v => (
                    <TouchableOpacity key={v.id} style={[styles.chip, vehicleId === v.id && styles.chipActive]} onPress={() => setVehicleId(v.id)}>
                      <Text style={[styles.chipText, vehicleId === v.id && styles.chipTextActive]}>{v.registration}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <FlatList
              data={ordered}
              keyExtractor={r => r.key}
              renderItem={renderRow}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
            />
            <View style={styles.footer}>
              <TouchableOpacity style={styles.secondaryButton} onPress={reset} disabled={step === 'saving'}>
                <Text style={styles.secondaryButtonText}>Start over</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, (step === 'saving' || included.length === 0) && styles.disabled]}
                onPress={handleSave}
                disabled={step === 'saving' || included.length === 0}
              >
                {step === 'saving' ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={styles.primaryButtonText}>Save all ({included.length})</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 'done' && result && (
          <View style={styles.pick}>
            <Icon name="check-circle" size={64} color="#10B981" />
            <Text style={styles.doneText}>{result.created} saved{result.failed > 0 ? `, ${result.failed} failed` : ''}</Text>
            {result.results.filter(r => r.error).map(r => (
              <Text key={r.index} style={styles.rowError}>#{r.index + 1}: {r.error}</Text>
            ))}
            <TouchableOpacity style={styles.primaryButton} onPress={handleClose}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Category picker */}
        <Modal visible={pickerFor !== null} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
          <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setPickerFor(null)}>
            <View style={styles.pickerSheet}>
              {EXPENSE_CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={styles.pickerItem} onPress={() => { if (pickerFor) updateRow(pickerFor, { kind: 'expense', category: c }); setPickerFor(null); }}>
                  <Text style={styles.pickerText}>{CATEGORY_LABELS[c]}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.pickerItem, styles.pickerItemLast]} onPress={() => { if (pickerFor) updateRow(pickerFor, { kind: 'odometer' }); setPickerFor(null); }}>
                <Text style={styles.pickerText}>📷 Odometer reading</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  error: { margin: 12, padding: 10, backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 13 },
  pick: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  pickText: { textAlign: 'center', color: '#6B7280', fontSize: 14, lineHeight: 20 },
  doneText: { fontSize: 18, fontWeight: '600', color: '#111827' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, minWidth: 140, justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  secondaryButtonText: { color: '#6366F1', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  vehicleRow: { paddingHorizontal: 12, paddingTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFF' },
  chipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  list: { padding: 12, gap: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardWarn: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  cardError: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  cardExcluded: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  thumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#E5E7EB' },
  cardMeta: { flex: 1 },
  fileName: { fontSize: 12, color: '#374151', fontWeight: '500' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  badge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  badgeGreen: { backgroundColor: '#D1FAE5', color: '#065F46' },
  badgeBlue: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  badgeIndigo: { backgroundColor: '#E0E7FF', color: '#3730A3' },
  badgeAmber: { backgroundColor: '#FDE68A', color: '#78350F' },
  badgePurple: { backgroundColor: '#EDE9FE', color: '#5B21B6' },
  badgeGrey: { backgroundColor: '#E5E7EB', color: '#374151' },
  badgeTeal: { backgroundColor: '#CCFBF1', color: '#115E59' },
  badgeError: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  fieldRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  field: { flex: 1 },
  label: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7, fontSize: 14, backgroundColor: '#FFF', color: '#111827', minHeight: 36, justifyContent: 'center' },
  inputWarn: { borderColor: '#F59E0B' },
  rowError: { color: '#B91C1C', fontSize: 12, marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingBottom: 24 },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerItemLast: { borderBottomWidth: 0 },
  pickerText: { fontSize: 16, color: '#111827' },
});

export default ReceiptImportScreen;
