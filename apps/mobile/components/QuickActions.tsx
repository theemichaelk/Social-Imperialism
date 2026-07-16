import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

export type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accent?: 'cyan' | 'purple';
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={styles.row}>
      {actions.map((a) => {
        const purple = a.accent === 'purple';
        return (
          <Pressable
            key={a.key}
            style={[styles.item, purple && styles.itemPurple]}
            onPress={a.onPress}
          >
            <View style={[styles.icon, purple && styles.iconPurple]}>
              <Ionicons name={a.icon} size={18} color={purple ? theme.accent2 : theme.accent} />
            </View>
            <Text style={styles.label} numberOfLines={1}>{a.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  item: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  itemPurple: {
    borderColor: 'rgba(180, 74, 255, 0.35)',
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPurple: {
    backgroundColor: theme.purpleGlow,
  },
  label: {
    color: theme.textSoft,
    fontSize: 11,
    fontWeight: '700',
  },
});
