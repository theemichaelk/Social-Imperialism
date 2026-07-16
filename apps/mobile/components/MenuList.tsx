import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';
import { webUrl } from '@/lib/api';

export type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path?: string;
  onPress?: () => void;
};

export function MenuSection({
  title,
  items,
}: {
  title: string;
  items: MenuItem[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {items.map((item, idx) => (
          <Pressable
            key={item.key}
            style={[styles.row, idx < items.length - 1 && styles.rowBorder]}
            onPress={() => {
              if (item.onPress) item.onPress();
              else if (item.path) Linking.openURL(webUrl(item.path));
            }}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={18} color={theme.accent} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.mutedDim} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  title: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
    marginLeft: 4,
  },
  list: {
    backgroundColor: theme.panel,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,212,255,0.1)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
