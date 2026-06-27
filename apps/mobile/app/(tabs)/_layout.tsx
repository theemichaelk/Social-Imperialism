import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/lib/theme';
import { Loader } from '@/components/Screen';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function TabLayout() {
  const { ready, token } = useAuth();
  if (!ready) return <Loader />;
  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.panel, borderTopColor: 'rgba(0,212,255,0.2)' },
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Mission', tabBarIcon: ({ color }) => <TabIcon name="speedometer" color={color} /> }} />
      <Tabs.Screen name="create" options={{ title: 'Create', tabBarIcon: ({ color }) => <TabIcon name="create-outline" color={color} /> }} />
      <Tabs.Screen name="vault" options={{ title: 'Vault', tabBarIcon: ({ color }) => <TabIcon name="lock-closed-outline" color={color} /> }} />
      <Tabs.Screen name="engage" options={{ title: 'Engage', tabBarIcon: ({ color }) => <TabIcon name="chatbubbles-outline" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <TabIcon name="settings-outline" color={color} /> }} />
    </Tabs>
  );
}