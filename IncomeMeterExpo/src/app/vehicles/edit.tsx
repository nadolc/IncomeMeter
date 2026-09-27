import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { getById, remove, save } from '../../db/repo';
import { recentTaxYears, taxYearLabel } from '../../domain/taxYear';
import { ClaimMethod, FinanceType, FuelType, Vehicle, VehicleType } from '../../domain/types';
import { newVehicle } from '../../services/data';
import { lookupVehicle } from '../../sync/api';
import { Banner, Button, Chips, DateTimeField, Input, NumberInput, Row, Screen, Toggle } from '../../ui/components';
import { numText, parseNum } from '../../ui/format';
import { useSettings } from '../../ui/hooks';
import { useT } from '../../ui/i18n';

export default function EditVehicleScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { syncEnabled } = useSettings();
  const existing = id ? getById('vehicles', id) : null;
  const [v, setV] = useState<Vehicle>(existing ?? newVehicle());
  const [co2, setCo2] = useState(numText(v.co2GPerKm));
  const [price, setPrice] = useState(numText(v.purchasePrice));
  const [proceeds, setProceeds] = useState(numText(v.disposalProceeds));
  const [pool, setPool] = useState(numText(v.capitalAllowancePoolBroughtForward));
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const set = (patch: Partial<Vehicle>) => setV({ ...v, ...patch });

  const years = recentTaxYears(new Date(), 8);
  const yearOptions = [{ value: '', label: t('none') }, ...years.map((y) => ({ value: String(y), label: taxYearLabel(y) }))];

  const lookup = async () => {
    setLookupBusy(true);
    try {
      const r = await lookupVehicle(v.registration);
      setV({
        ...v,
        registration: r.registration ?? v.registration,
        make: r.make ?? v.make,
        model: r.model ?? v.model,
        fuelType: (r.fuelType as FuelType) ?? v.fuelType,
        vehicleType: (r.vehicleType as VehicleType) ?? v.vehicleType,
        co2GPerKm: r.co2GPerKm ?? v.co2GPerKm,
        purchaseDate: v.purchaseDate ?? r.firstUsedDate ?? null,
      });
      if (r.co2GPerKm != null) setCo2(String(r.co2GPerKm));
      const mot = r.motTests?.[0];
      setLookupNote([r.make, r.model, r.colour, r.co2GPerKm != null && `${r.co2GPerKm} g/km`,
        mot?.odometerValue && `MOT ${mot.completedDate?.slice(0, 10)}: ${mot.odometerValue} ${mot.odometerUnit ?? ''}`, ...(r.warnings ?? [])]
        .filter(Boolean).join(' · '));
    } catch (e) {
      Alert.alert(t('lookupDvla'), e instanceof Error ? e.message : String(e));
    } finally {
      setLookupBusy(false);
    }
  };

  const submit = () => {
    const reg = v.registration.trim().toUpperCase();
    if (!reg || reg.length > 16) return Alert.alert(t('registration'), t('required'));
    save('vehicles', {
      ...v,
      registration: reg,
      make: v.make?.trim() || null,
      model: v.model?.trim() || null,
      co2GPerKm: parseNum(co2) == null ? null : Math.round(parseNum(co2)!),
      purchasePrice: parseNum(price),
      disposalProceeds: parseNum(proceeds),
      capitalAllowancePoolBroughtForward: parseNum(pool),
      // A vehicle that has been sold is no longer in use.
      isActive: v.disposalDate ? false : v.isActive,
    });
    router.back();
  };

  const del = () =>
    Alert.alert(t('confirmDelete'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { remove('vehicles', v.id); router.back(); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? v.registration : t('newVehicle') }} />
      <Row style={{ gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input label={t('registration')} value={v.registration} autoCapitalize="characters" maxLength={16} onChangeText={(registration) => set({ registration })} />
        </View>
        {syncEnabled ? <Button small kind="secondary" title={t('lookupDvla')} onPress={lookup} busy={lookupBusy} disabled={!v.registration.trim()} style={{ marginBottom: 10 }} /> : null}
      </Row>
      {lookupNote ? <Banner kind="info">{lookupNote}</Banner> : null}
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}><Input label={t('make')} value={v.make ?? ''} onChangeText={(make) => set({ make })} /></View>
        <View style={{ flex: 1 }}><Input label={t('model')} value={v.model ?? ''} onChangeText={(model) => set({ model })} /></View>
      </Row>
      <Chips label={t('vehicleType')} options={(['car', 'van', 'motorcycle'] as VehicleType[]).map((x) => ({ value: x, label: t(x) }))}
        value={v.vehicleType} onChange={(vehicleType) => set({ vehicleType })} />
      <Chips label={t('fuelType')} options={(['petrol', 'diesel', 'hybrid', 'electric', 'other'] as FuelType[]).map((x) => ({ value: x, label: t(x) }))}
        value={v.fuelType} onChange={(fuelType) => set({ fuelType })} />
      <NumberInput label={t('co2')} value={co2} onChange={setCo2} decimal={false} />
      <DateTimeField label={t('purchaseDate')} value={v.purchaseDate} onChange={(purchaseDate) => set({ purchaseDate })} mode="date" optional />
      <NumberInput label={t('purchasePrice')} value={price} onChange={setPrice} />
      <Toggle label={t('isNew')} value={v.isNew} onChange={(isNew) => set({ isNew })} />
      <Chips label={t('financeType')} options={(['cash', 'hp', 'lease', 'none'] as FinanceType[]).map((x) => ({ value: x, label: t(x) }))}
        value={v.financeType} onChange={(financeType) => set({ financeType })} />
      <Chips label={t('claimMethod')} options={(['actualCost', 'mileage'] as ClaimMethod[]).map((x) => ({ value: x, label: t(x) }))}
        value={v.claimMethod}
        onChange={(claimMethod) => {
          // HMRC: once flat-rate mileage has been used for a vehicle it must stay on it.
          if (v.claimMethodLockedFromTaxYear != null && claimMethod !== v.claimMethod) {
            Alert.alert(t('claimMethod'), `${t('lockedFrom')} ${taxYearLabel(v.claimMethodLockedFromTaxYear)}`);
            return;
          }
          set({ claimMethod });
        }} />
      <Chips label={t('lockedFrom')} options={yearOptions} value={v.claimMethodLockedFromTaxYear != null ? String(v.claimMethodLockedFromTaxYear) : ''}
        onChange={(y) => set({ claimMethodLockedFromTaxYear: y ? Number(y) : null })} />
      <NumberInput label={t('poolBf')} value={pool} onChange={setPool} />
      <Chips label={t('poolBfYear')} options={yearOptions} value={v.poolBroughtForwardTaxYear != null ? String(v.poolBroughtForwardTaxYear) : ''}
        onChange={(y) => set({ poolBroughtForwardTaxYear: y ? Number(y) : null })} />
      <DateTimeField label={t('disposalDate')} value={v.disposalDate} onChange={(disposalDate) => set({ disposalDate })} mode="date" optional />
      {v.disposalDate ? <NumberInput label={t('disposalProceeds')} value={proceeds} onChange={setProceeds} /> : null}
      <Toggle label={t('active')} value={v.isActive} onChange={(isActive) => set({ isActive })} />
      <Input label={t('notes')} value={v.notes ?? ''} onChangeText={(notes) => set({ notes })} multiline />
      <Button title={t('save')} onPress={submit} />
      {existing ? <Button kind="danger" title={t('delete')} onPress={del} /> : null}
    </Screen>
  );
}
