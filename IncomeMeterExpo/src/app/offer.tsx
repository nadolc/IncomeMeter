import { useState } from 'react';
import { Text, View } from 'react-native';
import { evaluateOffer, minutesUntil, thresholdTable } from '../domain/metrics';
import { Banner, Card, colors, H2, Input, KV, Muted, NumberInput, Row, Screen } from '../ui/components';
import { money, parseNum } from '../ui/format';
import { useSettings } from '../ui/hooks';
import { useT } from '../ui/i18n';
import { useTargetHourly } from '../ui/useTarget';

/** Quick check of an order offer: fee (+ on-time bonus) against the time limit, and avoided areas. */
export default function OfferScreen() {
  const t = useT();
  const settings = useSettings();
  const { target, auto } = useTargetHourly();
  const [fee, setFee] = useState('');
  const [bonus, setBonus] = useState('');
  const [deadline, setDeadline] = useState('');
  const [minutesText, setMinutesText] = useState('');
  const [area, setArea] = useState('');

  const minutes = parseNum(minutesText) ?? (deadline ? minutesUntil(deadline) : null);
  const feeValue = parseNum(fee);
  const result = target != null && feeValue != null && minutes != null && minutes > 0
    ? evaluateOffer({
      fee: feeValue, bonus: parseNum(bonus) ?? 0, minutes, completionFactor: settings.completionFactor,
      targetHourly: target, text: area, avoidAreas: settings.avoidAreas,
    })
    : null;
  const color = result ? { good: colors.success, borderline: colors.warning, bad: colors.danger }[result.verdict] : colors.muted;
  const label = result ? { good: `✅ ${t('verdictGood')}`, borderline: `⚠️ ${t('verdictBorderline')}`, bad: `❌ ${t('verdictBad')}` }[result.verdict] : '';

  return (
    <Screen>
      {target == null ? <Banner kind="info">{t('setTarget')}</Banner> : (
        <Muted>{t('targetHourly')}: {money(target)}{auto ? ` (${t('targetAuto')})` : ''} · {t('completionFactor')} {Math.round(settings.completionFactor * 100)}% {t('ofTimeLimit')}</Muted>
      )}
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}><NumberInput label={t('fee')} value={fee} onChange={setFee} placeholder="46.82" /></View>
        <View style={{ flex: 1 }}><NumberInput label={t('onTimeBonus')} value={bonus} onChange={setBonus} placeholder="6.00" /></View>
      </Row>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input label={t('deadline')} value={deadline} onChangeText={setDeadline} placeholder="19:28" keyboardType="numbers-and-punctuation" maxLength={5} />
        </View>
        <View style={{ flex: 1 }}><NumberInput label={t('orMinutes')} value={minutesText} onChange={setMinutesText} decimal={false} placeholder={minutes != null ? String(minutes) : '32'} /></View>
      </Row>
      <Input label={t('offerArea')} value={area} onChangeText={setArea} placeholder="荃灣石圍角村石桃樓" />

      {result ? (
        <Card style={{ borderColor: color, borderWidth: 2 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color }}>{label}</Text>
          <KV k={t('expected')} v={`${money(result.hourlyExpected)}/h`} strong />
          <KV k={t('worstCase')} v={`${money(result.hourlyWorst)}/h`} />
          <KV k={t('minutesShort')} v={minutes!} />
          {result.areaHits.length > 0 ? <Banner kind="warning">⚠️ {t('avoidWarning')}: {result.areaHits.join('、')}</Banner> : null}
        </Card>
      ) : null}

      {target != null ? (
        <>
          <H2>{t('thresholdTable')}</H2>
          <Card>
            {thresholdTable(target, settings.completionFactor).map((r) => (
              <KV key={r.minutes} k={`${r.minutes} ${t('minutesShort')}`} v={`≥ ${money(r.minFee)}`} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
