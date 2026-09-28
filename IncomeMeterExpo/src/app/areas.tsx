import { useMemo } from 'react';
import { Share, Text } from 'react-native';
import { getStopsWithTrack, saveSettings } from '../db/repo';
import { mergeStops } from '../domain/legs';
import { areaStats, avoidList } from '../domain/metrics';
import { Badge, Button, Card, colors, Empty, H2, Input, Muted, Row, Screen } from '../ui/components';
import { num } from '../ui/format';
import { useLive, useSettings } from '../ui/hooks';
import { useT } from '../ui/i18n';

/** Where stops were made: climbs and waiting afterwards, to build the "areas to avoid" list. */
export default function AreasScreen() {
  const t = useT();
  const settings = useSettings();
  const data = useLive(() => getStopsWithTrack(), ['locations']);
  const areas = useMemo(() => areaStats(mergeStops(data.stops), data.track), [data]);
  const avoided = avoidList(settings.avoidAreas);

  const add = (label: string) => {
    if (avoided.includes(label)) return;
    saveSettings({ avoidAreas: [...avoided, label].join('|') });
  };

  return (
    <Screen>
      <Input label={t('avoidAreas')} value={settings.avoidAreas} onChangeText={(avoidAreas) => saveSettings({ avoidAreas })}
        placeholder="石圍角|象山|梨木樹" hint={t('avoidHint')} />
      {avoided.length > 0 ? <Button kind="secondary" small title={t('shareList')} onPress={() => Share.share({ message: avoided.join('|') })} /> : null}

      <H2>{t('areas')}</H2>
      {areas.length === 0 ? <Empty>{t('noAreas')}</Empty> : null}
      {areas.map((a) => (
        <Card key={`${a.latitude},${a.longitude}`}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>{a.label}</Text>
            {a.suggestAvoid ? <Badge label={t('suggestAvoid')} color={colors.danger} /> : null}
          </Row>
          <Muted>
            {a.visits} {t('visits')}
            {a.avgClimbM != null ? ` · ${t('climb')} ${num(a.avgClimbM, 0)} m` : ''}
            {a.avgIdleAfterMin != null ? ` · ${t('idleAfter')} ${num(a.avgIdleAfterMin, 0)} ${t('minutesShort')}` : ''}
          </Muted>
          {!avoided.includes(a.label) ? <Button small kind="ghost" title={`+ ${t('addToAvoid')}`} onPress={() => add(a.label)} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
