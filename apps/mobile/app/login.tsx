import { useState } from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Btn, Field, Screen } from '@/components/Screen';
import { theme } from '@/lib/theme';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://www.socialimperialism.com';

export default function LoginScreen() {
  const { token, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Redirect href="/(tabs)" />;

  async function submit() {
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function openWeb(path: string) {
    Linking.openURL(`${WEB_URL}${path}`);
  }

  return (
    <Screen>
      <Text style={{ color: theme.accent, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
        Social Imperialism
      </Text>
      <Text style={{ color: theme.muted, marginBottom: 20 }}>
        Sign in with the email you used for your subscription.
      </Text>
      <Field value={email} onChangeText={setEmail} placeholder="Email" />
      <Field value={password} onChangeText={setPassword} placeholder="Password" secure />
      {error ? <Text style={{ color: theme.warn, marginBottom: 8 }}>{error}</Text> : null}
      <Btn title={loading ? 'Please wait…' : 'Sign In'} onPress={submit} disabled={loading} />
      <Pressable onPress={() => openWeb('/subscribe')} style={{ marginTop: 16 }}>
        <Text style={{ color: theme.accent2, textAlign: 'center' }}>
          No account yet? Subscribe to get access →
        </Text>
      </Pressable>
      <Pressable onPress={() => openWeb('/setup-account')} style={{ marginTop: 12 }}>
        <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 13 }}>
          Set up password after checkout
        </Text>
      </Pressable>
    </Screen>
  );
}