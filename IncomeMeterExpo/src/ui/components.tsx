import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput, TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { date as fmtDate, time as fmtTime } from './format';

export const colors = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#15181E',
  muted: '#6B7280',
  border: '#E3E5E9',
  primary: '#1F6FEB',
  primaryText: '#FFFFFF',
  danger: '#D1242F',
  success: '#1A7F37',
  warning: '#B35900',
  info: '#0969DA',
  chip: '#EEF1F5',
};

/** Colours for stacked chart segments (one per work type), like SOURCE_COLORS on the web. */
export const SERIES = ['#1F6FEB', '#1A7F37', '#BF8700', '#8250DF', '#CF222E', '#0A7EA4', '#A0522D', '#6E7781'];

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  const style = [styles.screen, padded && styles.padded, { paddingBottom: insets.bottom + 24 }];
  return scroll
    ? <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={style} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[{ flex: 1 }, ...style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.7 }]}>{children}</Pressable>;
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.h2Row}>
      <Text style={styles.h2}>{children}</Text>
      {right}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function KV({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.muted}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number'
        ? <Text style={[styles.value, strong && { fontWeight: '700' }]}>{v}</Text>
        : v}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ title, onPress, kind = 'primary', disabled, busy, style, small }: {
  title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const bg = { primary: colors.primary, secondary: colors.chip, danger: colors.danger, ghost: 'transparent' }[kind];
  const fg = kind === 'primary' || kind === 'danger' ? colors.primaryText : kind === 'ghost' ? colors.primary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput> & { label?: string; hint?: string; error?: string | null }) {
  const { label, hint, error, style, ...rest } = props;
  const input = <TextInput placeholderTextColor={colors.muted} {...rest} style={[styles.input, !!error && { borderColor: colors.danger }, style]} />;
  return label ? <Field label={label} hint={hint} error={error}>{input}</Field> : input;
}

export function NumberInput({ value, onChange, decimal = true, ...rest }: {
  value: string; onChange: (s: string) => void; decimal?: boolean; label?: string; hint?: string; error?: string | null; placeholder?: string;
}) {
  return <Input value={value} onChangeText={onChange} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} {...rest} />;
}

export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; label?: string;
}) {
  const chips = (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  return label ? <Field label={label}>{chips}</Field> : chips;
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.row, styles.field, { justifyContent: 'space-between' }]}>
      <Text style={[styles.value, { flex: 1, paddingRight: 12 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

/** Date or date+time picker; value is an ISO string (or null when `optional`). */
export function DateTimeField({ label, value, onChange, mode = 'datetime', optional }: {
  label: string; value: string | null; onChange: (iso: string | null) => void; mode?: 'date' | 'datetime'; optional?: boolean;
}) {
  const current = value ? new Date(value) : new Date();

  const openAndroid = (m: 'date' | 'time', base: Date) =>
    DateTimePickerAndroid.open({
      value: base,
      mode: m,
      is24Hour: true,
      onValueChange: (_e, picked) => {
        const next = new Date(base);
        if (m === 'date') next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        if (m === 'date' && mode === 'date') next.setHours(12, 0, 0, 0);
        onChange(next.toISOString());
        if (m === 'date' && mode === 'datetime') openAndroid('time', next);
      },
    });

  return (
    <Field label={label}>
      <View style={[styles.row, { gap: 8 }]}>
        {Platform.OS === 'ios' ? (
          value || !optional ? (
            <DateTimePicker
              value={current}
              mode={mode}
              display="compact"
              onValueChange={(_e, picked) => {
                if (mode === 'date') picked.setHours(12, 0, 0, 0);
                onChange(picked.toISOString());
              }}
            />
          ) : (
            <Button small kind="secondary" title="+" onPress={() => onChange(new Date().toISOString())} />
          )
        ) : (
          <Pressable style={[styles.input, { flex: 1 }]} onPress={() => openAndroid('date', current)}>
            <Text style={styles.value}>{value ? (mode === 'date' ? fmtDate(value) : `${fmtDate(value)} ${fmtTime(value)}`) : '—'}</Text>
          </Pressable>
        )}
        {optional && value ? <Button small kind="ghost" title="✕" onPress={() => onChange(null)} /> : null}
      </View>
    </Field>
  );
}

export function Banner({ kind, children }: { kind: 'info' | 'warning' | 'error' | 'success'; children: ReactNode }) {
  const c = { info: colors.info, warning: colors.warning, error: colors.danger, success: colors.success }[kind];
  return (
    <View style={[styles.banner, { borderLeftColor: c }]}>
      <Text style={{ color: colors.text }}>{children}</Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 24 }]}>{children}</Text>;
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export const statusColor = (status: string) =>
  ({ scheduled: colors.info, in_progress: colors.warning, completed: colors.success, cancelled: colors.muted }[status] ?? colors.muted);

export const styles = StyleSheet.create({
  screen: { gap: 12 },
  padded: { padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  h1: { fontSize: 26, fontWeight: '700', color: colors.text },
  h2Row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, gap: 12 },
  button: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { gap: 6, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  hint: { fontSize: 12, color: colors.muted },
  error: { fontSize: 12, color: colors.danger },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 16, color: colors.text, minHeight: 44, justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.chip },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextOn: { color: colors.primaryText, fontWeight: '600' },
  banner: { backgroundColor: colors.card, borderLeftWidth: 4, borderRadius: 8, padding: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
});
