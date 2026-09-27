import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { saveSettings } from '../../db/repo';
import { Period } from '../../domain/dashboard';
import { MileageUnit } from '../../domain/types';
import { adoptSessionToken, signInWithGoogle, signOut } from '../../sync/api';
import { syncNow } from '../../sync/sync';
import { Banner, Button, Card, Chips, H2, Input, KV, Muted, Screen, Toggle } from '../../ui/components';
import { dateTime } from '../../ui/format';
import { useSettings } from '../../ui/hooks';
import { useT } from '../../ui/i18n';

export default function SettingsScreen() {
  const t = useT();
  const s = useSettings();
  const [url, setUrl] = useState(s.apiBaseUrl);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'signin' | 'sync' | 'token' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (kind: 'signin' | 'sync' | 'token', fn: () => Promise<string>) => {
    setBusy(kind);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch (e) {
      Alert.alert(t('sync'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const saveUrl = () => saveSettings({ apiBaseUrl: url.trim().replace(/\/+$/, '') });

  const sync = () => run('sync', async () => {
    const r = await syncNow();
    return t('syncDone', { p: r.pushed + r.photos + r.locations, g: r.pulled });
  });

  const signIn = () => run('signin', async () => {
    saveUrl();
    const email = await signInWithGoogle();
    await syncNow();
    return t('signedInAs', { e: email });
  });

  const useToken = () => run('token', async () => {
    saveUrl();
    const email = await adoptSessionToken(token.trim());
    setToken('');
    await syncNow();
    return t('signedInAs', { e: email });
  });

  return (
    <Screen>
      <H2>{t('data')}</H2>
      <Card onPress={() => router.push('/vehicles')}><KV k={t('manageVehicles')} v="›" /></Card>
      <Card onPress={() => router.push('/worktypes')}><KV k={t('manageWorkTypes')} v="›" /></Card>

      <H2>{t('preferences')}</H2>
      <Chips label={t('language')} options={[{ value: 'en-GB', label: 'English' }, { value: 'zh-HK', label: '繁體中文' }]}
        value={s.language} onChange={(language) => saveSettings({ language })} />
      <Chips label={t('currency')} options={[{ value: 'GBP', label: 'GBP £' }, { value: 'HKD', label: 'HKD $' }]}
        value={s.currencyCode} onChange={(currencyCode) => saveSettings({ currencyCode })} />
      <Chips label={t('mileageUnit')} options={[{ value: 'mi', label: 'miles' }, { value: 'km', label: 'km' }] as { value: MileageUnit; label: string }[]}
        value={s.mileageUnit} onChange={(mileageUnit) => saveSettings({ mileageUnit })} />
      <Chips label={t('chartPeriod')} options={(['weekly', 'monthly', 'annual'] as Period[]).map((p) => ({ value: p, label: t(p) }))}
        value={s.defaultChartPeriod} onChange={(defaultChartPeriod) => saveSettings({ defaultChartPeriod })} />
      <Input label={t('fiscalStart')} value={s.fiscalYearStart} maxLength={5}
        onChangeText={(v) => { if (/^\d{2}-\d{2}$/.test(v)) saveSettings({ fiscalYearStart: v }); }} />
      <Toggle label={t('trackRoutes')} value={s.trackRoutes} onChange={(trackRoutes) => saveSettings({ trackRoutes })} />

      <H2>{t('sync')}</H2>
      <Muted>{t('syncOptional')}</Muted>
      <Input label={t('serverUrl')} value={url} onChangeText={setUrl} onBlur={saveUrl} autoCapitalize="none" autoCorrect={false}
        keyboardType="url" placeholder="https://incomemeter.azurewebsites.net" />
      {message ? <Banner kind="success">{message}</Banner> : null}
      {s.syncEnabled ? (
        <Card>
          <KV k={t('account')} v={s.userEmail ?? '—'} />
          <KV k={t('lastSync')} v={s.lastSyncAt ? dateTime(s.lastSyncAt) : t('never')} />
          <Button title={t('syncNow')} onPress={sync} busy={busy === 'sync'} />
          <Button kind="ghost" title={t('signOut')} onPress={() => signOut()} />
        </Card>
      ) : (
        <>
          <Button title={t('signIn')} onPress={signIn} busy={busy === 'signin'} disabled={!url.trim()} />
          <Input label={t('pasteToken')} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Button kind="secondary" title={t('useToken')} onPress={useToken} busy={busy === 'token'} disabled={!url.trim() || !token.trim()} />
        </>
      )}
    </Screen>
  );
}
