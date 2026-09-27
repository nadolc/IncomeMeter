import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { routeIncome } from '../../domain/dashboard';
import { Route, RouteStatus } from '../../domain/types';
import { Badge, Button, Card, Chips, colors, Empty, Muted, Row, statusColor } from '../../ui/components';
import { date, money, num, time } from '../../ui/format';
import { useCollection, useSettings } from '../../ui/hooks';
import { tOr, useT } from '../../ui/i18n';

type Range = '7' | '14' | '30' | 'all';
type Sort = 'newest' | 'oldest' | 'income';

export default function RoutesScreen() {
  const t = useT();
  const { mileageUnit } = useSettings();
  const routes = useCollection('routes');
  const [status, setStatus] = useState<RouteStatus | 'all'>('all');
  const [range, setRange] = useState<Range>('30');
  const [workType, setWorkType] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('newest');

  const workTypes = useMemo(() => [...new Set(routes.map((r) => r.workType).filter(Boolean) as string[])].sort(), [routes]);

  const list = useMemo(() => {
    const from = range === 'all' ? 0 : Date.now() - Number(range) * 86_400_000;
    const filtered = routes.filter((r) =>
      (status === 'all' || r.status === status) &&
      // A status filter shows every route with that status, like the web's /routes/status/{status}.
      (status !== 'all' || new Date(r.scheduleStart).getTime() >= from) &&
      (workType === 'all' || r.workType === workType));
    const cmp: Record<Sort, (a: Route, b: Route) => number> = {
      newest: (a, b) => b.scheduleStart.localeCompare(a.scheduleStart),
      oldest: (a, b) => a.scheduleStart.localeCompare(b.scheduleStart),
      income: (a, b) => routeIncome(b) - routeIncome(a),
    };
    return filtered.sort(cmp[sort]);
  }, [routes, status, range, workType, sort]);

  const total = list.reduce((s, r) => s + routeIncome(r), 0);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={list}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <Row style={{ gap: 8 }}>
            <Button title={`▶ ${t('startRoute')}`} onPress={() => router.push('/routes/start')} style={{ flex: 1 }} />
            <Button kind="secondary" title={`+ ${t('newRoute')}`} onPress={() => router.push('/routes/edit')} style={{ flex: 1 }} />
          </Row>
          <Chips
            options={(['all', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const).map((s) => ({ value: s, label: t(s) }))}
            value={status} onChange={setStatus} />
          {status === 'all' ? (
            <Chips options={[{ value: '7', label: t('last7') }, { value: '14', label: t('last14') }, { value: '30', label: t('last30') }, { value: 'all', label: t('all') }] as { value: Range; label: string }[]}
              value={range} onChange={setRange} />
          ) : null}
          {workTypes.length > 1 ? (
            <Chips options={[{ value: 'all', label: t('all') }, ...workTypes.map((w) => ({ value: w, label: w }))]} value={workType} onChange={setWorkType} />
          ) : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <Chips options={[{ value: 'newest', label: t('sortNewest') }, { value: 'oldest', label: t('sortOldest') }, { value: 'income', label: t('sortIncome') }] as { value: Sort; label: string }[]}
              value={sort} onChange={setSort} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Muted>{list.length} · {money(total)}</Muted>
            <Button small kind="ghost" title={t('importCsv')} onPress={() => router.push('/routes/import')} />
          </Row>
        </View>
      }
      ListEmptyComponent={<Empty>{t('noRoutes')}</Empty>}
      renderItem={({ item: r }) => (
        <Card onPress={() => router.push(`/routes/${r.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{r.workType ?? '—'}</Text>
            <Text style={{ fontWeight: '700' }}>{money(routeIncome(r))}</Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Muted>{date(r.scheduleStart)} {time(r.scheduleStart)}–{time(r.actualEndTime ?? r.scheduleEnd)}</Muted>
            {r.distance > 0 ? <Muted>{num(r.distance)} {mileageUnit}</Muted> : null}
          </Row>
          <Badge label={tOr(t, r.status)} color={statusColor(r.status)} />
        </Card>
      )}
    />
  );
}
