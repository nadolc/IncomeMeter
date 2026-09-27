import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { getById, getLocations } from '../../db/repo';
import { movingMinutes } from '../../domain/geo';
import { routeRates } from '../../domain/metrics';
import { usesOdometer } from '../../domain/types';
import { endRoute, suggestEndMile } from '../../services/routes';
import { Button, Card, DateTimeField, Empty, KV, NumberInput, Screen } from '../../ui/components';
import { duration, hours, money, num, numText, parseNum } from '../../ui/format';
import { useLive, useSettings } from '../../ui/hooks';
import { fromRows, IncomeEditor, IncomeRow, rowsFromWorkType, toRows } from '../../ui/IncomeEditor';
import { useT } from '../../ui/i18n';

export default function EndRouteScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { mileageUnit } = useSettings();
  const route = getById('routes', id);
  const workType = getById('workTypes', route?.workTypeId);

  // Refreshes while GPS points keep arriving.
  const gps = useLive(() => (route ? { ...suggestEndMile(route), moving: movingMinutes(getLocations(route.id, 'track')) } : null), ['locations'], [id]);

  const [endMile, setEndMile] = useState(() => numText(gps?.endMile));
  const [autofilled, setAutofilled] = useState(gps?.endMile != null);
  const [rows, setRows] = useState<IncomeRow[]>(() =>
    route && route.incomes.length ? toRows(route.incomes) : rowsFromWorkType(workType));
  const [endTime, setEndTime] = useState<string | null>(new Date().toISOString());
  const [busy, setBusy] = useState(false);

  if (!route) return <Screen><Empty>—</Empty></Screen>;

  const odometer = usesOdometer(route.travelMode);
  const end = odometer ? parseNum(endMile) : null;
  // Preview of what this route earned per hour / per km with the income entered so far.
  const rates = routeRates(
    { ...route, actualEndTime: endTime ?? new Date().toISOString(), movingMinutes: gps?.moving ?? null,
      distance: odometer && end != null && route.startMile != null ? Math.abs(end - route.startMile) : gps?.tracked ?? 0 },
    fromRows(rows).reduce((s, r) => s + r.amount, 0));
  const invalid = end != null && route.startMile != null && end < route.startMile;

  const useGps = () => {
    if (gps?.endMile != null) {
      setEndMile(String(gps.endMile));
      setAutofilled(true);
    }
  };

  const finish = async () => {
    if (invalid) {
      Alert.alert(t('endBeforeStart'));
      return;
    }
    const missing = workType?.incomeSourceTemplates.filter((s) => s.isRequired && !rows.some((r) => r.source === s.name && parseNum(r.amount) != null));
    if (missing?.length) {
      Alert.alert(t('required'), missing.map((m) => m.name).join(', '));
      return;
    }
    setBusy(true);
    try {
      await endRoute(route, { endMile: end, incomes: fromRows(rows), actualEndTime: endTime ?? undefined });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <KV k={t('workType')} v={route.workType ?? '—'} strong />
        <KV k={t('elapsed')} v={duration(route.actualStartTime, endTime)} />
        <KV k={t('startMile')} v={route.startMile != null ? `${num(route.startMile)} ${mileageUnit}` : '—'} />
        <KV k={t('gpsTracked')} v={`${num(gps?.tracked ?? 0)} ${mileageUnit}`} strong />
        <KV k={t('gpsPoints')} v={gps?.points ?? 0} />
      </Card>

      {odometer ? (<>
      <NumberInput
        label={`${t('endMile')} (${mileageUnit})`}
        value={endMile}
        onChange={(s) => { setEndMile(s); setAutofilled(false); }}
        error={invalid ? t('endBeforeStart') : null}
        hint={autofilled && gps ? t('autofilledFromGps', { d: `${num(gps.tracked)} ${mileageUnit}` }) : undefined}
      />
      {gps?.endMile != null && !autofilled ? <Button small kind="secondary" title={`${t('useGps')}: ${num(gps.endMile)}`} onPress={useGps} /> : null}
      </>) : null}

      <DateTimeField label={t('actualEnd')} value={endTime} onChange={setEndTime} />
      <IncomeEditor rows={rows} onChange={setRows} workType={workType} />
      <Card>
        {rates.movingMinutes != null ? <KV k={t('movingTime')} v={hours(rates.movingMinutes / 60)} /> : null}
        {rates.waitingMinutes != null ? <KV k={t('waitingTime')} v={hours(rates.waitingMinutes / 60)} /> : null}
        <KV k={t('hourlyOnline')} v={rates.hourlyOnline != null ? money(rates.hourlyOnline) : '—'} strong />
        {rates.hourlyMoving != null ? <KV k={t('hourlyMoving')} v={money(rates.hourlyMoving)} /> : null}
        <KV k={`${t('perDistance')} ${mileageUnit}`} v={rates.perDistance != null ? money(rates.perDistance) : '—'} />
      </Card>
      <Button title={t('endRoute')} onPress={finish} busy={busy} />
    </Screen>
  );
}
