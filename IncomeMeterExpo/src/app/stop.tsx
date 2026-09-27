import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { LocationPoint } from '../domain/types';
import { inProgressRoute } from '../services/routes';
import { recordStop } from '../tracking/tracker';
import { Banner, Button, Screen } from '../ui/components';
import { time } from '../ui/format';
import { useT } from '../ui/i18n';

/**
 * Deep link for iOS Shortcuts: `incomemeter://stop` records a stop on the route in progress
 * (offline, into the app). A Shortcut can pass its own position: `incomemeter://stop?lat=51.5&lon=-0.12`.
 */
export default function RecordStopScreen() {
  const t = useT();
  const { lat, lon } = useLocalSearchParams<{ lat?: string; lon?: string }>();
  const [state, setState] = useState<{ kind: 'busy' } | { kind: 'done'; point: LocationPoint } | { kind: 'error'; message: string }>({ kind: 'busy' });

  useEffect(() => {
    const route = inProgressRoute();
    if (!route) {
      setState({ kind: 'error', message: t('noRouteInProgress') });
      return;
    }
    const latitude = lat != null ? Number(lat) : NaN;
    const longitude = lon != null ? Number(lon) : NaN;
    const coords = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined;
    recordStop(route.id, coords)
      .then((point) => {
        setState({ kind: 'done', point });
        setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 1500);
      })
      .catch((e) => setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
    // Record once per link opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      {state.kind === 'busy' ? (
        <>
          <ActivityIndicator size="large" />
          <Text style={{ textAlign: 'center' }}>{t('recordingStop')}</Text>
        </>
      ) : state.kind === 'done' ? (
        <Banner kind="success">
          {t('stopRecorded')} · {time(state.point.timestamp)}{state.point.address ? `\n${state.point.address}` : ''}
        </Banner>
      ) : (
        <>
          <Banner kind="error">{state.message}</Banner>
          <Button title="OK" onPress={() => router.replace('/')} />
        </>
      )}
    </Screen>
  );
}
