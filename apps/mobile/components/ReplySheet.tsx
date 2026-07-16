import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { invoke } from '@/lib/api';
import { theme } from '@/lib/theme';
import { clip, platformShort } from '@/lib/format';
import type { FeedPost } from '@/lib/types';
import { Btn } from '@/components/ui';

type Props = {
  post: FeedPost | null;
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function ReplySheet({ post, visible, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible && post) {
      setDraft('');
      setMessage('');
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, post?.url, post?.content]);

  async function generate() {
    if (!post) return;
    setBusy(true);
    setMessage('Drafting brand-aware reply…');
    try {
      const content = post.content || post.text || '';
      const res = await invoke<string | { text?: string; reply?: string }>('draft-post-reply', {
        postContent: content,
        content,
        post,
        matchedKeyword: post.matchedKeyword,
        platform: post.platform,
      });
      const text =
        typeof res === 'string'
          ? res
          : (res && typeof res === 'object'
            ? (res.text || res.reply || JSON.stringify(res))
            : '');
      setDraft(String(text || '').trim());
      setMessage('Edit if needed, then save draft.');
    } catch (e) {
      setMessage((e as Error).message || 'Could not draft reply');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!post || !draft.trim()) {
      setMessage('Draft is empty.');
      return;
    }
    setBusy(true);
    try {
      await invoke('save-ai-reply', {
        replyContent: draft.trim(),
        content: draft.trim(),
        status: 'draft',
        platform: post.platform,
        originalPost: post.content || post.text,
        author: post.author,
        url: post.url,
        externalId: post.externalId,
        matchedKeyword: post.matchedKeyword,
      });
      setMessage('Saved to AI Reply queue.');
      onSaved?.();
      setTimeout(onClose, 500);
    } catch (e) {
      setMessage((e as Error).message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>AI Reply Engine</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>
          <Text style={styles.meta}>
            {platformShort(post.platform)}
            {post.author ? ` · ${post.author}` : ''}
          </Text>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            <View style={styles.postBox}>
              <Text style={styles.postLabel}>Original post</Text>
              <Text style={styles.postBody}>{clip(post.content || post.text, 280)}</Text>
            </View>

            <Text style={styles.postLabel}>Your reply</Text>
            {busy && !draft ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.accent2} />
                <Text style={styles.msg}>{message}</Text>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                multiline
                placeholder="AI draft appears here…"
                placeholderTextColor={theme.muted}
              />
            )}

            {message && draft ? <Text style={styles.msg}>{message}</Text> : null}

            <View style={styles.actions}>
              <Btn title="Regenerate" variant="ghost" onPress={generate} disabled={busy} style={{ flex: 1 }} />
              <Btn title={busy ? 'Saving…' : 'Save draft'} variant="purple" onPress={saveDraft} disabled={busy} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: theme.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: theme.panelBorderStrong,
    padding: 18,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.mutedDim,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { color: theme.text, fontSize: 18, fontWeight: '800' },
  meta: { color: theme.muted, fontSize: 12, marginBottom: 12 },
  postBox: {
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 12,
    marginBottom: 12,
  },
  postLabel: {
    color: theme.accent2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  postBody: { color: theme.textSoft, fontSize: 13, lineHeight: 19 },
  input: {
    minHeight: 120,
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    color: theme.text,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
  },
  loading: { alignItems: 'center', padding: 24, gap: 10 },
  msg: { color: theme.muted, fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
