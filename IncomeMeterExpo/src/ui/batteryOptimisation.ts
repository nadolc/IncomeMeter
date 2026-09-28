import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Linking, Platform } from 'react-native';
import { getDb } from '../db/database';
import { logEvent } from '../diagnostics/log';
import { translate } from './i18n';

/**
 * Android: battery optimisation (and the stricter killers of some brands) can stop the app in the background
 * and leave gaps in a route. Checked when a route starts; asks at most once a week.
 */
const KEY = 'battery.optPromptAt';
const WEEK_MS = 7 * 86_400_000;
/** Brands known for closing background apps beyond stock Android (see dontkillmyapp.com). */
const STRICT_BRANDS = ['samsung', 'xiaomi', 'redmi', 'poco', 'huawei', 'honor', 'oppo', 'realme', 'oneplus', 'vivo', 'meizu', 'asus', 'nokia', 'sony'];

export function phoneBrand(): string | null {
  if (Platform.OS !== 'android') return null;
  const c = Platform.constants as { Manufacturer?: string; Brand?: string };
  return (c.Manufacturer ?? c.Brand ?? '').toLowerCase() || null;
}

export async function isBatteryOptimised(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  try {
    return await Battery.isBatteryOptimizationEnabledAsync();
  } catch {
    return null;
  }
}

export function openBatterySettings() {
  IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
    .catch(() => IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: 'package:com.nadolc.incomemeter' }))
    .catch(() => undefined);
}

export async function maybeAskAboutBatteryOptimisation() {
  if (!(await isBatteryOptimised())) return;
  const db = getDb();
  const last = Number(db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', KEY)?.value ?? 0);
  if (Date.now() - last < WEEK_MS) return;
  db.runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', KEY, String(Date.now()));
  logEvent('battery', 'optimisation on – asked the rider');

  const brand = phoneBrand();
  const strict = brand && STRICT_BRANDS.find((b) => brand.includes(b));
  const t = translate;
  const buttons: { text: string; onPress?: () => void; style?: 'cancel' }[] = [
    { text: t('later'), style: 'cancel' },
    { text: t('openSettings'), onPress: openBatterySettings },
  ];
  if (strict) buttons.push({ text: t('brandGuide'), onPress: () => Linking.openURL(`https://dontkillmyapp.com/${strict}`) });
  Alert.alert(t('batteryOptTitle'), t('batteryOptBody') + (strict ? `\n\n${t('batteryOptBrand', { b: brand! })}` : ''), buttons);
}
