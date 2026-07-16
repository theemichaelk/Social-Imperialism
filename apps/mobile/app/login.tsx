import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Btn, Field, Screen } from '@/components/ui';
import { LogoMark } from '@/components/LogoMark';
import { theme } from '@/lib/theme';
import { webUrl } from '@/lib/api';

export default function LoginScreen() {
  const { token, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Redirect href="/(tabs)" />;

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError((e as Error).message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={styles.hero}>
          <View style={styles.glow} />
          <LogoMark size={64} />
          <Text style={styles.title}>Social Imperialism</Text>
          <Text style={styles.sub}>
            Mobile Command Center — sign in with your subscription email.
          </Text>
        </View>

        <View style={styles.card}>
          <Field value={email} onChangeText={setEmail} placeholder="Email" />
          <Field value={password} onChangeText={setPassword} placeholder="Password" secure />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Btn title={loading ? 'Signing in…' : 'Sign In'} onPress={submit} disabled={loading} />
        </View>

        <Pressable onPress={() => Linking.openURL(webUrl('/subscribe'))} style={styles.link}>
          <Text style={styles.linkPurple}>No account yet? Subscribe →</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(webUrl('/setup-account'))} style={styles.link}>
          <Text style={styles.linkMuted}>Set up password after checkout</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(webUrl('/forgot-password'))} style={styles.link}>
          <Text style={styles.linkMuted}>Forgot password?</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(180, 74, 255, 0.12)',
    top: -20,
  },
  title: {
    color: theme.accent,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 14,
  },
  sub: {
    color: theme.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: theme.panel,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 16,
  },
  error: {
    color: theme.danger,
    marginBottom: 10,
    fontSize: 13,
  },
  link: { marginTop: 14 },
  linkPurple: {
    color: theme.accent2,
    textAlign: 'center',
    fontWeight: '700',
  },
  linkMuted: {
    color: theme.muted,
    textAlign: 'center',
    fontSize: 13,
  },
});
