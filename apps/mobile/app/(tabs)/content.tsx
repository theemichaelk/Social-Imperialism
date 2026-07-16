import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { invoke } from '@/lib/api';
import { theme } from '@/lib/theme';
import { clip } from '@/lib/format';
import { useBrand } from '@/context/BrandContext';
import type { AiReply, LinkedAccount } from '@/lib/types';
import {
  Btn,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loader,
  Muted,
  Screen,
  SectionLabel,
} from '@/components/ui';

type Tab = 'compose' | 'schedule' | 'replies';

export default function ContentScreen() {
  const { activeBrand } = useBrand();
  const [tab, setTab] = useState<Tab>('compose');
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [selected, setSelected] = useState<LinkedAccount | null>(null);
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [replies, setReplies] = useState<AiReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, replyList] = await Promise.all([
        invoke<LinkedAccount[]>('get-linked-accounts').catch(() => []),
        invoke<AiReply[]>('get-ai-replies').catch(() => []),
      ]);
      const safe = Array.isArray(list) ? list : [];
      setAccounts(safe);
      setSelected((prev) => prev || safe[0] || null);
      setReplies(Array.isArray(replyList) ? replyList.slice(0, 20) : []);
    } catch (e) {
      setError((e as Error).message || 'Could not load content data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function generate() {
    if (!prompt.trim()) {
      setMessage('Write a prompt or topic first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const brand = activeBrand?.brandName || activeBrand?.name || 'our brand';
      const full = `Write a social post for ${brand}. Tone: confident, helpful, not spammy. Topic: ${prompt.trim()}`;
      const res = await invoke<string | { text?: string; content?: string }>('generate-ai', full);
      const text =
        typeof res === 'string'
          ? res
          : (res && typeof res === 'object'
            ? (res.text || res.content || JSON.stringify(res))
            : '');
      setDraft(String(text || '').trim());
      setMessage('Draft ready — edit then publish or schedule.');
    } catch (e) {
      setMessage((e as Error).message || 'AI generate failed');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!draft.trim()) {
      setMessage('Nothing to publish yet.');
      return;
    }
    if (!selected) {
      setMessage('Link a social account first (Account Hub on web/desktop).');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const accountId = selected.accountId || selected.id;
      const res = await invoke<{ success?: boolean; error?: string }>('publish-post', {
        accountId,
        platform: selected.platform,
        content: draft.trim(),
        hasMedia: false,
        humanLike: true,
      });
      if (res && res.success === false) {
        setMessage(res.error || 'Publish failed');
      } else {
        setMessage('Published (or queued) successfully.');
        setDraft('');
        setPrompt('');
      }
    } catch (e) {
      setMessage((e as Error).message || 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  async function schedule() {
    if (!draft.trim()) {
      setMessage('Write or generate a draft first.');
      return;
    }
    if (!selected) {
      setMessage('Select a linked account.');
      return;
    }
    const when = scheduleTime.trim() || defaultScheduleIso();
    setBusy(true);
    setMessage('');
    try {
      const accountId = selected.accountId || selected.id;
      await invoke('schedule-post', {
        platform: selected.platform,
        accountId,
        content: draft.trim(),
        scheduleTime: when,
      });
      setMessage(`Scheduled for ${when}`);
      setDraft('');
      setPrompt('');
      await load();
    } catch (e) {
      setMessage((e as Error).message || 'Schedule failed');
    } finally {
      setBusy(false);
    }
  }

  async function publishReply(id?: string) {
    if (!id) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('publish-ai-reply', id);
      if (res && res.success === false) setMessage(res.error || 'Publish reply failed');
      else {
        setMessage('Reply published.');
        await load();
      }
    } catch (e) {
      setMessage((e as Error).message || 'Publish reply failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Content Hub"
      subtitle="Compose · schedule · clear the AI reply queue"
      refreshing={loading}
      onRefresh={load}
    >
      <View style={styles.tabs}>
        {([
          ['compose', 'Compose'],
          ['schedule', 'Schedule'],
          ['replies', 'AI Replies'],
        ] as const).map(([key, label]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      {loading ? <Loader label="Loading content workspace…" /> : null}

      {tab !== 'replies' ? (
        <>
          <SectionLabel>Account</SectionLabel>
          {accounts.length === 0 && !loading ? (
            <EmptyState
              title="No linked accounts"
              body="Connect platforms in Account Hub on web, then pull to refresh here."
            />
          ) : (
            <View style={styles.accountRow}>
              {accounts.map((acc) => {
                const id = acc.accountId || acc.id;
                const active = (selected?.accountId || selected?.id) === id;
                return (
                  <Pressable
                    key={String(id)}
                    style={[styles.accountChip, active && styles.accountChipActive]}
                    onPress={() => setSelected(acc)}
                  >
                    <Text style={[styles.accountChipText, active && styles.accountChipTextActive]} numberOfLines={1}>
                      {acc.platform || 'Social'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <SectionLabel>Compose</SectionLabel>
          <Field
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Topic or brief for AI…"
            multiline
          />
          <Btn title={busy ? 'Working…' : 'Generate with AI'} onPress={generate} disabled={busy} />

          <SectionLabel>Draft</SectionLabel>
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder="Your post draft appears here…"
            multiline
          />

          {tab === 'compose' ? (
            <Btn title="Publish now" onPress={publish} disabled={busy} style={{ marginTop: 4 }} />
          ) : (
            <>
              <SectionLabel>When (ISO or leave blank for +1h)</SectionLabel>
              <Field
                value={scheduleTime}
                onChangeText={setScheduleTime}
                placeholder="2026-07-15T18:00:00"
              />
              <Btn title={busy ? 'Scheduling…' : 'Schedule post'} onPress={schedule} disabled={busy} />
            </>
          )}
        </>
      ) : (
        <>
          <SectionLabel>{replies.length} replies</SectionLabel>
          {replies.length === 0 && !loading ? (
            <EmptyState
              title="No AI replies yet"
              body="Draft replies from Home or Browse — they land here for review."
            />
          ) : (
            replies.map((r, i) => (
              <Card key={r.id || String(i)}>
                <View style={styles.replyTop}>
                  <Text style={styles.replyPlat}>{r.platform || 'Social'}</Text>
                  <Text style={styles.replyStatus}>{r.status || 'draft'}</Text>
                </View>
                <Text style={styles.replyBody}>{clip(r.replyContent || r.content, 220)}</Text>
                {r.id ? (
                  <Btn
                    title={busy ? '…' : 'Publish reply'}
                    variant="purple"
                    onPress={() => publishReply(r.id)}
                    disabled={busy}
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </Card>
            ))
          )}
        </>
      )}

      {message ? <Muted style={{ marginTop: 12 }}>{message}</Muted> : null}
    </Screen>
  );
}

function defaultScheduleIso() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 19);
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    backgroundColor: theme.panel,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  tabText: {
    color: theme.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: theme.accent,
  },
  accountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  accountChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.panel,
  },
  accountChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  accountChipText: {
    color: theme.muted,
    fontWeight: '700',
    fontSize: 12,
    maxWidth: 120,
  },
  accountChipTextActive: {
    color: theme.accent,
  },
  replyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  replyPlat: {
    color: theme.accent,
    fontWeight: '800',
    fontSize: 12,
  },
  replyStatus: {
    color: theme.warn,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  replyBody: {
    color: theme.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
});
