import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';
import { clip, engagementRate } from '@/lib/format';
import type { AiReply, DashboardStats, FeedPost } from '@/lib/types';
import { invokeWithCache } from '@/hooks/useCachedInvoke';
import { notifyLocal } from '@/lib/push';
import { AppHeader } from '@/components/LogoMark';
import { BrandSwitcherCard } from '@/components/BrandSwitcher';
import { MetricCards } from '@/components/MetricCards';
import { FeedCard } from '@/components/FeedCard';
import { QuickActions } from '@/components/QuickActions';
import { PulseStrip } from '@/components/PulseStrip';
import { ReplySheet } from '@/components/ReplySheet';
import { HomeSkeleton } from '@/components/Skeleton';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Card, EmptyState, ErrorBanner, Screen, SectionLabel } from '@/components/ui';

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [drafts, setDrafts] = useState<AiReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [brief, setBrief] = useState('');
  const [replyPost, setReplyPost] = useState<FeedPost | null>(null);
  const [offline, setOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const prevDraftCountRef = useRef<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [sRes, fRes, rRes] = await Promise.all([
        invokeWithCache<DashboardStats>('get-dashboard-stats', [], {
          cacheName: 'dashboard-stats',
          ttlMs: 1000 * 60 * 10,
        }),
        invokeWithCache<FeedPost[]>('get-live-feed', [{ quick: true }], {
          cacheName: 'live-feed-quick',
          ttlMs: 1000 * 60 * 5,
        }),
        invokeWithCache<AiReply[]>('get-ai-replies', [], {
          cacheName: 'ai-replies',
          ttlMs: 1000 * 60 * 10,
        }),
      ]);

      const anyOffline = !!(sRes.offline || fRes.offline || rRes.offline);
      const anyCache = !!(sRes.fromCache || fRes.fromCache || rRes.fromCache);
      setOffline(anyOffline);
      setFromCache(anyCache);

      const s = sRes.data;
      const f = fRes.data;
      const r = rRes.data;

      setStats(s);
      setFeed(Array.isArray(f) ? f.slice(0, 6) : []);
      const replyList = Array.isArray(r) ? r : [];
      const draftList = replyList
        .filter((x) => !x.status || /draft|pending|review/i.test(String(x.status)))
        .slice(0, 4);
      setDrafts(draftList);

      const posts = s?.totalPosts ?? 0;
      const draftCount = s?.aiDrafts ?? replyList.length;
      const eng = s?.totalEngagement ?? 0;
      const worker = s?.workerStatus || 'Idle';
      const kw = s?.activeKeywords ?? 0;
      setBrief(
        `${worker === 'Idle' ? 'Command is standing by' : `Worker is ${worker.toLowerCase()}`}. `
        + `${posts} published · ${draftCount} AI drafts · ${kw} keywords · ${eng} engagement signals. `
        + (draftCount > 0
          ? 'Clear the reply queue before peak social hours.'
          : 'Scout the feed and draft brand-aware replies to stay first.'),
      );

      // Notify when new drafts appear (online live fetch only)
      const prev = prevDraftCountRef.current;
      if (!anyCache && prev != null && draftCount > prev) {
        notifyLocal(
          'New AI drafts',
          `${draftCount - prev} new reply draft(s) ready for review.`,
          { type: 'ai_drafts', count: draftCount },
        ).catch(() => undefined);
      }
      prevDraftCountRef.current = draftCount;

      const errs = [sRes.error, fRes.error, rRes.error].filter(Boolean);
      if (!s && !f && errs.length) {
        setError(errs[0] || 'Failed to load mission data');
      } else if (anyOffline) {
        setError('');
      }
    } catch (e) {
      setError((e as Error).message || 'Failed to load mission data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const posts = stats?.totalPosts ?? 0;
  const eng = stats?.totalEngagement ?? 0;
  const reach = Math.max(eng * 7.5, posts * 120);
  const live = stats?.workerStatus === 'Running' || stats?.workerStatus === 'Scanning';

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <AppHeader live={live && !offline} />
      <OfflineBanner
        offline={offline}
        fromCache={fromCache && !offline}
        onRetry={() => load(true)}
      />
      <BrandSwitcherCard />

      {error && !offline ? <ErrorBanner message={error} onRetry={() => load(false)} /> : null}
      {loading && !stats ? <HomeSkeleton /> : null}

      {!loading || stats ? (
        <>
          <MetricCards
            reach={reach}
            engagement={engagementRate(eng, Math.max(posts, 1))}
            posts={posts}
          />

          <PulseStrip
            chips={[
              {
                label: 'Worker',
                value: stats?.workerStatus || 'Idle',
                tone: live ? 'green' : 'cyan',
              },
              {
                label: 'Keywords',
                value: String(stats?.activeKeywords ?? 0),
                tone: 'purple',
              },
              {
                label: 'Scheduled',
                value: String(stats?.scheduled ?? 0),
              },
              {
                label: 'Rules',
                value: stats?.autoRulesEnabled ? 'On' : 'Off',
                tone: stats?.autoRulesEnabled ? 'green' : 'warn',
              },
              {
                label: 'Link',
                value: offline ? 'Offline' : 'Live',
                tone: offline ? 'warn' : 'green',
              },
            ]}
          />

          <QuickActions
            actions={[
              {
                key: 'browse',
                label: 'Scout',
                icon: 'compass-outline',
                onPress: () => router.push('/(tabs)/browse'),
              },
              {
                key: 'create',
                label: 'Create',
                icon: 'create-outline',
                onPress: () => router.push('/(tabs)/content'),
                accent: 'purple',
              },
              {
                key: 'studio',
                label: 'Studio',
                icon: 'color-palette-outline',
                onPress: () => router.push('/(tabs)/studio'),
              },
              {
                key: 'more',
                label: 'Ops',
                icon: 'grid-outline',
                onPress: () => router.push('/(tabs)/more'),
              },
            ]}
          />

          {brief ? (
            <Card accent="purple" style={styles.brief}>
              <View style={styles.briefTop}>
                <Ionicons name="flash" size={14} color={theme.accent2} />
                <Text style={styles.briefLabel}>IMPERIAL BRIEF</Text>
              </View>
              <Text style={styles.briefBody}>{brief}</Text>
            </Card>
          ) : null}

          {drafts.length > 0 ? (
            <>
              <SectionLabel
                right={
                  <Pressable onPress={() => router.push('/(tabs)/content')}>
                    <Text style={styles.seeAll}>Manage</Text>
                  </Pressable>
                }
              >
                Reply queue
              </SectionLabel>
              {drafts.map((d, i) => (
                <Card key={d.id || String(i)} style={styles.draftCard}>
                  <View style={styles.draftTop}>
                    <Text style={styles.draftBadge}>{d.platform || 'Social'}</Text>
                    <Text style={styles.draftStatus}>{d.status || 'draft'}</Text>
                  </View>
                  <Text style={styles.draftBody} numberOfLines={3}>
                    {clip(d.replyContent || d.content, 160)}
                  </Text>
                </Card>
              ))}
            </>
          ) : null}

          <SectionLabel
            right={
              <Pressable onPress={() => router.push('/(tabs)/browse')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            }
          >
            Live Feed
          </SectionLabel>

          {feed.length === 0 ? (
            <EmptyState
              title="Feed is quiet"
              body="Connect accounts and keywords to surface high-intent posts, then draft replies in one tap."
            />
          ) : (
            feed.map((post, i) => (
              <FeedCard
                key={`${post.platform}-${post.externalId || post.url || post.content?.slice(0, 24) || i}`}
                post={post}
                compact
                onDraft={() => setReplyPost(post)}
              />
            ))
          )}

          <Card style={styles.engine}>
            <View style={styles.engineIcon}>
              <Ionicons name="sparkles" size={20} color={theme.accent2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.engineTitle}>AI Reply Engine</Text>
              <Text style={styles.engineSub}>
                {stats?.aiDrafts ?? drafts.length} drafts · brand-mentioning replies
              </Text>
            </View>
            <Pressable
              style={styles.openBtn}
              onPress={() => {
                if (feed[0]) setReplyPost(feed[0]);
                else router.push('/(tabs)/browse');
              }}
            >
              <Text style={styles.openText}>Open</Text>
            </Pressable>
          </Card>
        </>
      ) : null}

      <ReplySheet
        post={replyPost}
        visible={!!replyPost}
        onClose={() => setReplyPost(null)}
        onSaved={() => load(true)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brief: {
    backgroundColor: 'rgba(180, 74, 255, 0.08)',
  },
  briefTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  briefLabel: {
    color: theme.accent2,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  briefBody: {
    color: theme.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  seeAll: {
    color: theme.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  draftCard: {
    paddingVertical: 12,
  },
  draftTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  draftBadge: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  draftStatus: {
    color: theme.warn,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  draftBody: {
    color: theme.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  engine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    borderColor: theme.panelBorderStrong,
  },
  engineIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.purpleGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  engineTitle: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 16,
  },
  engineSub: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 3,
  },
  openBtn: {
    backgroundColor: theme.accent2,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  openText: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 13,
  },
});
