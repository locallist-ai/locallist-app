import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

// ── Types ──

interface FloatingEmojiProps {
  emoji: string;
  size: number;
  startX: number;
  startY: number;
  delay: number;
  driftX: number;
  driftY: number;
  duration: number;
  rotateDeg: number;
}

// ── Component ──

export const FloatingEmoji: React.FC<FloatingEmojiProps> = ({
  emoji,
  size,
  startX,
  startY,
  delay: d,
  driftX,
  driftY,
  duration,
  rotateDeg,
}) => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withDelay(d, withTiming(0.5, { duration: 600 }));
    scale.value = withDelay(d, withSpring(1, { damping: 12 }));

    translateX.value = withDelay(d, withRepeat(
      withSequence(
        withTiming(driftX, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(-driftX * 0.6, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    ));
    translateY.value = withDelay(d, withRepeat(
      withSequence(
        withTiming(driftY, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
        withTiming(-driftY * 0.7, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    ));
    rotate.value = withDelay(d, withRepeat(
      withSequence(
        withTiming(rotateDeg, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
        withTiming(-rotateDeg, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    ));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.container, { left: startX, top: startY }, animatedStyle]}>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});
