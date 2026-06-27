import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { invoke } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Card, Field, Muted, Screen } from '@/components/Screen';
import { useBilling } from '@/hooks/useBilling';
import Paywall from '@/components/Paywall';

type Prompt = { id: string; title?: string; feature?: string; body?: string };

export default function VaultScreen() {
  const billing = useBilling();
  const [query, setQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loaded, setLoaded] = useState('');
  const [status, setStatus] = useState('');

  if (billing.needsPaywall) return <Paywall billing={billing} />;

  async function search() {
    try {
      const res = await invoke<{ prompts?: Prompt[] }>('search-prompt-vault', { query, keyword: query });
      setPrompts(res.prompts || []);
    } catch (e) { setStatus((e as Error).message); }
  }

  async function loadItem(p: Prompt) {
    try {
      const res = await invoke<{ prompt?: string; item?: Prompt }>('load-prompt-vault-item', { id: p.id });
      setLoaded(res.prompt || res.item?.body || '');
      setStatus(`Loaded ${p.title || p.id}`);
    } catch (e) { setStatus((e as Error).message); }
  }

  return (
    <Screen title="Prompt Vault">
      <Field value={query} onChangeText={setQuery} placeholder="Search prompts…" />
      <Pressable onPress={search} style={{ marginBottom: 12 }}>
        <Text style={{ color: theme.accent, textAlign: 'right' }}>Search</Text>
      </Pressable>
      {prompts.map((p) => (
        <Pressable key={p.id} onPress={() => loadItem(p)}>
          <Card>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{p.title || 'Untitled'}</Text>
            {p.feature ? <Text style={{ color: theme.muted, fontSize: 12 }}>{p.feature}</Text> : null}
          </Card>
        </Pressable>
      ))}
      {loaded ? <Card><Text style={{ color: theme.text, fontSize: 13 }}>{loaded}</Text></Card> : null}
      {status ? <Muted>{status}</Muted> : null}
    </Screen>
  );
}