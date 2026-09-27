import { Tabs } from 'expo-router/js-tabs';
import { ColorValue, Text } from 'react-native';
import { colors } from '../../ui/components';
import { useT } from '../../ui/i18n';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerStyle: { backgroundColor: colors.card } }}>
      <Tabs.Screen name="index" options={{ title: t('dashboard'), tabBarIcon: icon('▦') }} />
      <Tabs.Screen name="routes" options={{ title: t('routes'), tabBarIcon: icon('➜') }} />
      <Tabs.Screen name="expenses" options={{ title: t('expenses'), tabBarIcon: icon('£') }} />
      <Tabs.Screen name="tax" options={{ title: t('tax'), tabBarIcon: icon('§') }} />
      <Tabs.Screen name="settings" options={{ title: t('settings'), tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
