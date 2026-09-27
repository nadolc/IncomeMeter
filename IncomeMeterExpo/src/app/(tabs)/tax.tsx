import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Box, buildCombinedReport, buildReport, reportToCsv, TaxData, TaxReport, Warning } from '../../domain/taxReport';
import { recentTaxYears, taxYearFor, taxYearLabel } from '../../domain/taxYear';
import { Banner, Button, Card, Chips, colors, H2, KV, Muted, NumberInput, Screen } from '../../ui/components';
import { date, money, num, parseNum } from '../../ui/format';
import { useCollection } from '../../ui/hooks';
import { tOr, useT } from '../../ui/i18n';

export default function TaxScreen() {
  const t = useT();
  const routes = useCollection('routes');
  const expenses = useCollection('expenses');
  const readings = useCollection('odometerReadings');
  const vehicles = useCollection('vehicles');
  const attachments = useCollection('attachments');
  const [year, setYear] = useState(taxYearFor(new Date()));
  const [vehicleId, setVehicleId] = useState<string>('');
  const [override, setOverride] = useState('');

  const data: TaxData = useMemo(() => ({
    routes, expenses, odometerReadings: readings, vehicles, attachmentIds: new Set(attachments.map((a) => a.id)),
  }), [routes, expenses, readings, vehicles, attachments]);
  const pct = parseNum(override);

  const combined = useMemo(
    () => (vehicleId ? null : buildCombinedReport(data, year, {})),
    [data, year, vehicleId]);
  const single = useMemo(
    () => (vehicleId ? buildReport(data, year, vehicleId, pct) : null),
    [data, year, vehicleId, pct]);

  const exportCsv = async () => {
    const reports = single ? [single] : combined?.vehicles ?? [];
    if (reports.length === 0) return;
    const text = reports.map(reportToCsv).join('\n\n');
    const f = new File(Paths.cache, `tax-year-${taxYearLabel(year).replace('/', '-')}.csv`);
    f.write(text);
    await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: t('exportCsv') });
  };

  return (
    <Screen>
      <Chips options={recentTaxYears().map((y) => ({ value: String(y), label: taxYearLabel(y) }))} value={String(year)} onChange={(v) => setYear(Number(v))} />
      <Chips options={[{ value: '', label: t('combined') }, ...vehicles.map((v) => ({ value: v.id, label: v.registration }))]}
        value={vehicleId} onChange={setVehicleId} />
      {vehicleId ? <NumberInput label={t('businessUseOverride')} value={override} onChange={setOverride} placeholder="%" /> : null}

      {combined ? (
        <>
          <Card>
            <KV k={t('businessMiles')} v={num(combined.totalBusinessMiles)} />
            <KV k={t('totalClaim')} v={money(combined.totalClaim, 'GBP', 'en-GB')} strong />
            {combined.unassignedRoutes + combined.unassignedExpenses + combined.unassignedOdometerReadings > 0
              ? <KV k={t('unassigned')} v={`${combined.unassignedRoutes} / ${combined.unassignedExpenses} / ${combined.unassignedOdometerReadings}`} />
              : null}
          </Card>
          <Warnings items={combined.warnings} />
          <Boxes boxes={combined.sa103Boxes} />
          {combined.vehicles.map((r) => <ReportView key={r.vehicle?.id} report={r} compact />)}
        </>
      ) : single ? <ReportView report={single} /> : null}

      <Button kind="secondary" title={t('exportCsv')} onPress={exportCsv} />
      <Muted>{(combined ?? single)?.disclaimer}</Muted>
    </Screen>
  );
}

const gbp = (v: number) => money(v, 'GBP', 'en-GB');

function ReportView({ report: r, compact }: { report: TaxReport; compact?: boolean }) {
  const t = useT();
  const ca = r.capitalAllowance;
  return (
    <View style={{ gap: 12 }}>
      {r.vehicle ? <H2>{r.vehicle.registration}{r.vehicle.description ? ` · ${r.vehicle.description}` : ''}</H2> : null}
      <Card>
        <KV k={t('businessMiles')} v={`${num(r.mileage.businessMiles)} (${r.mileage.routesCounted} ${t('routes').toLowerCase()})`} />
        <KV k={t('totalMiles')} v={r.mileage.totalMiles != null ? num(r.mileage.totalMiles) : '—'} />
        {r.mileage.odometerStart ? <Muted>{date(r.mileage.odometerStart.date)} {num(r.mileage.odometerStart.miles, 0)} → {date(r.mileage.odometerEnd!.date)} {num(r.mileage.odometerEnd!.miles, 0)}</Muted> : null}
        <KV k={t('businessUse')} v={r.mileage.businessUsePercent != null ? `${r.mileage.businessUsePercent}% (${r.mileage.businessUseSource})` : '—'} strong />
      </Card>
      {!compact ? <Warnings items={r.warnings} /> : null}
      <Card>
        <H2>{t('expenses')}</H2>
        {r.categories.map((c) => (
          <View key={c.category}>
            <KV k={`${tOr(t, c.category)} (${c.count})`} v={gbp(c.total)} />
            <Muted style={{ textAlign: 'right' }}>
              {c.coveredByFlatRate ? t('mileage') : c.excludedFromRunningCosts ? t('capitalAllowance') : `${t('allowable')} ${gbp(c.allowable)}`}
              {c.receiptsMissing ? ` · ${t('receiptsMissing')}: ${c.receiptsMissing}` : ''}
            </Muted>
          </View>
        ))}
        <KV k={t('allowable')} v={gbp(r.totals.allowable)} strong />
        <KV k={t('disallowable')} v={gbp(r.totals.disallowable)} />
      </Card>
      <Card>
        <H2>{t('capitalAllowance')}</H2>
        {ca.applicable ? (
          <>
            <Muted>{ca.allowanceLabel}</Muted>
            {ca.qualifyingExpenditure != null ? <KV k="Qualifying expenditure" v={gbp(ca.qualifyingExpenditure)} /> : null}
            {ca.poolBroughtForward ? <KV k={t('poolBf')} v={gbp(ca.poolBroughtForward)} /> : null}
            <KV k="Gross" v={gbp(ca.grossAllowance)} />
            <KV k={t('businessUse')} v={gbp(ca.allowance)} strong />
            {!ca.isDisposal ? <KV k="Pool c/f" v={gbp(ca.poolCarriedForward)} /> : null}
          </>
        ) : <Muted>{ca.reason}</Muted>}
      </Card>
      <Card>
        <H2>{t('comparison')}</H2>
        <KV k={t('actualCost')} v={gbp(r.comparison.actualCostTotal)} />
        <KV k={`${t('simplified')} (${num(r.simplifiedExpenses.firstBandMiles, 0)}×${r.simplifiedExpenses.firstBandRate}${r.simplifiedExpenses.secondBandMiles ? ` + ${num(r.simplifiedExpenses.secondBandMiles, 0)}×${r.simplifiedExpenses.secondBandRate}` : ''})`}
          v={gbp(r.comparison.simplifiedTotal)} />
        <KV k={t('betterMethod')} v={`${tOr(t, r.comparison.betterMethod)}${r.comparison.lockedToOtherMethod ? ' 🔒' : ''}`} strong />
      </Card>
      {!compact ? <Boxes boxes={r.sa103Boxes} /> : null}
    </View>
  );
}

function Boxes({ boxes }: { boxes: Box[] }) {
  const t = useT();
  if (boxes.length === 0) return null;
  return (
    <Card>
      <H2>{t('sa103')}</H2>
      {boxes.map((b) => (
        <View key={`${b.form}-${b.box}`} style={{ paddingVertical: 4 }}>
          <KV k={`${b.form} box ${b.box}`} v={gbp(b.amount)} strong />
          <Muted>{b.label}</Muted>
          <Text style={{ fontSize: 12, color: colors.muted }}>{b.note}</Text>
        </View>
      ))}
    </Card>
  );
}

function Warnings({ items }: { items: Warning[] }) {
  return (
    <>
      {items.map((w, i) => (
        <Banner key={`${w.code}-${i}`} kind={w.severity === 'error' ? 'error' : w.severity === 'warning' ? 'warning' : 'info'}>{w.message}</Banner>
      ))}
    </>
  );
}

