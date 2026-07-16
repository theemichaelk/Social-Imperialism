import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Loader } from '@/components/ui';
import { View } from 'react-native';
import { theme } from '@/lib/theme';

export default function Index() {
  const { ready, token } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Loader label="Booting Command Center…" />
      </View>
    );
  }
  return token ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />;
}
