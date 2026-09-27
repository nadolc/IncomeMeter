import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { newId, nowIso } from '../../db/database';
import { getById, remove, save } from '../../db/repo';
import { DateSource, EXPENSE_CATEGORIES, Expense, ExpenseCategory } from '../../domain/types';
import { defaultVehicleId } from '../../services/data';
import { readAttachmentNow } from '../../sync/sync';
import { Banner, Button, Chips, DateTimeField, Input, NumberInput, Row, Screen, Toggle } from '../../ui/components';
import { numText, parseNum } from '../../ui/format';
import { useCollection, useSettings } from '../../ui/hooks';
import { useT } from '../../ui/i18n';
import { PhotoPicker } from '../../ui/PhotoPicker';
import { VehiclePicker } from '../../ui/pickers';

export default function EditExpenseScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const settings = useSettings();
  const existing = id ? getById('expenses', id) : null;
  const vehicles = useCollection('vehicles');

  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'fuel');
  const [date, setDate] = useState<string | null>(existing?.date ?? new Date().toISOString());
  const [dateSource, setDateSource] = useState<DateSource>(existing?.dateSource ?? 'manual');
  const [amount, setAmount] = useState(numText(existing?.amount));
  const [merchant, setMerchant] = useState(existing?.merchant ?? '');
  const [litres, setLitres] = useState(numText(existing?.fuel?.litres));
  const [odometer, setOdometer] = useState(numText(existing?.fuel?.odometerMiles));
  const [vehicleId, setVehicleId] = useState<string | null>(existing ? existing.vehicleId : defaultVehicleId(new Date().toISOString()));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [fullyBusiness, setFullyBusiness] = useState(existing?.isFullyBusiness ?? false);
  const [photos, setPhotos] = useState<string[]>(existing?.attachmentIds ?? []);
  const [reading, setReading] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  const readReceipt = async () => {
    const last = photos[photos.length - 1];
    if (!last) return;
    setReading(true);
    try {
      const { id: serverId, ocr } = await readAttachmentNow(last);
      setPhotos(photos.map((p) => (p === last ? serverId : p)));
      if (!ocr) { setOcrNote('—'); return; }
      if (ocr.total != null) setAmount(String(ocr.total));
      if (ocr.merchant) setMerchant(ocr.merchant);
      if (ocr.date) { setDate(new Date(ocr.date).toISOString()); setDateSource('ocr'); }
      if (ocr.litres != null) { setLitres(String(ocr.litres)); setCategory('fuel'); }
      if (ocr.odometerMiles != null) setOdometer(String(ocr.odometerMiles));
      setOcrNote([ocr.merchant, ocr.total, ocr.litres && `${ocr.litres} L`, ocr.odometerMiles && `${ocr.odometerMiles} mi`].filter(Boolean).join(' · '));
    } catch (e) {
      Alert.alert(t('readReceipt'), e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  const submit = () => {
    const value = parseNum(amount);
    if (value == null || value < 0) return Alert.alert(t('amount'), t('required'));
    if (!date) return;
    const expense: Expense = {
      id: existing?.id ?? newId(),
      vehicleId,
      category,
      date,
      amount: value,
      currency: existing?.currency ?? settings.currencyCode,
      merchant: merchant.trim() || null,
      notes: notes.trim() || null,
      fuel: category === 'fuel' ? { litres: parseNum(litres), odometerMiles: parseNum(odometer) } : null,
      attachmentIds: photos,
      isFullyBusiness: fullyBusiness,
      status: 'confirmed',
      dateSource,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    save('expenses', expense);
    router.back();
  };

  const del = () =>
    Alert.alert(t('confirmDelete'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { remove('expenses', existing!.id); router.back(); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('edit') : t('newExpense') }} />
      <PhotoPicker ids={photos} onChange={setPhotos} onAdded={(p) => { if (p.takenAt && !existing) { setDate(p.takenAt); setDateSource('exif'); } }} />
      {photos.length > 0 && settings.syncEnabled ? <Button small kind="secondary" title={t('readReceipt')} onPress={readReceipt} busy={reading} /> : null}
      {ocrNote ? <Banner kind="info">OCR: {ocrNote}</Banner> : null}
      <Chips label={t('category')} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(c) }))} value={category} onChange={setCategory} />
      <DateTimeField label={t('date')} value={date} onChange={(d) => { setDate(d); setDateSource('manual'); }} mode="date" />
      <NumberInput label={`${t('amount')} (${existing?.currency ?? settings.currencyCode})`} value={amount} onChange={setAmount} />
      <Input label={t('merchant')} value={merchant} onChangeText={setMerchant} />
      {category === 'fuel' ? (
        <Row style={{ gap: 8 }}>
          <View style={{ flex: 1 }}><NumberInput label={t('litres')} value={litres} onChange={setLitres} /></View>
          <View style={{ flex: 1 }}><NumberInput label={t('odometerOnReceipt')} value={odometer} onChange={setOdometer} decimal={false} /></View>
        </Row>
      ) : null}
      <VehiclePicker vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
      <Toggle label={t('fullyBusiness')} value={fullyBusiness} onChange={setFullyBusiness} />
      <Input label={t('notes')} value={notes} onChangeText={setNotes} multiline />
      <Button title={t('save')} onPress={submit} />
      {existing ? <Button kind="danger" title={t('delete')} onPress={del} /> : null}
    </Screen>
  );
}
