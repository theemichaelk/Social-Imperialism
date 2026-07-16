import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '@/lib/theme';

export function Skeleton({
  height = 16,
  width = '100%',
  radius = 10,
  style,
}: {
  height?: number;
  width?: number | `${number}%` | '100%';
  radius?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { height, width: width as number | `${number}%`, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

export function HomeSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton height={78} radius={18} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Skeleton height={84} style={{ flex: 1 }} />
        <Skeleton height={84} style={{ flex: 1 }} />
        <Skeleton height={84} style={{ flex: 1 }} />
      </View>
      <Skeleton height={72} radius={16} />
      <Skeleton height={120} radius={14} />
      <Skeleton height={120} radius={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(123, 148, 184, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.08)',
  },
});
