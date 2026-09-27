import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { activeWorkTypes, defaultVehicleId } from '../../services/data';
import { inProgressRoute, startRoute, suggestStartMile } from '../../services/routes';
import { TRAVEL_MODES, TravelMode, usesOdometer } from '../../domain/types';
import { Banner, Button, Chips, Input, NumberInput, Screen } from '../../ui/components';
import { numText, parseNum } from '../../ui/format';
import { useCollection, useSettings } from '../../ui/hooks';
import { useT } from '../../ui/i18n';
import { VehiclePicker, WorkTypePicker } from '../../ui/pickers';

export default function StartRouteScreen() {
  const t = useT();
  const settings = useSettings();
  const vehicles = useCollection('vehicles').filter((v) => v.isActive);
  const [workTypes] = useState(activeWorkTypes);
  const [workTypeId, setWorkTypeId] = useState<string | null>(workTypes[0]?.id ?? null);
  const [otherName, setOtherName] = useState('');
  const [vehicleId, setVehicleId] = useState<string | null>(() => defaultVehicleId(new Date().toISOString()));
  const [startMile, setStartMile] = useState(() => numText(suggestStartMile(defaultVehicleId(new Date().toISOString()))));
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<TravelMode>(settings.defaultTravelMode);
  const odometer = usesOdometer(mode);

  const wt = workTypes.find((w) => w.id === workTypeId) ?? null;
  const estimated = (wt?.incomeSourceTemplates ?? []).reduce((s, x) => s + (x.defaultAmount ?? 0), 0);
  const [estimate, setEstimate] = useState('');

  const onVehicle = (id: string | null) => {
    setVehicleId(id);
    const suggestion = suggestStartMile(id);
    if (suggestion != null) setStartMile(String(suggestion));
  };

  const start = async () => {
    if (inProgressRoute()) {
      Alert.alert(t('routeInProgress'));
      return;
    }
    const name = workTypeId === '__other' ? otherName.trim() : wt?.name;
    if (!name) {
      Alert.alert(t('workType'), t('required'));
      return;
    }
    setBusy(true);
    try {
      const { route, tracking } = await startRoute({
        workType: name,
        workTypeId: workTypeId === '__other' ? null : workTypeId,
        vehicleId: odometer ? vehicleId : null,
        startMile: odometer ? parseNum(startMile) : null,
        travelMode: mode,
        estimatedIncome: parseNum(estimate) ?? estimated,
        incomes: [],
      });
      router.dismiss();
      router.push({ pathname: '/routes/[id]', params: { id: route.id, tracking } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <WorkTypePicker workTypes={workTypes} value={workTypeId} onChange={setWorkTypeId} />
      {workTypeId === '__other' ? <Input label={t('name')} value={otherName} onChangeText={setOtherName} /> : null}
      <Chips label={t('travelMode')} options={TRAVEL_MODES.map((m) => ({ value: m, label: t(m) }))} value={mode} onChange={setMode} />
      {odometer ? (
        <>
          <VehiclePicker vehicles={vehicles} value={vehicleId} onChange={onVehicle} />
          <NumberInput label={`${t('startMile')} (${settings.mileageUnit})`} value={startMile} onChange={setStartMile} />
        </>
      ) : null}
      <NumberInput label={t('estimatedIncome')} value={estimate} onChange={setEstimate} placeholder={estimated ? estimated.toFixed(2) : '0.00'} />
      {!settings.trackRoutes ? <Banner kind="info">{t('trackingOff')}</Banner> : null}
      <Button title={`▶  ${t('startRoute')}`} onPress={start} busy={busy} />
    </Screen>
  );
}

