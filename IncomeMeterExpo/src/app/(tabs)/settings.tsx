import { router } from 'expo-router';
import { Share, Text } from 'react-native';
import { clearLog, logText, readLog } from '../../diagnostics/log';
import { useState } from 'react';
import { Alert } from 'react-native';
import { saveSettings } from '../../db/repo';
import { Period } from '../../domain/dashboard';
import { MileageUnit, Region } from '../../domain/types';
import { applyRegion } from '../../services/data';
import { adoptSessionToken, signInWithGoogle, signOut } from '../../sync/api';
import { syncNow } from '../../sync/sync';
import { Banner, Button, Card, Chips, H2, Input, KV, Muted, NumberInput, Screen, Toggle } from '../../ui/components';
import { dateTime, money, numText, parseNum } from '../../ui/format';
import { useSettings } from '../../ui/hooks';
import { useT } from '../../ui/i18n';
import { useTargetHourly } from '../../ui/useTarget';

export default function SettingsScreen() {
  const t = useT();
  const s = useSettings();
  const [url, setUrl] = useState(s.apiBaseUrl);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'signin' | 'sync' | 'token' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState(numText(s.targetHourly));
  const auto = useTargetHourly();

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
      <Chips label={t('region')} options={[{ value: 'HK', label: '香港' }, { value: 'UK', label: 'UK' }] as { value: Region; label: string }[]}
        value={s.region} onChange={applyRegion} />
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
      <Toggle label={t('autoStops')} value={s.autoStops} onChange={(autoStops) => saveSettings({ autoStops })} />

      <H2>{t('offerTools')}</H2>
      <NumberInput label={t('targetHourly')} value={target}
        onChange={(v) => { setTarget(v); saveSettings({ targetHourly: parseNum(v) }); }}
        placeholder={auto.auto && auto.target != null ? String(auto.target) : ''}
        hint={auto.auto && auto.target != null ? `${t('targetAuto')}: ${money(auto.target)}` : undefined} />
      <Chips label={`${t('completionFactor')} … ${t('ofTimeLimit')}`}
        options={[1, 0.9, 0.8, 0.7, 0.6].map((f) => ({ value: String(f), label: `${Math.round(f * 100)}%` }))}
        value={String(s.completionFactor)} onChange={(v) => saveSettings({ completionFactor: Number(v) })} />
      <Card onPress={() => router.push('/areas')}><KV k={`${t('areas')} · ${t('avoidAreas')}`} v="›" /></Card>

      <H2>{t('diagnostics')}</H2>
      <Muted>{t('diagnosticsHint')}</Muted>
      <Card>
        <Text style={{ fontFamily: 'Menlo', fontSize: 11 }} selectable>
          {readLog().slice(-25).map((e) => `${e.t.slice(11, 19)} ${e.kind}${e.detail ? ` ${e.detail}` : ''}`).join('\n') || '—'}
        </Text>
      </Card>
      <Button kind="secondary" title={t('shareLog')} onPress={() => Share.share({ message: logText() })} />
      <Button kind="ghost" title={t('clearLog')} onPress={() => { clearLog(); setMessage(null); }} />

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
