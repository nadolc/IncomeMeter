import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { newId, nowIso } from '../../db/database';
import { getById, remove, save } from '../../db/repo';
import { WorkType } from '../../domain/types';
import { Button, Card, colors, Input, Muted, Row, Screen, styles, Toggle } from '../../ui/components';
import { numText, parseNum } from '../../ui/format';
import { useT } from '../../ui/i18n';

interface SourceRow { name: string; defaultAmount: string; isRequired: boolean; category: string | null; description: string | null }

export default function EditWorkTypeScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? getById('workTypes', id) : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [isActive, setActive] = useState(existing?.isActive ?? true);
  const [sources, setSources] = useState<SourceRow[]>(() =>
    (existing?.incomeSourceTemplates ?? [])
      .slice().sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({ name: s.name, defaultAmount: numText(s.defaultAmount), isRequired: s.isRequired, category: s.category, description: s.description })));

  const setRow = (i: number, patch: Partial<SourceRow>) => setSources(sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sources.length) return;
    const next = sources.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setSources(next);
  };

  const submit = () => {
    if (!name.trim()) return Alert.alert(t('name'), t('required'));
    const rows = sources.filter((s) => s.name.trim());
    if (rows.some((s) => (parseNum(s.defaultAmount) ?? 0) < 0)) return Alert.alert(t('defaultAmount'));
    const wt: WorkType = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      description: description.trim() || null,
      isActive,
      incomeSourceTemplates: rows.map((s, i) => ({
        name: s.name.trim(), category: s.category, defaultAmount: parseNum(s.defaultAmount), isRequired: s.isRequired, description: s.description, displayOrder: i,
      })),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    save('workTypes', wt);
    router.back();
  };

  const del = () =>
    Alert.alert(t('confirmDelete'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { remove('workTypes', existing!.id); router.back(); } },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? existing.name : t('newWorkType') }} />
      <Input label={t('name')} value={name} onChangeText={setName} />
      <Input label={t('description')} value={description} onChangeText={setDescription} />
      <Toggle label={t('active')} value={isActive} onChange={setActive} />
      <Text style={styles.label}>{t('incomeSources')}</Text>
      {sources.map((s, i) => (
        <Card key={i}>
          <Row style={{ gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1.4 }]} value={s.name} placeholder={t('name')} placeholderTextColor={colors.muted}
              onChangeText={(v) => setRow(i, { name: v })} />
            <TextInput style={[styles.input, { flex: 1 }]} value={s.defaultAmount} placeholder={t('defaultAmount')} placeholderTextColor={colors.muted}
              keyboardType="decimal-pad" onChangeText={(v) => setRow(i, { defaultAmount: v })} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ gap: 6 }}>
              <Switch value={s.isRequired} onValueChange={(v) => setRow(i, { isRequired: v })} />
              <Muted>{t('isRequired')}</Muted>
            </Row>
            <Row style={{ gap: 14 }}>
              <Pressable onPress={() => move(i, -1)} hitSlop={8}><Text>▲</Text></Pressable>
              <Pressable onPress={() => move(i, 1)} hitSlop={8}><Text>▼</Text></Pressable>
              <Pressable onPress={() => setSources(sources.filter((_, j) => j !== i))} hitSlop={8}><Text style={{ color: colors.danger }}>✕</Text></Pressable>
            </Row>
          </Row>
        </Card>
      ))}
      <View>
        <Button kind="secondary" title={`+ ${t('incomeSource')}`}
          onPress={() => setSources([...sources, { name: '', defaultAmount: '', isRequired: false, category: null, description: null }])} />
      </View>
      <Button title={t('save')} onPress={submit} />
      {existing ? <Button kind="danger" title={t('delete')} onPress={del} /> : null}
    </Screen>
  );
}
