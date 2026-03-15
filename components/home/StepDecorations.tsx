import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { FloatingEmoji } from './FloatingEmoji';
import { LogoPiece } from './LogoPiece';

// ── Types ──

interface StepDecorationsProps {
  step: number;
  screenWidth: number;
  screenHeight: number;
}

interface EmojiConfig {
  emoji: string;
  size: number;
  x: number;
  y: number;
  delay: number;
  dx: number;
  dy: number;
  dur: number;
  rot: number;
}

// ── Emoji configs per step ──

const buildEmojiConfigs = (
  screenWidth: number,
  screenHeight: number,
): Record<number, EmojiConfig[]> => ({
  0: [
    { emoji: '\u{1F334}', size: 28, x: 30, y: screenHeight * 0.15, delay: 400, dx: 18, dy: -12, dur: 3200, rot: 12 },
    { emoji: '\u2708\uFE0F', size: 24, x: screenWidth - 70, y: screenHeight * 0.22, delay: 800, dx: -15, dy: 16, dur: 3600, rot: -15 },
    { emoji: '\u{1F30D}', size: 26, x: screenWidth * 0.5, y: screenHeight * 0.6, delay: 600, dx: 20, dy: -10, dur: 4000, rot: 8 },
  ],
  1: [
    { emoji: '\u2600\uFE0F', size: 28, x: 30, y: screenHeight * 0.22, delay: 400, dx: 20, dy: -15, dur: 3000, rot: 12 },
    { emoji: '\u{1F338}', size: 22, x: screenWidth - 80, y: screenHeight * 0.55, delay: 800, dx: -15, dy: 18, dur: 3500, rot: -15 },
    { emoji: '\u2708\uFE0F', size: 26, x: screenWidth * 0.5, y: screenHeight * 0.15, delay: 600, dx: 25, dy: -10, dur: 4000, rot: 20 },
  ],
  2: [
    { emoji: '\u{1F9D1}', size: 24, x: screenWidth - 60, y: screenHeight * 0.25, delay: 300, dx: -12, dy: 18, dur: 3200, rot: -10 },
    { emoji: '\u2764\uFE0F', size: 20, x: 40, y: screenHeight * 0.52, delay: 700, dx: 18, dy: -12, dur: 2800, rot: 15 },
    { emoji: '\u{1F46A}', size: 22, x: screenWidth * 0.6, y: screenHeight * 0.12, delay: 500, dx: -20, dy: 14, dur: 3600, rot: -8 },
  ],
  3: [
    { emoji: '\u{1F9ED}', size: 26, x: 20, y: screenHeight * 0.18, delay: 300, dx: 15, dy: -20, dur: 3400, rot: 25 },
    { emoji: '\u{1F33F}', size: 22, x: screenWidth - 50, y: screenHeight * 0.42, delay: 600, dx: -18, dy: 12, dur: 3000, rot: -18 },
    { emoji: '\u{1F3A8}', size: 24, x: 50, y: screenHeight * 0.58, delay: 900, dx: 22, dy: -8, dur: 3800, rot: 12 },
  ],
  4: [
    { emoji: '\u{1F4B0}', size: 22, x: screenWidth - 70, y: screenHeight * 0.2, delay: 200, dx: -10, dy: 22, dur: 2600, rot: -20 },
    { emoji: '\u{1F48E}', size: 20, x: 35, y: screenHeight * 0.35, delay: 600, dx: 16, dy: -14, dur: 3200, rot: 15 },
    { emoji: '\u{1F451}', size: 24, x: screenWidth * 0.5 - 10, y: screenHeight * 0.55, delay: 400, dx: -14, dy: 16, dur: 3600, rot: -12 },
  ],
  5: [
    { emoji: '\u{1F680}', size: 26, x: screenWidth - 60, y: screenHeight * 0.18, delay: 400, dx: -15, dy: -18, dur: 3000, rot: 20 },
    { emoji: '\u2728', size: 22, x: 30, y: screenHeight * 0.48, delay: 600, dx: 18, dy: 12, dur: 3400, rot: -15 },
    { emoji: '\u{1F30D}', size: 24, x: screenWidth * 0.4, y: screenHeight * 0.6, delay: 800, dx: -12, dy: -16, dur: 3800, rot: 10 },
  ],
});

// ── Logo positions per step ──

const LOGO_POSITIONS: Record<number, Record<string, string | number>> = {
  0: { top: '38%', right: 10 },
  1: { top: '42%', right: -8 },
  2: { bottom: '18%', left: -6 },
  3: { top: '35%', right: 20 },
  4: { top: '28%', left: -4 },
  5: { top: '38%', right: 10 },
};

// ── Component ──

export const StepDecorations: React.FC<StepDecorationsProps> = ({ step, screenWidth, screenHeight }) => {
  const logoX = useSharedValue(0);
  const logoY = useSharedValue(0);
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(0);
  const floatA = useSharedValue(0);
  const floatB = useSharedValue(0);

  useEffect(() => {
    logoScale.value = 0;
    logoRotate.value = 0;
    floatA.value = 0;
    floatB.value = 0;

    if (step === 0) {
      logoScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 110 }));
      const t = setTimeout(() => {
        floatA.value = withRepeat(withSequence(
          withTiming(-14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
        floatB.value = withRepeat(withSequence(
          withTiming(5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
      }, 700);
      return () => clearTimeout(t);
    } else if (step === 1) {
      logoScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 100 }));
      logoRotate.value = withDelay(200, withSequence(
        withSpring(20, { damping: 6, stiffness: 180 }),
        withSpring(-15, { damping: 8, stiffness: 160 }),
        withSpring(10, { damping: 10, stiffness: 140 }),
        withSpring(0, { damping: 14, stiffness: 120 }),
      ));
      const t = setTimeout(() => {
        floatA.value = withRepeat(withSequence(
          withTiming(12, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(-12, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
        floatB.value = withRepeat(withSequence(
          withTiming(8, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(-8, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
      }, 1200);
      return () => clearTimeout(t);
    } else if (step === 2) {
      logoX.value = -screenWidth;
      logoX.value = withDelay(150, withSpring(0, { damping: 10, stiffness: 90 }));
      logoScale.value = withDelay(150, withSpring(1, { damping: 10, stiffness: 100 }));
      const t = setTimeout(() => {
        floatA.value = withRepeat(withSequence(
          withTiming(-15, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(15, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
        floatB.value = withRepeat(withSequence(
          withTiming(1.08, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.94, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
      }, 900);
      return () => clearTimeout(t);
    } else if (step === 3) {
      logoScale.value = withDelay(100, withSpring(1, { damping: 8, stiffness: 80 }));
      logoRotate.value = withDelay(100, withSequence(
        withTiming(360, { duration: 800, easing: Easing.out(Easing.cubic) }),
        withSpring(360, { damping: 14 }),
      ));
      const t = setTimeout(() => {
        logoRotate.value = withRepeat(withSequence(
          withTiming(360 + 8, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(360 - 8, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
        floatA.value = withRepeat(withSequence(
          withTiming(10, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(-10, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
      }, 1000);
      return () => clearTimeout(t);
    } else if (step === 4) {
      logoY.value = -400;
      logoY.value = withDelay(100, withSpring(0, { damping: 6, stiffness: 120, mass: 1.2 }));
      logoScale.value = withDelay(100, withSpring(1, { damping: 8, stiffness: 100 }));
      const t = setTimeout(() => {
        floatA.value = withRepeat(withSequence(
          withTiming(-12, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(12, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
        floatB.value = withRepeat(withSequence(
          withTiming(6, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
          withTiming(-6, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
      }, 1000);
      return () => clearTimeout(t);
    } else {
      logoScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 110 }));
      const t = setTimeout(() => {
        floatA.value = withRepeat(withSequence(
          withTiming(-14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
        floatB.value = withRepeat(withSequence(
          withTiming(5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ), -1, true);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [step]);

  const logoStyle0 = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${logoRotate.value + floatA.value}deg` },
      { scale: logoScale.value },
      { translateY: floatB.value },
    ],
  }));

  const logoStyle1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: logoX.value },
      { translateY: floatA.value },
      { scale: logoScale.value * (floatB.value || 1) },
    ],
  }));

  const logoStyle2 = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatA.value },
      { rotate: `${logoRotate.value}deg` },
      { scale: logoScale.value },
    ],
  }));

  const logoStyle3 = useAnimatedStyle(() => ({
    transform: [
      { translateY: logoY.value + floatA.value },
      { rotate: `${floatB.value}deg` },
      { scale: logoScale.value },
    ],
  }));

  const logoStyle4 = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatA.value },
      { rotate: `${floatB.value}deg` },
      { scale: logoScale.value },
    ],
  }));

  const logoStyles: Record<number, ReturnType<typeof useAnimatedStyle>> = {
    0: logoStyle4,
    1: logoStyle0,
    2: logoStyle1,
    3: logoStyle2,
    4: logoStyle3,
    5: logoStyle4,
  };

  const emojis = buildEmojiConfigs(screenWidth, screenHeight)[step] ?? [];

  return (
    <View style={styles.overlay} pointerEvents="none">
      {emojis.map((e, i) => (
        <FloatingEmoji
          key={`${step}-${i}`}
          emoji={e.emoji}
          size={e.size}
          startX={e.x}
          startY={e.y}
          delay={e.delay}
          driftX={e.dx}
          driftY={e.dy}
          duration={e.dur}
          rotateDeg={e.rot}
        />
      ))}
      <LogoPiece
        posStyle={LOGO_POSITIONS[step] ?? LOGO_POSITIONS[0]}
        animStyle={logoStyles[step] ?? logoStyles[0]}
      />
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
