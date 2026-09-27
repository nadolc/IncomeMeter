import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { getById, getLocations, getSettings, insertLocations, remove } from '../../db/repo';
import { kmToUnit, pathKm } from '../../domain/geo';
import { routeIncome } from '../../domain/dashboard';
import { vehicleLabel } from '../../services/data';
import { cancelRoute } from '../../services/routes';
import { fetchRouteLocations, isSignedIn } from '../../sync/api';
import { getActiveTrackingRouteId, startTracking, TrackingMode } from '../../tracking/tracker';
import { Badge, Banner, Button, Card, colors, Empty, H2, KV, Muted, Row, Screen, statusColor } from '../../ui/components';
import { dateTime, duration, money, num, time } from '../../ui/format';
import { useLive } from '../../ui/hooks';
import { tOr, useT } from '../../ui/i18n';

export default function RouteDetail() {
  const t = useT();
  const { id, tracking } = useLocalSearchParams<{ id: string; tracking?: TrackingMode | 'off' }>();
  const route = useLive(() => getById('routes', id), ['routes'], [id]);
  const points = useLive(() => getLocations(id), ['locations'], [id]);
  const recording = useLive(() => getActiveTrackingRouteId() === id, ['kv'], [id]);
  const [showPoints, setShowPoints] = useState(false);
  const unit = getSettings().mileageUnit;

  // Routes recorded on another device: fetch their path once.
  useEffect(() => {
    if (points.length > 0 || !route || route.status === 'in_progress') return;
    isSignedIn().then((ok) => (ok ? fetchRouteLocations(id) : [])).then((remote) => {
      if (remote.length === 0) return;
      insertLocations(remote.map((l) => ({
        id: l.id, routeId: id, latitude: l.latitude, longitude: l.longitude, timestamp: l.timestamp, accuracy: l.accuracy ?? null,
        speed: l.speed ?? null, address: l.address ?? null, distanceFromLastKm: l.distanceFromLastKm ?? null, distanceFromLastMi: l.distanceFromLastMi ?? null,
      })), false);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!route) return <Screen><Empty>—</Empty></Screen>;

  const vehicle = getById('vehicles', route.vehicleId);
  const coords = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  const gpsDistance = kmToUnit(pathKm(coords), unit);

  const confirmDelete = () =>
    Alert.alert(t('confirmDelete'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { remove('routes', route.id); router.back(); } },
    ]);

  const resume = async () => {
    const mode = await startTracking(route.id);
    if (mode !== 'background') Alert.alert(mode === 'foreground' ? t('trackingForeground') : t('trackingDenied'));
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: route.workType ?? t('routes') }} />

      {tracking === 'foreground' ? <Banner kind="warning">{t('trackingForeground')}</Banner> : null}
      {tracking === 'denied' ? <Banner kind="error">{t('trackingDenied')}</Banner> : null}

      {coords.length > 0 ? (
        <View style={{ height: 260, borderRadius: 12, overflow: 'hidden' }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={regionFor(coords)}
            showsUserLocation={route.status === 'in_progress'}>
            <Polyline coordinates={coords} strokeWidth={4} strokeColor={colors.primary} />
            <Marker coordinate={coords[0]} pinColor="green" title={t('actualStart')} />
            {coords.length > 1 ? <Marker coordinate={coords[coords.length - 1]} pinColor="red" title={t('actualEnd')} /> : null}
          </MapView>
        </View>
      ) : (
        <Card><Muted>{t('noPath')}</Muted></Card>
      )}

      {route.status === 'in_progress' ? (
        <Row style={{ gap: 8 }}>
          <Button title={t('endRoute')} onPress={() => router.push({ pathname: '/routes/end', params: { id: route.id } })} style={{ flex: 1 }} />
          {!recording ? <Button kind="secondary" title={t('useGps')} onPress={resume} style={{ flex: 1 }} /> : null}
        </Row>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Badge label={tOr(t, route.status)} color={statusColor(route.status)} />
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{money(routeIncome(route))}</Text>
        </Row>
        <KV k={t('vehicle')} v={vehicleLabel(vehicle)} />
        <KV k={t('scheduleStart')} v={dateTime(route.scheduleStart)} />
        <KV k={t('scheduleEnd')} v={dateTime(route.scheduleEnd)} />
        <KV k={t('actualStart')} v={dateTime(route.actualStartTime)} />
        <KV k={t('actualEnd')} v={dateTime(route.actualEndTime)} />
        {route.actualStartTime ? <KV k={t('elapsed')} v={duration(route.actualStartTime, route.actualEndTime)} /> : null}
        <KV k={t('startMile')} v={route.startMile != null ? num(route.startMile) : '—'} />
        <KV k={t('endMile')} v={route.endMile != null ? num(route.endMile) : '—'} />
        <KV k={t('distance')} v={`${num(route.distance)} ${unit}`} strong />
        <KV k={t('gpsTracked')} v={`${num(gpsDistance)} ${unit} · ${points.length} ${t('gpsPoints')}${recording ? ' ●' : ''}`} />
        <KV k={t('estimatedIncome')} v={money(route.estimatedIncome)} />
      </Card>

      {route.incomes.length > 0 ? (
        <Card>
          <H2>{t('incomes')}</H2>
          {route.incomes.map((i, n) => <KV key={n} k={i.source} v={money(i.amount)} />)}
          <KV k={t('totalIncome')} v={money(route.totalIncome)} strong />
        </Card>
      ) : null}

      <Row style={{ gap: 8 }}>
        <Button kind="secondary" title={t('edit')} onPress={() => router.push({ pathname: '/routes/edit', params: { id: route.id } })} style={{ flex: 1 }} />
        {route.status === 'in_progress'
          ? <Button kind="secondary" title={t('cancelRoute')} onPress={() => cancelRoute(route)} style={{ flex: 1 }} />
          : null}
        <Button kind="danger" title={t('delete')} onPress={confirmDelete} style={{ flex: 1 }} />
      </Row>

      {points.length > 0 ? (
        <>
          <H2 right={<Button small kind="ghost" title={showPoints ? '▲' : '▼'} onPress={() => setShowPoints(!showPoints)} />}>
            {t('gpsPoints')} ({points.length})
          </H2>
          {showPoints && points.map((p) => (
            <Card key={p.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text>{time(p.timestamp)}</Text>
                <Muted>{p.distanceFromLastKm != null ? `+${num(kmToUnit(p.distanceFromLastKm, unit), 2)} ${unit}` : ''}</Muted>
              </Row>
              <Muted>
                {p.address ?? `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`}
                {p.accuracy != null ? ` · ±${Math.round(p.accuracy)} m` : ''}
                {p.speed != null ? ` · ${num(p.speed * 3.6, 0)} km/h` : ''}
              </Muted>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function regionFor(coords: { latitude: number; longitude: number }[]) {
  const lats = coords.map((c) => c.latitude);
  const lons = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.4),
  };
}
