import { useState } from 'react';
import { Text } from 'react-native';
import { theme } from '@/lib/theme';
import { Btn, Card, Field, Muted, Screen } from '@/components/Screen';

type Billing = {
  plan: { billingEmail?: string } | null;
  loading: boolean;
  message: string;
  checkout: (planId: string, email: string) => Promise<void>;
};

export default function Paywall({ billing }: { billing: Billing }) {
  const [email, setEmail] = useState(billing.plan?.billingEmail || '');

  return (
    <Screen>
      <Text style={{ color: theme.accent, fontSize: 24, fontWeight: '800', marginBottom: 8 }}>Unlock Premium</Text>
      <Muted>Subscribe to use Create, Vault, and Engage on mobile.</Muted>
      {[
        { id: 'starter', name: 'Starter', price: '$49/mo' },
        { id: 'growth', name: 'Growth', price: '$149/mo' },
      ].map((p) => (
        <Card key={p.id}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>{p.name} — {p.price}</Text>
          <Btn title={billing.loading ? 'Please wait…' : `Subscribe — ${p.name}`} onPress={() => billing.checkout(p.id, email)} disabled={billing.loading} />
        </Card>
      ))}
      <Field value={email} onChangeText={setEmail} placeholder="Billing email" />
      {billing.message ? <Muted>{billing.message}</Muted> : null}
    </Screen>
  );
}