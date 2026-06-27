import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Btn, Field, Screen } from '@/components/Screen';
import { theme } from '@/lib/theme';

export default function LoginScreen() {
  const { token, signIn, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Redirect href="/(tabs)" />;

  async function submit() {
    setLoading(true);
    setError('');
    try {
      if (isRegister) await register(email, password, name);
      else await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ color: theme.accent, fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
        Social Imperialism
      </Text>
      <Text style={{ color: theme.muted, marginBottom: 20 }}>
        {isRegister ? 'Create account' : 'Sign in to Mission Control'}
      </Text>
      {isRegister && <Field value={name} onChangeText={setName} placeholder="Name (optional)" />}
      <Field value={email} onChangeText={setEmail} placeholder="Email" />
      <Field value={password} onChangeText={setPassword} placeholder="Password" secure />
      {error ? <Text style={{ color: theme.warn, marginBottom: 8 }}>{error}</Text> : null}
      <Btn title={loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'} onPress={submit} disabled={loading} />
      <Pressable onPress={() => { setIsRegister(!isRegister); setError(''); }} style={{ marginTop: 16 }}>
        <Text style={{ color: theme.accent2, textAlign: 'center' }}>
          {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </Text>
      </Pressable>
    </Screen>
  );
}