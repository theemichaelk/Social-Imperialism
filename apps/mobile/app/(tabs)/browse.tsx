import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';
import type { FeedPost } from '@/lib/types';
import { invokeWithCache } from '@/hooks/useCachedInvoke';
import { FeedCard } from '@/components/FeedCard';
import { ReplySheet } from '@/components/ReplySheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, ErrorBanner, Loader, Screen, SectionLabel } from '@/components/ui';

const FILTERS = ['All', 'X', 'LinkedIn', 'Reddit', 'Facebook', 'Instagram'] as const;

export default function BrowseScreen() {
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [replyPost, setReplyPost] = useState<FeedPost | null>(null);
  const [offline, setOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const platform =
        filter === 'All'
          ? undefined
          : filter === 'X'
            ? 'X (Twitter)'
            : filter;
      const res = await invokeWithCache<FeedPost[]>(
        'get-live-feed',
        [{ quick: !isRefresh, refresh: isRefresh, platform }],
        {
          cacheName: `live-feed:${filter}`,
          ttlMs: 1000 * 60 * 5,
        },
      );
      setFeed(Array.isArray(res.data) ? res.data : []);
      setOffline(!!res.offline);
      setFromCache(!!res.fromCache);
      if (!res.data && res.error) setError(res.error);
    } catch (e) {
      setError((e as Error).message || 'Could not load posts');
      setFeed([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed;
    return feed.filter((p) => {
      const hay = `${p.content || ''} ${p.text || ''} ${p.author || ''} ${p.matchedKeyword || ''} ${p.platform || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [feed, query]);

  return (
    <Screen
      title="Browse Posts"
      subtitle="Scout conversations · draft brand-aware replies"
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <OfflineBanner offline={offline} fromCache={fromCache && !offline} onRetry={() => load(true)} />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={theme.muted} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search posts, authors, keywords…"
          placeholderTextColor={theme.mutedDim}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={theme.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && !offline ? <ErrorBanner message={error} onRetry={() => load(false)} /> : null}
      {loading ? <Loader label="Scanning social signals…" /> : null}

      <SectionLabel>
        {loading ? 'Loading…' : `${filtered.length} post${filtered.length === 1 ? '' : 's'}`}
      </SectionLabel>

      {!loading && filtered.length === 0 ? (
        <EmptyState
          title="No posts matched"
          body="Try another filter, clear search, or pull to refresh after keywords sync."
        />
      ) : (
        filtered.map((post, i) => (
          <FeedCard
            key={`${post.platform}-${post.externalId || post.url || i}-${i}`}
            post={post}
            onDraft={() => setReplyPost(post)}
          />
        ))
      )}

      <ReplySheet
        post={replyPost}
        visible={!!replyPost}
        onClose={() => setReplyPost(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  search: {
    flex: 1,
    color: theme.text,
    paddingVertical: 12,
    fontSize: 14,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: theme.panel,
  },
  chipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentGlow,
  },
  chipText: {
    color: theme.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: theme.accent,
  },
});
