import { router } from 'expo-router';
import { Text } from 'react-native';
import { Badge, Button, Card, colors, Empty, Muted, Row, Screen } from '../../ui/components';
import { useCollection } from '../../ui/hooks';
import { useT } from '../../ui/i18n';

export default function WorkTypesScreen() {
  const t = useT();
  const workTypes = useCollection('workTypes').sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Screen>
      <Button title={`+ ${t('newWorkType')}`} onPress={() => router.push('/worktypes/edit')} />
      {workTypes.length === 0 ? <Empty>—</Empty> : null}
      {workTypes.map((w) => (
        <Card key={w.id} onPress={() => router.push({ pathname: '/worktypes/edit', params: { id: w.id } })}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{w.name}</Text>
            {!w.isActive ? <Badge label="off" color={colors.muted} /> : null}
          </Row>
          {w.description ? <Muted>{w.description}</Muted> : null}
          <Muted>{w.incomeSourceTemplates.map((s) => s.name + (s.isRequired ? '*' : '')).join(' · ')}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
