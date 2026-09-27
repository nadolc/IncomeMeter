import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { getById } from '../../db/repo';
import { RouteStatus } from '../../domain/types';
import { activeWorkTypes, defaultVehicleId } from '../../services/data';
import { saveRoute } from '../../services/routes';
import { Button, Chips, DateTimeField, Input, NumberInput, Row, Screen, Toggle } from '../../ui/components';
import { numText, parseNum } from '../../ui/format';
import { useCollection, useSettings } from '../../ui/hooks';
import { fromRows, IncomeEditor, IncomeRow, rowsFromWorkType, toRows } from '../../ui/IncomeEditor';
import { useT } from '../../ui/i18n';
import { VehiclePicker, WorkTypePicker } from '../../ui/pickers';

const HOURS8 = 8 * 3_600_000;

export default function EditRouteScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { mileageUnit } = useSettings();
  const existing = id ? getById('routes', id) : null;
  const vehicles = useCollection('vehicles');
  const [workTypes] = useState(() => {
    const list = activeWorkTypes();
    const current = existing?.workTypeId ? getById('workTypes', existing.workTypeId) : null;
    return current && !list.some((w) => w.id === current.id) ? [...list, current] : list;
  });

  const now = new Date();
  // A route whose work type was deleted keeps its name and is edited as "Other".
  const knownType = !!existing?.workTypeId && workTypes.some((w) => w.id === existing.workTypeId);
  const [workTypeId, setWorkTypeId] = useState<string | null>(
    existing ? (knownType ? existing.workTypeId : '__other') : workTypes[0]?.id ?? '__other');
  const [otherName, setOtherName] = useState(existing && !knownType ? existing.workType ?? '' : '');
  const [status, setStatus] = useState<RouteStatus>(existing?.status ?? 'completed');
  const [scheduleStart, setScheduleStart] = useState<string | null>(existing?.scheduleStart ?? now.toISOString());
  const [scheduleEnd, setScheduleEnd] = useState<string | null>(existing?.scheduleEnd ?? new Date(now.getTime() + HOURS8).toISOString());
  const [sameAsSchedule, setSame] = useState(!existing ||
    (existing.actualStartTime === existing.scheduleStart && existing.actualEndTime === existing.scheduleEnd));
  const [actualStart, setActualStart] = useState<string | null>(existing?.actualStartTime ?? null);
  const [actualEnd, setActualEnd] = useState<string | null>(existing?.actualEndTime ?? null);
  const [vehicleId, setVehicleId] = useState<string | null>(existing ? existing.vehicleId : defaultVehicleId(now.toISOString()));
  const [startMile, setStartMile] = useState(numText(existing?.startMile));
  const [endMile, setEndMile] = useState(numText(existing?.endMile));
  const [estimate, setEstimate] = useState(numText(existing?.estimatedIncome || null));
  const [rows, setRows] = useState<IncomeRow[]>(() =>
    existing ? toRows(existing.incomes) : rowsFromWorkType(workTypes[0]));

  const wt = workTypes.find((w) => w.id === workTypeId) ?? null;

  const pickWorkType = (id: string) => {
    setWorkTypeId(id);
    const next = workTypes.find((w) => w.id === id);
    // Like the web form: choosing a work type fills the income lines from its templates.
    if (next && fromRows(rows).every((r) => r.amount === 0)) {
      const filled = rowsFromWorkType(next);
      setRows(filled);
      setEstimate(numText(fromRows(filled).reduce((s, r) => s + r.amount, 0) || null));
    }
  };

  const submit = () => {
    const name = workTypeId === '__other' ? otherName.trim() : wt?.name;
    if (!name) return Alert.alert(t('workType'), t('required'));
    if (!scheduleStart || !scheduleEnd) return Alert.alert(t('scheduleStart'), t('required'));
    const s = parseNum(startMile);
    const e = parseNum(endMile);
    if (s != null && e != null && e < s) return Alert.alert(t('endBeforeStart'));
    const incomes = fromRows(rows);
    const saved = saveRoute({
      workType: name,
      workTypeId: workTypeId === '__other' ? null : workTypeId,
      vehicleId,
      status,
      scheduleStart,
      scheduleEnd,
      actualStartTime: sameAsSchedule ? scheduleStart : actualStart,
      actualEndTime: sameAsSchedule ? scheduleEnd : actualEnd,
      incomes,
      estimatedIncome: parseNum(estimate) ?? 0,
      startMile: s,
      endMile: e,
    }, existing?.id);
    router.dismiss();
    if (!existing) router.push(`/routes/${saved.id}`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('edit') : t('newRoute') }} />
      <WorkTypePicker workTypes={workTypes} value={workTypeId} onChange={pickWorkType} />
      {workTypeId === '__other' ? <Input label={t('name')} value={otherName} onChangeText={setOtherName} /> : null}
      <Chips label={t('status')}
        options={(['scheduled', 'in_progress', 'completed', 'cancelled'] as RouteStatus[]).map((s) => ({ value: s, label: t(s) }))}
        value={status} onChange={setStatus} />
      <DateTimeField label={t('scheduleStart')} value={scheduleStart} onChange={setScheduleStart} />
      <DateTimeField label={t('scheduleEnd')} value={scheduleEnd} onChange={setScheduleEnd} />
      <Toggle label={t('actualSameAsSchedule')} value={sameAsSchedule} onChange={setSame} />
      {!sameAsSchedule ? (
        <>
          <DateTimeField label={t('actualStart')} value={actualStart} onChange={setActualStart} optional />
          <DateTimeField label={t('actualEnd')} value={actualEnd} onChange={setActualEnd} optional />
        </>
      ) : null}
      <VehiclePicker vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}><NumberInput label={`${t('startMile')} (${mileageUnit})`} value={startMile} onChange={setStartMile} /></View>
        <View style={{ flex: 1 }}><NumberInput label={`${t('endMile')} (${mileageUnit})`} value={endMile} onChange={setEndMile} /></View>
      </Row>
      <NumberInput label={t('estimatedIncome')} value={estimate} onChange={setEstimate} />
      <IncomeEditor rows={rows} onChange={setRows} workType={wt} />
      <Button title={t('save')} onPress={submit} />
    </Screen>
  );
}
