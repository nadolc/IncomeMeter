import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Period, periodStats, routeIncome, summaryStats } from '../../domain/dashboard';
import { ActiveRouteCard } from '../../ui/ActiveRouteCard';
import { ShareBar, StackedBars } from '../../ui/chart';
import { Badge, Button, Card, Chips, colors, Empty, H2, KV, Muted, Row, Screen, statusColor } from '../../ui/components';
import { hours, money, num, time } from '../../ui/format';
import { useCollection, useSettings } from '../../ui/hooks';
import { tOr, useT } from '../../ui/i18n';

export default function Dashboard() {
  const t = useT();
  const settings = useSettings();
  const routes = useCollection('routes');
  const [period, setPeriod] = useState<Period>(settings.defaultChartPeriod);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const active = routes.find((r) => r.status === 'in_progress') ?? null;
  const summary = useMemo(() => summaryStats(routes), [routes]);
  const stats = useMemo(
    () => periodStats(routes, period, offset, settings.language, settings.fiscalYearStart),
    [routes, period, offset, settings.language, settings.fiscalYearStart]);
  const series = useMemo(
    () => [...new Set(stats.buckets.flatMap((b) => Object.keys(b.incomeByWorkType)))],
    [stats]);

  const today = new Date().toDateString();
  const todays = routes
    .filter((r) => new Date(r.scheduleStart).toDateString() === today)
    .sort((a, b) => a.scheduleStart.localeCompare(b.scheduleStart))
    .slice(0, 10);

  return (
    <Screen>
      {active ? <ActiveRouteCard route={active} /> : <Button title={`▶  ${t('startRoute')}`} onPress={() => router.push('/routes/start')} />}

      <Row style={{ gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Muted>{t('last7Days')}</Muted>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>{money(summary.last7Days)}</Text>
          {summary.changePercent != null ? (
            <Text style={{ color: summary.changePercent >= 0 ? colors.success : colors.danger, fontSize: 12 }}>
              {summary.changePercent >= 0 ? '▲' : '▼'} {Math.abs(summary.changePercent).toFixed(0)}% {t('vsPrevious')}
            </Text>
          ) : null}
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>{t('thisMonth')}</Muted>
          <Text style={{ fontSize: 22, fontWeight: '700' }}>{money(summary.thisMonth)}</Text>
          <Muted>{t('avgDaily')}: {money(summary.averageDailyIncome)}</Muted>
        </Card>
      </Row>

      <Card>
        <Chips
          options={(['weekly', 'monthly', 'annual'] as Period[]).map((p) => ({ value: p, label: t(p) }))}
          value={period}
          onChange={(p) => { setPeriod(p); setOffset(0); }}
        />
        <Row style={{ justifyContent: 'space-between', marginVertical: 6 }}>
          <Button small kind="ghost" title="‹" onPress={() => setOffset(offset - 1)} />
          <Pressable onLongPress={() => setOffset(0)} style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{stats.title}</Text>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{money(stats.total)}</Text>
          </Pressable>
          <Button small kind="ghost" title="›" disabled={!stats.canGoNext && offset >= 0} onPress={() => setOffset(offset + 1)} />
        </Row>
        <StackedBars buckets={stats.buckets} series={series} />
      </Card>

      {stats.byWorkType.length > 0 ? <H2>{t('byWorkType')}</H2> : null}
      {stats.byWorkType.map((w) => (
        <Card key={w.workType} onPress={() => setExpanded(expanded === w.workType ? null : w.workType)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{w.workType}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{money(w.income)}</Text>
          </Row>
          <Muted>
            {w.routes} {t('routes').toLowerCase()} · {hours(w.hours)} · {money(w.hourlyRate)}{t('perHour')}
            {w.mileage > 0 ? ` · ${num(w.mileage)} ${settings.mileageUnit} · ${money(w.earningsPerMile)}/${settings.mileageUnit}` : ''}
          </Muted>
          {expanded === w.workType ? (
            <View style={{ marginTop: 8 }}>
              <ShareBar parts={Object.entries(w.incomeBySource).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
            </View>
          ) : null}
        </Card>
      ))}

      <H2>{t('todaysRoutes')}</H2>
      {todays.length === 0 ? <Empty>{t('noRoutesToday')}</Empty> : null}
      {todays.map((r) => (
        <Card key={r.id} onPress={() => router.push(`/routes/${r.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600' }}>{r.workType ?? '—'} · {time(r.scheduleStart)}</Text>
            <Text style={{ fontWeight: '700' }}>{money(routeIncome(r))}</Text>
          </Row>
          <Badge label={tOr(t, r.status)} color={statusColor(r.status)} />
        </Card>
      ))}

      <Card>
        <KV k={t('totalRoutes')} v={summary.totalRoutes} />
        <KV k={t('activeDays')} v={summary.activeDaysThisMonth} />
      </Card>
    </Screen>
  );
}
