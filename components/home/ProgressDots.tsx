import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors } from '../../lib/theme';

// ── Types ──

interface ProgressDotsProps {
  current: number;
  total: number;
}

// ── Dot Component ──

const Dot: React.FC<{ index: number; current: number }> = React.memo(({ index, current }) => {
  const animStyle = useAnimatedStyle(() => ({
    width: withTiming(index === current ? 24 : 8, { duration: 250 }),
    backgroundColor: withTiming(
      index === current
        ? colors.sunsetOrange
        : index < current
          ? 'rgba(249, 115, 22, 0.4)'
          : 'rgba(255, 255, 255, 0.3)',
      { duration: 250 },
    ),
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
});

// ── Component ──

export const ProgressDots: React.FC<ProgressDotsProps> = ({ current, total }) => {
  return (
    <View
      style={styles.container}
      accessibilityLabel={`Step ${current + 1} of ${total}`}
      accessibilityRole="progressbar"
    >
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} index={i} current={current} />
      ))}
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
