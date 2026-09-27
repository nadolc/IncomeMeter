import { Vehicle, WorkType } from '../domain/types';
import { Chips } from './components';
import { useT } from './i18n';

export function WorkTypePicker({ workTypes, value, onChange }: { workTypes: WorkType[]; value: string | null; onChange: (id: string) => void }) {
  const t = useT();
  return (
    <Chips
      label={t('workType')}
      options={[...workTypes.map((w) => ({ value: w.id, label: w.name })), { value: '__other', label: t('other') }]}
      value={value}
      onChange={onChange}
    />
  );
}

export function VehiclePicker({ vehicles, value, onChange }: { vehicles: Vehicle[]; value: string | null; onChange: (id: string | null) => void }) {
  const t = useT();
  if (vehicles.length === 0) return null;
  return (
    <Chips
      label={t('vehicle')}
      options={[{ value: '', label: t('none') }, ...vehicles.map((v) => ({ value: v.id, label: v.registration }))]}
      value={value ?? ''}
      onChange={(v) => onChange(v || null)}
    />
  );
}
