import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { newId, nowIso } from '../../db/database';
import { getById, remove, save } from '../../db/repo';
import { DateSource, OdometerReading, OdometerSource } from '../../domain/types';
import { defaultVehicleId } from '../../services/data';
import { readAttachmentNow } from '../../sync/sync';
import { Button, Chips, DateTimeField, Input, NumberInput, Screen } from '../../ui/components';
import { numText, parseNum } from '../../ui/format';
import { useCollection, useSettings } from '../../ui/hooks';
import { useT } from '../../ui/i18n';
import { PhotoPicker } from '../../ui/PhotoPicker';
import { VehiclePicker } from '../../ui/pickers';

const SOURCES: OdometerSource[] = ['manual', 'fuelStop', 'taxYearStart', 'taxYearEnd'];

export default function EditOdometerScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const settings = useSettings();
  const existing = id ? getById('odometerReadings', id) : null;
  const vehicles = useCollection('vehicles');

  const [date, setDate] = useState<string | null>(existing?.date ?? new Date().toISOString());
  const [dateSource, setDateSource] = useState<DateSource>(existing?.dateSource ?? 'manual');
  const [miles, setMiles] = useState(numText(existing?.miles));
  const [source, setSource] = useState<OdometerSource>(existing?.source ?? 'manual');
  const [vehicleId, setVehicleId] = useState<string | null>(existing ? existing.vehicleId : defaultVehicleId(new Date().toISOString()));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photos, setPhotos] = useState<string[]>(existing?.photoAttachmentId ? [existing.photoAttachmentId] : []);
  const [reading, setReading] = useState(false);

  const readDashboard = async () => {
    setReading(true);
    try {
      const { id: serverId, ocr } = await readAttachmentNow(photos[0]);
      setPhotos([serverId]);
      if (ocr?.odometerMiles != null) setMiles(String(Math.round(ocr.odometerMiles)));
    } catch (e) {
      Alert.alert(t('readReceipt'), e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  const submit = () => {
    const value = parseNum(miles);
    if (value == null || value < 0 || !Number.isInteger(value)) return Alert.alert(t('miles'), t('required'));
    if (!date) return;
    const reading: OdometerReading = {
      id: existing?.id ?? newId(),
      vehicleId, date, miles: value, source, photoAttachmentId: photos[0] ?? null, dateSource,
      notes: notes.trim() || null, createdAt: existing?.createdAt ?? nowIso(), updatedAt: nowIso(),
    };
    save('odometerReadings', reading);
    router.back();
  };

  const del = () =>
    Alert.alert(t('confirmDelete'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { remove('odometerReadings', existing!.id); router.back(); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('edit') : t('newReading') }} />
      <PhotoPicker ids={photos} onChange={setPhotos} max={1} onAdded={(p) => { if (p.takenAt) { setDate(p.takenAt); setDateSource('exif'); } }} />
      {photos.length > 0 && settings.syncEnabled ? <Button small kind="secondary" title={t('readReceipt')} onPress={readDashboard} busy={reading} /> : null}
      <DateTimeField label={t('date')} value={date} onChange={(d) => { setDate(d); setDateSource('manual'); }} mode="date" />
      <NumberInput label={t('miles')} value={miles} onChange={setMiles} decimal={false} />
      <Chips label={t('source')} options={SOURCES.map((s) => ({ value: s, label: t(s) }))} value={source} onChange={setSource} />
      <VehiclePicker vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
      <Input label={t('notes')} value={notes} onChangeText={setNotes} multiline />
      <Button title={t('save')} onPress={submit} />
      {existing ? <Button kind="danger" title={t('delete')} onPress={del} /> : null}
    </Screen>
  );
}
