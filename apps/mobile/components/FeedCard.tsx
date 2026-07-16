import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';
import { clip, compactNumber, platformColor, platformShort, relativeTime } from '@/lib/format';
import type { FeedPost } from '@/lib/types';

export type { FeedPost };

export function FeedCard({
  post,
  onDraft,
  compact,
}: {
  post: FeedPost;
  onDraft?: () => void;
  compact?: boolean;
}) {
  const body = post.content || post.text || '';
  const color = platformColor(post.platform, theme.platform);
  const plat = platformShort(post.platform);
  const likes = post.stats?.likes;
  const comments = post.stats?.comments;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.top}>
        <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}22` }]}>
          <Text style={[styles.badgeText, { color }]}>{plat}</Text>
        </View>
        {post.matchedKeyword ? (
          <Text style={styles.kw} numberOfLines={1}>#{post.matchedKeyword}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Text style={styles.time}>{relativeTime(post.createdAt)}</Text>
      </View>

      {post.author ? <Text style={styles.author}>{post.author}</Text> : null}
      <Text style={styles.body}>{clip(body, compact ? 140 : 220)}</Text>

      {(likes != null || comments != null) ? (
        <View style={styles.stats}>
          {likes != null ? (
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={13} color={theme.muted} />
              <Text style={styles.statText}>{compactNumber(likes)}</Text>
            </View>
          ) : null}
          {comments != null ? (
            <View style={styles.stat}>
              <Ionicons name="chatbubble-outline" size={13} color={theme.muted} />
              <Text style={styles.statText}>{compactNumber(comments)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {post.url ? (
          <Pressable onPress={() => Linking.openURL(post.url!)} style={styles.linkRow}>
            <Ionicons name="open-outline" size={14} color={theme.accent} />
            <Text style={styles.link}>Original</Text>
          </Pressable>
        ) : <View />}
        {onDraft ? (
          <Pressable style={styles.draftBtn} onPress={onDraft}>
            <Ionicons name="sparkles" size={13} color={theme.accent2} />
            <Text style={styles.draftText}>Draft reply</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panel,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 14,
    marginBottom: 10,
  },
  cardCompact: {
    padding: 12,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  kw: {
    flex: 1,
    color: theme.muted,
    fontSize: 12,
  },
  time: {
    color: theme.mutedDim,
    fontSize: 11,
  },
  author: {
    color: theme.textSoft,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 4,
  },
  body: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  link: {
    color: theme.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  draftBtn: {
    backgroundColor: theme.purpleGlow,
    borderColor: theme.panelBorderStrong,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  draftText: {
    color: theme.accent2,
    fontWeight: '700',
    fontSize: 12,
  },
});
