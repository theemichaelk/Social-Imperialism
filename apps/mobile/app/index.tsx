import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Loader } from '@/components/Screen';

export default function Index() {
  const { ready, token } = useAuth();
  if (!ready) return <Loader />;
  return token ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />;
}