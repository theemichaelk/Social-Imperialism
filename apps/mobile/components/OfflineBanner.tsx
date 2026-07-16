import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

export function OfflineBanner({
  offline,
  fromCache,
  message,
  onRetry,
}: {
  offline?: boolean;
  fromCache?: boolean;
  message?: string | null;
  onRetry?: () => void;
}) {
  if (!offline && !fromCache && !message) return null;

  const isOffline = !!offline;
  const bg = isOffline ? 'rgba(255,176,32,0.12)' : 'rgba(0,212,255,0.1)';
  const border = isOffline ? 'rgba(255,176,32,0.4)' : 'rgba(0,212,255,0.3)';
  const color = isOffline ? theme.warn : theme.accent;
  const text =
    message
    || (isOffline
      ? 'You are offline — showing last cached mission data'
      : fromCache
        ? 'Loaded from cache · pull to refresh for live data'
        : '');

  if (!text) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons
        name={isOffline ? 'cloud-offline-outline' : 'archive-outline'}
        size={16}
        color={color}
      />
      <Text style={[styles.text, { color }]} numberOfLines={2}>{text}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={[styles.retry, { color }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  retry: {
    fontWeight: '800',
    fontSize: 12,
  },
});
