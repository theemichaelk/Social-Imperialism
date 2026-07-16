import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/lib/theme';

type Chip = { label: string; value: string; tone?: 'cyan' | 'purple' | 'green' | 'warn' };

export function PulseStrip({ chips }: { chips: Chip[] }) {
  if (!chips.length) return null;
  return (
    <View style={styles.wrap}>
      {chips.map((c) => {
        const color =
          c.tone === 'purple'
            ? theme.accent2
            : c.tone === 'green'
              ? theme.success
              : c.tone === 'warn'
                ? theme.warn
                : theme.accent;
        return (
          <View key={c.label} style={[styles.chip, { borderColor: `${color}55` }]}>
            <Text style={[styles.label, { color }]}>{c.label}</Text>
            <Text style={styles.value}>{c.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: theme.panelSoft,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
