import { Pressable, Text, TextInput, View } from 'react-native';
import { IncomeItem, WorkType } from '../domain/types';
import { Button, colors, Muted, Row, styles } from './components';
import { money, parseNum } from './format';
import { useT } from './i18n';

export interface IncomeRow { source: string; amount: string }

export const toRows = (items: IncomeItem[]): IncomeRow[] => items.map((i) => ({ source: i.source, amount: String(i.amount) }));
export const fromRows = (rows: IncomeRow[]): IncomeItem[] =>
  rows.filter((r) => r.source.trim()).map((r) => ({ source: r.source.trim(), amount: parseNum(r.amount) ?? 0 }));

/** Rows pre-filled from a work type's income source templates (RouteForm on the web). */
export const rowsFromWorkType = (wt: WorkType | null | undefined): IncomeRow[] =>
  (wt?.incomeSourceTemplates ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s) => ({ source: s.name, amount: s.defaultAmount ? String(s.defaultAmount) : '' }));

export function IncomeEditor({ rows, onChange, workType }: { rows: IncomeRow[]; onChange: (rows: IncomeRow[]) => void; workType?: WorkType | null }) {
  const t = useT();
  const set = (i: number, patch: Partial<IncomeRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const total = fromRows(rows).reduce((s, r) => s + r.amount, 0);
  const unused = (workType?.incomeSourceTemplates ?? []).filter((s) => !rows.some((r) => r.source === s.name));

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{t('incomes')}</Text>
      {rows.map((r, i) => {
        const required = workType?.incomeSourceTemplates.find((s) => s.name === r.source)?.isRequired;
        return (
          <Row key={i} style={{ gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1.3 }]} value={r.source} placeholder={t('incomeSource')} placeholderTextColor={colors.muted}
              onChangeText={(source) => set(i, { source })} />
            <TextInput
              style={[styles.input, { flex: 1 }, required && !r.amount ? { borderColor: colors.warning } : null]}
              value={r.amount} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              onChangeText={(amount) => set(i, { amount })} />
            <Pressable onPress={() => onChange(rows.filter((_, j) => j !== i))} hitSlop={8}>
              <Text style={{ color: colors.danger, fontSize: 18, paddingHorizontal: 4 }}>✕</Text>
            </Pressable>
          </Row>
        );
      })}
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {unused.map((s) => (
          <Button key={s.name} small kind="secondary" title={`+ ${s.name}`}
            onPress={() => onChange([...rows, { source: s.name, amount: s.defaultAmount ? String(s.defaultAmount) : '' }])} />
        ))}
        <Button small kind="ghost" title={`+ ${t('addIncome')}`} onPress={() => onChange([...rows, { source: '', amount: '' }])} />
      </Row>
      <Muted>{t('total')}: {money(total)}</Muted>
    </View>
  );
}
