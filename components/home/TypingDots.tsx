import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

// ── Component ──

export const TypingDots: React.FC = () => {
  const dot0 = useSharedValue(0);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);

  useEffect(() => {
    const anim = (delay: number) =>
      withDelay(delay, withRepeat(
        withSequence(
          withTiming(-6, { duration: 500 }),
          withTiming(0, { duration: 500 }),
        ),
        -1,
      ));

    dot0.value = anim(0);
    dot1.value = anim(250);
    dot2.value = anim(500);
  }, []);

  const s0 = useAnimatedStyle(() => ({ transform: [{ translateY: dot0.value }] }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));

  return (
    <View style={styles.container} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Animated.View style={[styles.dot, s0]} />
      <Animated.View style={[styles.dot, s1]} />
      <Animated.View style={[styles.dot, s2]} />
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.38)',
  },
});
