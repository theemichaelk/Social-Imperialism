import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';
import { compactNumber } from '@/lib/format';

type Metric = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export function MetricCards({
  reach,
  engagement,
  posts,
}: {
  reach: number;
  engagement: string;
  posts: number;
}) {
  const items: Metric[] = [
    { label: 'Reach', value: compactNumber(reach), icon: 'radio-outline', color: theme.accent },
    { label: 'Engagement', value: engagement, icon: 'pulse-outline', color: theme.accent2 },
    { label: 'Posts', value: compactNumber(posts), icon: 'layers-outline', color: theme.success },
  ];

  return (
    <View style={styles.row}>
      {items.map((m) => (
        <View key={m.label} style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: `${m.color}18` }]}>
            <Ionicons name={m.icon} size={14} color={m.color} />
          </View>
          <Text style={styles.label}>{m.label}</Text>
          <Text style={styles.value}>{m.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  label: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
