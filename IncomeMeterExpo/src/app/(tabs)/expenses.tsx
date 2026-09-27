import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { getById } from '../../db/repo';
import { recentTaxYears, taxYearFor, taxYearLabel, taxYearRange } from '../../domain/taxYear';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../../domain/types';
import { Button, Card, Chips, Empty, KV, Muted, Row, Screen } from '../../ui/components';
import { date, money, num } from '../../ui/format';
import { useCollection } from '../../ui/hooks';
import { tOr, useT } from '../../ui/i18n';

type Tab = 'expenses' | 'odometer';

export default function ExpensesScreen() {
  const t = useT();
  const expenses = useCollection('expenses');
  const readings = useCollection('odometerReadings');
  useCollection('attachments');
  const [year, setYear] = useState(taxYearFor(new Date()));
  const [tab, setTab] = useState<Tab>('expenses');
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');

  const { from, to } = taxYearRange(year);
  const inYear = (iso: string) => new Date(iso) >= from && new Date(iso) <= to;

  const yearExpenses = useMemo(
    () => expenses.filter((e) => inYear(e.date)).sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, year]);
  const shown = category === 'all' ? yearExpenses : yearExpenses.filter((e) => e.category === category);
  const byCategory = EXPENSE_CATEGORIES
    .map((c) => ({ c, total: yearExpenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) }))
    .filter((x) => x.total > 0);
  const grand = yearExpenses.reduce((s, e) => s + e.amount, 0);

  const yearReadings = readings.filter((r) => inYear(r.date)).sort((a, b) => b.date.localeCompare(a.date));
  const covered = yearReadings.length > 1 ? yearReadings[0].miles - yearReadings[yearReadings.length - 1].miles : null;

  return (
    <Screen>
      <Chips options={recentTaxYears().map((y) => ({ value: String(y), label: taxYearLabel(y) }))} value={String(year)} onChange={(v) => setYear(Number(v))} />
      <Chips options={[{ value: 'expenses', label: t('expenses') }, { value: 'odometer', label: t('odometer') }] as { value: Tab; label: string }[]} value={tab} onChange={setTab} />

      {tab === 'expenses' ? (
        <>
          <Button title={`+ ${t('newExpense')}`} onPress={() => router.push('/expenses/edit')} />
          <Card>
            {byCategory.map((x) => <KV key={x.c} k={t(x.c)} v={money(x.total)} />)}
            <KV k={t('total')} v={money(grand)} strong />
          </Card>
          <Chips options={[{ value: 'all', label: t('all') }, ...byCategory.map((x) => ({ value: x.c, label: t(x.c) }))] as { value: ExpenseCategory | 'all'; label: string }[]}
            value={category} onChange={setCategory} />
          {shown.length === 0 ? <Empty>{t('noExpenses')}</Empty> : null}
          {shown.map((e) => {
            const thumb = getById('attachments', e.attachmentIds[0])?.localUri;
            return (
              <Card key={e.id} onPress={() => router.push({ pathname: '/expenses/edit', params: { id: e.id } })}>
                <Row style={{ gap: 10 }}>
                  {thumb ? <Image source={{ uri: thumb }} style={{ width: 44, height: 44, borderRadius: 6 }} /> : null}
                  <View style={{ flex: 1 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '600' }}>{tOr(t, e.category)}</Text>
                      <Text style={{ fontWeight: '700' }}>{money(e.amount, e.currency)}</Text>
                    </Row>
                    <Muted>
                      {date(e.date)}{e.merchant ? ` · ${e.merchant}` : ''}{e.fuel?.litres ? ` · ${num(e.fuel.litres, 2)} L` : ''}
                      {e.attachmentIds.length === 0 ? ' · 📎✕' : ''}
                    </Muted>
                  </View>
                </Row>
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <Button title={`+ ${t('newReading')}`} onPress={() => router.push('/odometer/edit')} />
          {covered != null ? <Card><KV k={t('milesCovered')} v={`${num(covered, 0)}`} strong /></Card> : null}
          {yearReadings.length === 0 ? <Empty>{t('noReadings')}</Empty> : null}
          {yearReadings.map((r) => (
            <Card key={r.id} onPress={() => router.push({ pathname: '/odometer/edit', params: { id: r.id } })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '600' }}>{num(r.miles, 0)}</Text>
                <Muted>{date(r.date)}</Muted>
              </Row>
              <Muted>{tOr(t, r.source)}{r.notes ? ` · ${r.notes}` : ''}</Muted>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
