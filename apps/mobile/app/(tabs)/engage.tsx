import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { invoke } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Btn, Card, Loader, Muted, Screen } from '@/components/Screen';
import { useBilling } from '@/hooks/useBilling';
import Paywall from '@/components/Paywall';

type Item = { id: string; platform?: string; content?: string; action?: string; status?: string };

export default function EngageScreen() {
  const billing = useBilling();
  const [queue, setQueue] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  if (billing.needsPaywall) return <Paywall billing={billing} />;

  const load = useCallback(async () => {
    try {
      setQueue(await invoke<Item[]>('get-engagement-queue'));
    } catch (e) { setStatus((e as Error).message); }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function retry() {
    setStatus('Processing…');
    try {
      await invoke('retry-engagement-queue');
      setStatus('Retry dispatched');
      await load();
    } catch (e) { setStatus((e as Error).message); }
  }

  return (
    <Screen title="Engage">
      <Btn title="Retry queue" onPress={retry} />
      {loading ? <Loader /> : null}
      {queue.length === 0 && !loading ? <Muted>Engagement queue is empty</Muted> : null}
      {queue.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>{item.platform} · {item.status}</Text>
          <Text style={{ color: theme.text, fontSize: 13, marginTop: 6 }} numberOfLines={4}>{item.content}</Text>
          {item.action ? <Text style={{ color: theme.accent2, fontSize: 11, marginTop: 4 }}>{item.action.toUpperCase()}</Text> : null}
        </Card>
      ))}
      {status ? <Muted>{status}</Muted> : null}
    </Screen>
  );
}