import { useCallback, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { invoke } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Card, Loader, Screen } from '@/components/Screen';

type Stats = {
  totalPosts?: number; aiDrafts?: number; totalEngagement?: number;
  activeKeywords?: number; linkedAccounts?: number; scheduled?: number; workerStatus?: string;
};

export default function MissionScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setStats(await invoke<Stats>('get-dashboard-stats'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(!stats); load(); }, [load, stats]));

  const items = stats ? [
    ['Posts', stats.totalPosts], ['AI Drafts', stats.aiDrafts], ['Engagement', stats.totalEngagement],
    ['Keywords', stats.activeKeywords], ['Accounts', stats.linkedAccounts], ['Scheduled', stats.scheduled],
  ] : [];

  return (
    <Screen title="Mission Control">
      {loading && !stats ? <Loader /> : null}
      {error ? <Text style={{ color: theme.warn }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map(([label, value]) => (
          <Card key={String(label)}>
            <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{value ?? 0}</Text>
          </Card>
        ))}
      </View>
      {stats?.workerStatus ? (
        <Card>
          <Text style={{ color: theme.text, fontWeight: '600' }}>Worker</Text>
          <Text style={{ color: theme.accent }}>{stats.workerStatus}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}