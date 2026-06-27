import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { invoke } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Btn, Card, Muted, Screen } from '@/components/Screen';
import { useBilling } from '@/hooks/useBilling';
import Paywall from '@/components/Paywall';

type Account = { id: string; platform?: string; name?: string; handle?: string };

export default function CreateScreen() {
  const billing = useBilling();
  const [content, setContent] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  if (billing.needsPaywall) return <Paywall billing={billing} />;

  async function ensureAccounts() {
    if (accounts.length) return;
    const list = await invoke<Account[]>('get-linked-accounts');
    setAccounts(list);
    setAccountId(list[0]?.id || '');
  }

  async function enhance() {
    setLoading(true);
    try {
      await ensureAccounts();
      setContent(await invoke<string>('generate-ai', `Enhance this social post: ${content}`));
      setStatus('Enhanced');
    } catch (e) { setStatus((e as Error).message); }
    setLoading(false);
  }

  async function publish() {
    const acc = accounts.find((a) => a.id === accountId) || accounts[0];
    if (!acc) { setStatus('Link an account on web first'); return; }
    setLoading(true);
    try {
      await ensureAccounts();
      const res = await invoke<{ success?: boolean; error?: string }>('publish-post', {
        accountId: acc.id, platform: acc.platform || 'LinkedIn', content, hasMedia: false, humanLike: false,
      });
      setStatus(res.success === false ? (res.error || 'Failed') : `Published via ${acc.platform}`);
    } catch (e) { setStatus((e as Error).message); }
    setLoading(false);
  }

  return (
    <Screen title="Create">
      {accounts[0] ? (
        <Card>
          <Text style={{ color: theme.muted }}>Account: {accounts.find((a) => a.id === accountId)?.name || accounts[0].platform}</Text>
        </Card>
      ) : (
        <Muted>Tap Publish — loads linked accounts from API</Muted>
      )}
      <TextInput
        style={{ backgroundColor: theme.panel, color: theme.text, minHeight: 140, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)', marginBottom: 12 }}
        multiline
        value={content}
        onChangeText={setContent}
        placeholder="Write your post…"
        placeholderTextColor={theme.muted}
      />
      <Btn title="AI Enhance" onPress={enhance} disabled={loading || !content} />
      <Btn title={loading ? 'Publishing…' : 'Publish Now'} onPress={publish} disabled={loading || !content} />
      {status ? <Muted>{status}</Muted> : null}
    </Screen>
  );
}