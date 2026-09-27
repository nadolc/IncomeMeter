import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getSettings } from '../db/repo';
import { kmToUnit } from '../domain/geo';
import { Route } from '../domain/types';
import { getActiveTrackingRouteId, trackedKm, trackedPointCount } from '../tracking/tracker';
import { Badge, Button, Card, colors, Muted, Row } from './components';
import { duration, num } from './format';
import { useLive } from './hooks';
import { useT } from './i18n';

/** Big "route in progress" card: elapsed time, live GPS distance, end button. */
export function ActiveRouteCard({ route }: { route: Route }) {
  const t = useT();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const gps = useLive(() => ({
    km: trackedKm(route.id), points: trackedPointCount(route.id), recording: getActiveTrackingRouteId() === route.id,
  }), ['locations', 'kv'], [route.id]);
  const unit = getSettings().mileageUnit;

  return (
    <Card onPress={() => router.push(`/routes/${route.id}`)} style={{ borderColor: colors.warning, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 17, fontWeight: '700' }}>{route.workType ?? t('routes')}</Text>
        <Badge label={t('routeInProgress')} color={colors.warning} />
      </Row>
      <Row style={{ gap: 24, marginVertical: 6 }}>
        <View>
          <Muted>{t('elapsed')}</Muted>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>{duration(route.actualStartTime)}</Text>
        </View>
        <View>
          <Muted>{t('gpsTracked')}</Muted>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>{num(kmToUnit(gps.km, unit))} {unit}</Text>
        </View>
        {route.startMile != null ? (
          <View>
            <Muted>{t('startMile')}</Muted>
            <Text style={{ fontSize: 22, fontWeight: '700' }}>{num(route.startMile)}</Text>
          </View>
        ) : null}
      </Row>
      <Muted>{gps.recording ? `● ${t('trackingBackground')} · ${gps.points} ${t('gpsPoints')}` : t('trackingOff')}</Muted>
      <Button title={t('endRoute')} onPress={() => router.push({ pathname: '/routes/end', params: { id: route.id } })} style={{ marginTop: 8 }} />
    </Card>
  );
}
