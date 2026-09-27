import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb, subscribe } from '../db/database';
import { seedDefaults } from '../services/data';
import { isApplyingRemote, syncQuietly } from '../sync/sync';
import { resumeTrackingIfNeeded } from '../tracking/tracker';
import { colors } from '../ui/components';
import { useT } from '../ui/i18n';

getDb();
seedDefaults();

export default function RootLayout() {
  const t = useT();

  useEffect(() => {
    resumeTrackingIfNeeded().catch(() => undefined);
    syncQuietly();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') syncQuietly(); });
    // Push local edits a few seconds after they happen (GPS points go up with the next sync).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe((c) => {
      if (c === 'kv' || c === 'locations' || isApplyingRemote()) return;
      clearTimeout(timer);
      timer = setTimeout(syncQuietly, 5000);
    });
    return () => { sub.remove(); unsubscribe(); clearTimeout(timer); };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="routes/[id]" options={{ title: t('routes') }} />
        <Stack.Screen name="routes/edit" options={{ presentation: 'modal', title: t('newRoute') }} />
        <Stack.Screen name="routes/start" options={{ presentation: 'modal', title: t('startRoute') }} />
        <Stack.Screen name="routes/end" options={{ presentation: 'modal', title: t('endRoute') }} />
        <Stack.Screen name="routes/import" options={{ presentation: 'modal', title: t('importCsv') }} />
        <Stack.Screen name="expenses/edit" options={{ presentation: 'modal', title: t('newExpense') }} />
        <Stack.Screen name="odometer/edit" options={{ presentation: 'modal', title: t('newReading') }} />
        <Stack.Screen name="vehicles/index" options={{ title: t('vehicles') }} />
        <Stack.Screen name="vehicles/edit" options={{ presentation: 'modal', title: t('newVehicle') }} />
        <Stack.Screen name="worktypes/index" options={{ title: t('workTypes') }} />
        <Stack.Screen name="worktypes/edit" options={{ presentation: 'modal', title: t('newWorkType') }} />
      </Stack>
    </SafeAreaProvider>
  );
}
