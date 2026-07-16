import { useCallback, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { usePush } from '@/context/PushContext';
import { AppHeader } from '@/components/LogoMark';
import { MenuSection } from '@/components/MenuList';
import { Btn, Card, Field, Muted, Screen, SectionLabel } from '@/components/ui';
import { theme } from '@/lib/theme';
import { invoke, webUrl } from '@/lib/api';
import { cacheClear, getCacheStatus } from '@/lib/cache';
import type { BillingPlan } from '@/lib/types';

export default function MoreScreen() {
  const { me, signOut, refreshMe } = useAuth();
  const { activeBrand, brands, refresh: refreshBrands } = useBrand();
  const push = usePush();
  const [billing, setBilling] = useState<BillingPlan | null>(null);
  const [email, setEmail] = useState(me?.user?.email || me?.billing?.billingEmail || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cacheInfo, setCacheInfo] = useState('');

  const loadBilling = useCallback(async () => {
    try {
      const plan = await invoke<BillingPlan>('get-billing-plan');
      setBilling(plan && typeof plan === 'object' ? plan : null);
      if (plan?.billingEmail) setEmail(plan.billingEmail);
    } catch {
      setBilling(me?.billing || null);
    }
  }, [me?.billing]);

  const refreshCacheInfo = useCallback(async () => {
    try {
      const s = await getCacheStatus();
      const last = s.lastOnlineAt ? new Date(s.lastOnlineAt).toLocaleString() : '—';
      setCacheInfo(`${s.keyCount} cached keys · last online ${last}${s.offline ? ' · offline' : ''}`);
    } catch {
      setCacheInfo('');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBilling();
      refreshMe();
      refreshBrands();
      refreshCacheInfo();
    }, [loadBilling, refreshMe, refreshBrands, refreshCacheInfo]),
  );

  async function checkout(planId: string) {
    setBusy(true);
    setMessage('Opening checkout…');
    try {
      const res = await invoke<{ success?: boolean; error?: string; checkoutUrl?: string }>(
        'create-subscription-checkout',
        { planId, billingEmail: email.trim() || me?.user?.email },
      );
      if (res?.success === false) setMessage(res.error || 'Checkout failed');
      else if (!res?.checkoutUrl) {
        setMessage('Plan updated.');
        await loadBilling();
        await refreshMe();
      } else {
        setMessage('Complete payment in the browser, then return here.');
      }
    } catch (e) {
      setMessage((e as Error).message || 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function clearCache() {
    setBusy(true);
    try {
      await cacheClear();
      await refreshCacheInfo();
      setMessage('Offline cache cleared.');
    } catch (e) {
      setMessage((e as Error).message || 'Could not clear cache');
    } finally {
      setBusy(false);
    }
  }

  const planName = billing?.planName || billing?.plan || me?.billing?.planName || me?.billing?.plan || '—';
  const status = billing?.status || me?.billing?.status || 'unknown';
  const needsUpgrade = status !== 'active' && !me?.user?.isAdmin;

  return (
    <Screen>
      <AppHeader />

      <Card accent="purple">
        <Text style={styles.email}>{me?.user?.email || 'Signed in'}</Text>
        <Muted>
          Brand: {activeBrand?.brandName || activeBrand?.name || '—'}
          {brands.length ? ` · ${brands.length} total` : ''}
        </Muted>
        <View style={styles.planRow}>
          <Text style={styles.plan}>Plan: {planName}</Text>
          <View style={[styles.statusPill, status === 'active' ? styles.statusOn : styles.statusOff]}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
        {me?.hasActiveSubscription === false ? (
          <Muted style={{ marginTop: 8 }}>Subscription inactive — upgrade to unlock full mobile ops.</Muted>
        ) : null}
      </Card>

      <SectionLabel>Notifications</SectionLabel>
      <Card>
        <Text style={styles.sectionTitle}>
          {push.enabled ? 'Push enabled' : 'Push disabled'}
          {push.permission ? ` · ${push.permission}` : ''}
        </Text>
        <Muted>
          {Platform.OS === 'web'
            ? 'Web uses browser notifications for local alerts. Remote Expo push requires iOS/Android builds.'
            : 'Mission alerts for new AI drafts and offline recovery.'}
        </Muted>
        {push.token ? (
          <Muted style={{ marginTop: 6 }}>Token: {push.token.slice(0, 18)}…</Muted>
        ) : null}
        <View style={styles.upgradeRow}>
          {push.enabled ? (
            <Btn title="Disable" variant="ghost" onPress={() => push.disable()} style={{ flex: 1 }} />
          ) : (
            <Btn title="Enable" onPress={() => push.enable()} style={{ flex: 1 }} />
          )}
          <Btn title="Test" variant="purple" onPress={() => push.testLocal()} style={{ flex: 1 }} />
        </View>
        {push.message ? <Muted style={{ marginTop: 8 }}>{push.message}</Muted> : null}
      </Card>

      <SectionLabel>Offline cache</SectionLabel>
      <Card>
        <Muted>{cacheInfo || 'Cache status unavailable'}</Muted>
        <Btn title={busy ? '…' : 'Clear cache'} variant="ghost" onPress={clearCache} disabled={busy} style={{ marginTop: 10 }} />
      </Card>

      {needsUpgrade ? (
        <>
          <SectionLabel>Upgrade</SectionLabel>
          <Field value={email} onChangeText={setEmail} placeholder="Billing email" />
          <View style={styles.upgradeRow}>
            <Btn
              title={busy ? '…' : 'Starter $49'}
              onPress={() => checkout('starter')}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Btn
              title={busy ? '…' : 'Growth $149'}
              variant="purple"
              onPress={() => checkout('growth')}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : null}

      {message ? <Muted style={{ marginBottom: 10 }}>{message}</Muted> : null}

      <MenuSection
        title="STUDIO & GROWTH"
        items={[
          { key: 'design', label: 'Design Studio', icon: 'color-palette-outline', path: '/design-studio' },
          { key: 'video', label: 'Video Studio', icon: 'videocam-outline', path: '/video-studio' },
          { key: 'growth', label: 'Growth Lab', icon: 'rocket-outline', path: '/reddit-ai' },
          { key: 'quora', label: 'Quora Ops', icon: 'chatbox-ellipses-outline', path: '/quora-traffic' },
          { key: 'vault', label: 'Prompt Vault', icon: 'lock-closed-outline', path: '/prompt-vault' },
          { key: 'campaigns', label: 'Campaigns', icon: 'flag-outline', path: '/campaign-manager' },
          { key: 'auto', label: 'Automations', icon: 'git-network-outline', path: '/automations' },
          { key: 'keywords', label: 'Keywords', icon: 'key-outline', path: '/keywords' },
          { key: 'seo', label: 'SEO Tools', icon: 'search-outline', path: '/seo-tools' },
        ]}
      />

      <MenuSection
        title="SYSTEM"
        items={[
          { key: 'accounts', label: 'Account Hub', icon: 'people-outline', path: '/account-hub' },
          { key: 'settings', label: 'Settings', icon: 'settings-outline', path: '/settings' },
          { key: 'integrations', label: 'Integrations', icon: 'extension-puzzle-outline', path: '/integrations' },
          { key: 'dns', label: 'DNS', icon: 'globe-outline', path: '/dns' },
          { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', path: '/calendar' },
          {
            key: 'billing',
            label: 'Billing & Plan',
            icon: 'card-outline',
            onPress: () => Linking.openURL(webUrl('/subscribe')),
          },
          {
            key: 'support',
            label: 'Support',
            icon: 'help-buoy-outline',
            onPress: () => Linking.openURL(webUrl('/support')),
          },
        ]}
      />

      <Btn title="Sign out" variant="danger" onPress={() => signOut()} />
      <Text style={styles.version}>Social Imperialism Mobile · Command Center v2.2</Text>
      <View style={{ height: 12 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  plan: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusOn: {
    backgroundColor: 'rgba(0,255,157,0.15)',
  },
  statusOff: {
    backgroundColor: 'rgba(255,176,32,0.15)',
  },
  statusText: {
    color: theme.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  upgradeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  version: {
    color: theme.mutedDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
  },
});
