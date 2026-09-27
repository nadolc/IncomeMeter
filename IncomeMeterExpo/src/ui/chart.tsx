import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChartBucket } from '../domain/dashboard';
import { colors, SERIES } from './components';
import { money } from './format';

/** Stacked bars per bucket, one segment per work type. Tap a bar for its breakdown. */
export function StackedBars({ buckets, series }: { buckets: ChartBucket[]; series: string[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.income));
  const H = 140;
  const colorOf = (s: string) => SERIES[series.indexOf(s) % SERIES.length];
  const sel = selected != null ? buckets[selected] : null;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H + 18, gap: 4 }}>
        {buckets.map((b, i) => (
          <Pressable key={i} onPress={() => setSelected(selected === i ? null : i)} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ height: H, width: '70%', justifyContent: 'flex-end', opacity: selected == null || selected === i ? 1 : 0.4 }}>
              {series.filter((s) => b.incomeByWorkType[s]).map((s) => (
                <View key={s} style={{ height: (b.incomeByWorkType[s] / max) * H, backgroundColor: colorOf(s), borderRadius: 2 }} />
              ))}
              {b.income === 0 ? <View style={{ height: 2, backgroundColor: colors.border }} /> : null}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
      {sel ? (
        <View style={{ backgroundColor: colors.chip, borderRadius: 8, padding: 8, gap: 2 }}>
          <Text style={{ fontWeight: '600' }}>{sel.label} · {money(sel.income)} · {sel.routes} routes</Text>
          {Object.entries(sel.incomeByWorkType).map(([s, v]) => (
            <Text key={s} style={{ color: colors.muted }}><Text style={{ color: colorOf(s) }}>■ </Text>{s}: {money(v)}</Text>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {series.map((s) => (
            <Text key={s} style={{ fontSize: 12, color: colors.muted }}><Text style={{ color: colorOf(s) }}>■ </Text>{s}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** Horizontal share bar (per-income-source %). */
export function ShareBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.chip }}>
        {parts.map((p, i) => <View key={p.label} style={{ flex: p.value / total, backgroundColor: SERIES[i % SERIES.length] }} />)}
      </View>
      {parts.map((p, i) => (
        <Text key={p.label} style={{ fontSize: 13, color: colors.muted }}>
          <Text style={{ color: SERIES[i % SERIES.length] }}>■ </Text>{p.label}: {money(p.value)} ({Math.round((p.value / total) * 100)}%)
        </Text>
      ))}
    </View>
  );
}
