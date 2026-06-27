import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/lib/theme';
import { Btn, Card, Muted, Screen } from '@/components/Screen';
import { useBilling } from '@/hooks/useBilling';
import Paywall from '@/components/Paywall';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const billing = useBilling();
  const [showPaywall, setShowPaywall] = useState(false);

  if (showPaywall) {
    return (
      <Screen title="Premium">
        <Paywall billing={billing} />
        <Btn title="← Back" onPress={() => setShowPaywall(false)} />
      </Screen>
    );
  }

  return (
    <Screen title="Settings">
      <Card>
        <Text style={{ color: theme.text, fontWeight: '600' }}>Billing</Text>
        <Text style={{ color: theme.muted }}>Plan: {billing.plan?.planName || billing.plan?.plan || '—'}</Text>
        <Text style={{ color: theme.muted }}>Status: {billing.plan?.status || '—'}</Text>
        <Btn title="Refresh billing" onPress={() => billing.refresh()} />
        <Btn title="Manage subscription" onPress={() => setShowPaywall(true)} />
      </Card>
      <Btn title="Sign out" onPress={signOut} />
      {billing.message ? <Muted>{billing.message}</Muted> : null}
    </Screen>
  );
}