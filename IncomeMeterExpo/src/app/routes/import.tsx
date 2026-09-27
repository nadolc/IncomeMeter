import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { getAll } from '../../db/repo';
import { CSV_TEMPLATE, parseRoutesCsv } from '../../domain/csvImport';
import { saveRoute } from '../../services/routes';
import { Banner, Button, Card, colors, Input, Muted, Row, Screen } from '../../ui/components';
import { date, money, time } from '../../ui/format';
import { useT } from '../../ui/i18n';

export default function ImportRoutesScreen() {
  const t = useT();
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const parsed = useMemo(() => (text.trim() ? parseRoutesCsv(text, getAll('workTypes')) : null), [text]);
  const valid = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];

  const pick = async () => {
    const picked = await File.pickFileAsync({ mimeTypes: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'] });
    if (!picked.canceled) setText(await picked.result.text());
  };

  const shareTemplate = async () => {
    const f = new File(Paths.cache, 'routes-template.csv');
    f.write(CSV_TEMPLATE);
    await Sharing.shareAsync(f.uri, { mimeType: 'text/csv' });
  };

  const importAll = () => {
    for (const r of valid) {
      saveRoute({
        workType: r.workType!.name, workTypeId: r.workType!.id, vehicleId: null, status: 'completed',
        scheduleStart: r.scheduleStart!, scheduleEnd: r.scheduleEnd!,
        // Imported routes: actual times = schedule (BulkRouteImport).
        actualStartTime: r.scheduleStart, actualEndTime: r.scheduleEnd,
        incomes: r.incomes, estimatedIncome: 0, startMile: r.startMile, endMile: r.endMile,
      });
    }
    setResult(`${valid.length} ✓`);
    setText('');
    router.back();
  };

  return (
    <Screen>
      <Muted>workTypeName, scheduleDate (dd/MM/yyyy), fromTime, toTime (HHmm), startMile, endMile, incomeSources</Muted>
      <Row style={{ gap: 8 }}>
        <Button kind="secondary" title="CSV…" onPress={pick} style={{ flex: 1 }} />
        <Button kind="ghost" title="Template" onPress={shareTemplate} style={{ flex: 1 }} />
      </Row>
      <Input multiline value={text} onChangeText={setText} placeholder={CSV_TEMPLATE} style={{ minHeight: 120, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 }} />
      {result ? <Banner kind="success">{result}</Banner> : null}
      {parsed?.errors.map((e) => <Banner key={e} kind="error">{e}</Banner>)}
      {parsed?.rows.map((r) => (
        <Card key={r.line} style={r.errors.length ? { borderColor: colors.danger } : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600' }}>#{r.line} {r.workTypeName}</Text>
            <Text>{money(r.incomes.reduce((s, i) => s + i.amount, 0))}</Text>
          </Row>
          {r.scheduleStart ? <Muted>{date(r.scheduleStart)} {time(r.scheduleStart)}–{time(r.scheduleEnd)} · {r.startMile}→{r.endMile}</Muted> : null}
          {r.errors.map((e) => <Text key={e} style={{ color: colors.danger, fontSize: 12 }}>{e}</Text>)}
        </Card>
      ))}
      {valid.length > 0 ? <Button title={`${t('importCsv')} (${valid.length})`} onPress={importAll} /> : null}
    </Screen>
  );
}
