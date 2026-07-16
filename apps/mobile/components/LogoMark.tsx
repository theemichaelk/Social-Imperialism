import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

export function LogoMark({ size = 36 }: { size?: number }) {
  const fontSize = Math.round(size * 0.38);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={[styles.si, { fontSize }]}>SI</Text>
    </View>
  );
}

export function AppHeader({ live = true }: { live?: boolean }) {
  return (
    <View style={styles.header}>
      <LogoMark size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>SOCIAL IMPERIALISM</Text>
        <View style={styles.liveRow}>
          <View style={[styles.dot, { backgroundColor: live ? theme.live : theme.muted }]} />
          <Text style={styles.liveText}>{live ? 'Live · Command' : 'Offline'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(180, 74, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(180, 74, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  si: {
    color: theme.accent2,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  brand: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveText: {
    color: theme.muted,
    fontSize: 12,
  },
});
