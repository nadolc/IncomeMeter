import { router } from 'expo-router';
import { Alert, Text } from 'react-native';
import { assignByDate, vehicleLabel } from '../../services/data';
import { Badge, Button, Card, colors, Empty, Muted, Row, Screen } from '../../ui/components';
import { date } from '../../ui/format';
import { useCollection } from '../../ui/hooks';
import { useT } from '../../ui/i18n';

export default function VehiclesScreen() {
  const t = useT();
  const vehicles = useCollection('vehicles').sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''));

  const assign = () => {
    const r = assignByDate(true);
    Alert.alert(t('assignByDate'), t('assigned', { r: r.routes, e: r.expenses, o: r.odometerReadings }));
  };

  return (
    <Screen>
      <Button title={`+ ${t('newVehicle')}`} onPress={() => router.push('/vehicles/edit')} />
      {vehicles.length > 0 ? <Button kind="secondary" title={t('assignByDate')} onPress={assign} /> : null}
      {vehicles.length === 0 ? <Empty>{t('noVehicles')}</Empty> : null}
      {vehicles.map((v) => (
        <Card key={v.id} onPress={() => router.push({ pathname: '/vehicles/edit', params: { id: v.id } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{vehicleLabel(v)}</Text>
            {v.isActive && !v.disposalDate ? <Badge label={t('active')} color={colors.success} /> : null}
          </Row>
          <Muted>
            {t(v.vehicleType)} · {t(v.claimMethod)}{v.co2GPerKm != null ? ` · ${v.co2GPerKm} g/km` : ''}
          </Muted>
          <Muted>{date(v.purchaseDate)} → {v.disposalDate ? date(v.disposalDate) : '…'}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
