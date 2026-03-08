import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
  ZoomIn,
  useAnimatedSensor,
  SensorType,
  interpolate,
  Extrapolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';
import { api } from '../../lib/api';
import { setPreviewPlan } from '../../lib/plan-store';
import type { BuilderResponse } from '../../lib/types';

// ── City data ──

type City = { name: string; emoji: string; color: string };

const CITIES: City[] = [
  { name: 'Miami', emoji: '\u{1F334}', color: '#f97316' },
];

// ── Step data (labels are i18n keys) ──

const DURATION_OPTIONS = [
  { id: '1', icon: require('../../assets/images/icon_1day.png'), labelKey: 'wizard.duration1Day' as const, emoji: '\u2600\uFE0F' },
  { id: '2-3', icon: require('../../assets/images/icon_3days.png'), labelKey: 'wizard.duration2_3Days' as const, emoji: '\u{1F338}' },
  { id: '4+', icon: require('../../assets/images/icon_4days.png'), labelKey: 'wizard.duration4Days' as const, emoji: '\u2708\uFE0F' },
];

const COMPANY_OPTIONS = [
  { id: 'solo', icon: require('../../assets/images/icon_solo.png'), labelKey: 'wizard.companySolo' as const, emoji: '\u{1F9D1}' },
  { id: 'couple', icon: require('../../assets/images/icon_couple.png'), labelKey: 'wizard.companyCouple' as const, emoji: '\u2764\uFE0F' },
  { id: 'family', icon: require('../../assets/images/icon_family.png'), labelKey: 'wizard.companyFamily' as const, emoji: '\u{1F46A}' },
];

const STYLE_OPTIONS = [
  { id: 'adventure', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.styleAdventure' as const, emoji: '\u{1F9ED}' },
  { id: 'relax', icon: require('../../assets/images/icon_relax.png'), labelKey: 'wizard.styleRelax' as const, emoji: '\u{1F33F}' },
  { id: 'cultural', icon: require('../../assets/images/icon_cultural.png'), labelKey: 'wizard.styleCultural' as const, emoji: '\u{1F3A8}' },
];

const BUDGET_OPTIONS = [
  { id: 'budget', icon: require('../../assets/images/icon_budget.png'), labelKey: 'wizard.budgetBudget' as const, emoji: '\u{1F4B0}' },
  { id: 'moderate', icon: require('../../assets/images/icon_moderate.png'), labelKey: 'wizard.budgetModerate' as const, emoji: '\u{1F4B3}' },
  { id: 'premium', icon: require('../../assets/images/icon_premium.png'), labelKey: 'wizard.budgetPremium' as const, emoji: '\u{1F451}' },
];

const STEPS = [
  { titleKey: 'wizard.step1Title' as const, subtitleKey: 'wizard.step1Subtitle' as const, options: DURATION_OPTIONS },
  { titleKey: 'wizard.step2Title' as const, subtitleKey: 'wizard.step2Subtitle' as const, options: COMPANY_OPTIONS },
  { titleKey: 'wizard.step3Title' as const, subtitleKey: 'wizard.step3Subtitle' as const, options: STYLE_OPTIONS },
  { titleKey: 'wizard.step4Title' as const, subtitleKey: 'wizard.step4Subtitle' as const, options: BUDGET_OPTIONS },
];

const hapticSelect = () => {
  if (Platform.OS === 'ios') Haptics.selectionAsync();
};

// ── City card with pulse animation ──

function CityCard({ city, index, onSelect }: { city: City; index: number; onSelect: (name: string) => void }) {
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    const delay = 600 + index * 200;
    const timer = setTimeout(() => {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.97, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(249, 115, 22, ${glowOpacity.value})`,
  }));

  return (
    <Animated.View entering={FadeInUp.duration(700).delay(200 + index * 150).springify().damping(12)}>
      <Animated.View style={cardStyle}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onSelect(city.name)}
          style={{ marginBottom: 12 }}
        >
          <Animated.View
            style={[
              {
                borderRadius: 24,
                borderCurve: 'continuous',
                overflow: 'hidden',
                borderWidth: 1.5,
                boxShadow: '0 8px 36px rgba(249, 115, 22, 0.3)',
              },
              borderStyle,
            ]}
          >
            <BlurView intensity={60} tint="light" style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={{ fontSize: 36 }}>{city.emoji}</Text>
                  <Text
                    style={{
                      fontFamily: fonts.headingBold,
                      fontSize: 28,
                      color: colors.deepOcean,
                    }}
                  >
                    {city.name}
                  </Text>
                </View>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.sunsetOrange,
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)',
                  }}
                >
                  <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
                </View>
              </View>
            </BlurView>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Floating decorative emoji ──

function FloatingEmoji({
  emoji, size, startX, startY, delay: d, driftX, driftY, duration, rotateDeg,
}: {
  emoji: string; size: number;
  startX: number; startY: number;
  delay: number; driftX: number; driftY: number;
  duration: number; rotateDeg: number;
}) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    // Fade in
    opacity.value = withDelay(d, withTiming(0.5, { duration: 600 }));
    scale.value = withDelay(d, withSpring(1, { damping: 12 }));

    // Drift
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

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: startX, top: startY }, style]}>
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

// ── Logo piece (reused across steps in different positions) ──

function LogoPiece({ posStyle, animStyle }: { posStyle: any; animStyle: any }) {
  return (
    <Animated.View style={[{ position: 'absolute' }, posStyle, animStyle]}>
      <View
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ width: 44, height: 44 }}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

// ── Step decorations — unique per step ──

function StepDecorations({ step, screenWidth, screenHeight }: { step: number; screenWidth: number; screenHeight: number }) {
  // Logo animation values
  const logoX = useSharedValue(0);
  const logoY = useSharedValue(0);
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(0);
  const floatA = useSharedValue(0);
  const floatB = useSharedValue(0);

  useEffect(() => {
    // Reset
    logoScale.value = 0;
    logoRotate.value = 0;
    floatA.value = 0;
    floatB.value = 0;

    if (step === 0) {
      // City: classic float like destination screen
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
      // Duration: logo swings like a pendulum from top-right
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
      // Company: logo bounces in from left side
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
      // Style: logo spins in from center with a full rotation
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
      // Budget: logo drops in from top with a bounce
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
      // Chat: classic float from destination screen
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

  // Logo animated styles per step
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

  // Positions per step: [top, left/right]
  const positions: Record<number, any> = {
    0: { top: '38%', right: 10 },   // City
    1: { top: '42%', right: -8 },   // Duration
    2: { bottom: '18%', left: -6 }, // Company
    3: { top: '35%', right: 20 },   // Style
    4: { top: '28%', left: -4 },    // Budget
    5: { top: '38%', right: 10 },   // Chat
  };

  const logoStyles: Record<number, any> = {
    0: logoStyle4,  // City: classic float
    1: logoStyle0,  // Duration
    2: logoStyle1,  // Company
    3: logoStyle2,  // Style
    4: logoStyle3,  // Budget
    5: logoStyle4,  // Chat
  };

  // Floating emojis config per step
  const emojiConfigs: Record<number, { emoji: string; size: number; x: number; y: number; delay: number; dx: number; dy: number; dur: number; rot: number }[]> = {
    0: [ // City
      { emoji: '\u{1F334}', size: 28, x: 30, y: screenHeight * 0.15, delay: 400, dx: 18, dy: -12, dur: 3200, rot: 12 },
      { emoji: '\u2708\uFE0F', size: 24, x: screenWidth - 70, y: screenHeight * 0.22, delay: 800, dx: -15, dy: 16, dur: 3600, rot: -15 },
      { emoji: '\u{1F30D}', size: 26, x: screenWidth * 0.5, y: screenHeight * 0.6, delay: 600, dx: 20, dy: -10, dur: 4000, rot: 8 },
    ],
    1: [ // Duration
      { emoji: '\u2600\uFE0F', size: 28, x: 30, y: screenHeight * 0.22, delay: 400, dx: 20, dy: -15, dur: 3000, rot: 12 },
      { emoji: '\u{1F338}', size: 22, x: screenWidth - 80, y: screenHeight * 0.55, delay: 800, dx: -15, dy: 18, dur: 3500, rot: -15 },
      { emoji: '\u2708\uFE0F', size: 26, x: screenWidth * 0.5, y: screenHeight * 0.15, delay: 600, dx: 25, dy: -10, dur: 4000, rot: 20 },
    ],
    2: [ // Company
      { emoji: '\u{1F9D1}', size: 24, x: screenWidth - 60, y: screenHeight * 0.25, delay: 300, dx: -12, dy: 18, dur: 3200, rot: -10 },
      { emoji: '\u2764\uFE0F', size: 20, x: 40, y: screenHeight * 0.52, delay: 700, dx: 18, dy: -12, dur: 2800, rot: 15 },
      { emoji: '\u{1F46A}', size: 22, x: screenWidth * 0.6, y: screenHeight * 0.12, delay: 500, dx: -20, dy: 14, dur: 3600, rot: -8 },
    ],
    3: [ // Style
      { emoji: '\u{1F9ED}', size: 26, x: 20, y: screenHeight * 0.18, delay: 300, dx: 15, dy: -20, dur: 3400, rot: 25 },
      { emoji: '\u{1F33F}', size: 22, x: screenWidth - 50, y: screenHeight * 0.42, delay: 600, dx: -18, dy: 12, dur: 3000, rot: -18 },
      { emoji: '\u{1F3A8}', size: 24, x: 50, y: screenHeight * 0.58, delay: 900, dx: 22, dy: -8, dur: 3800, rot: 12 },
    ],
    4: [ // Budget
      { emoji: '\u{1F4B0}', size: 22, x: screenWidth - 70, y: screenHeight * 0.2, delay: 200, dx: -10, dy: 22, dur: 2600, rot: -20 },
      { emoji: '\u{1F48E}', size: 20, x: 35, y: screenHeight * 0.35, delay: 600, dx: 16, dy: -14, dur: 3200, rot: 15 },
      { emoji: '\u{1F451}', size: 24, x: screenWidth * 0.5 - 10, y: screenHeight * 0.55, delay: 400, dx: -14, dy: 16, dur: 3600, rot: -12 },
    ],
    5: [ // Chat
      { emoji: '\u{1F680}', size: 26, x: screenWidth - 60, y: screenHeight * 0.18, delay: 400, dx: -15, dy: -18, dur: 3000, rot: 20 },
      { emoji: '\u2728', size: 22, x: 30, y: screenHeight * 0.48, delay: 600, dx: 18, dy: 12, dur: 3400, rot: -15 },
      { emoji: '\u{1F30D}', size: 24, x: screenWidth * 0.4, y: screenHeight * 0.6, delay: 800, dx: -12, dy: -16, dur: 3800, rot: 10 },
    ],
  };

  const emojis = emojiConfigs[step] ?? [];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {/* Floating emojis */}
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
      {/* Logo in unique position */}
      <LogoPiece posStyle={positions[step] ?? positions[0]} animStyle={logoStyles[step] ?? logoStyles[0]} />
    </View>
  );
}

// ── Animated option card ──

type StepOption = { id: string; icon: any; labelKey: string; emoji: string };

function OptionCard({
  option,
  index,
  selected,
  onSelect,
}: {
  option: StepOption;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (selected) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.98, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
      glowOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [selected]);

  const cardScale = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const borderGlow = useAnimatedStyle(() => ({
    borderColor: selected
      ? `rgba(249, 115, 22, ${glowOpacity.value})`
      : 'rgba(255, 255, 255, 0.3)',
  }));

  return (
    <Animated.View
      entering={FadeInUp.duration(600).delay(200 + index * 120).springify().damping(14)}
    >
      <Animated.View style={cardScale}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticSelect();
            onSelect();
          }}
        >
          <Animated.View
            style={[
              {
                borderRadius: 20,
                borderCurve: 'continuous',
                overflow: 'hidden',
                borderWidth: 1.5,
                marginBottom: 12,
              },
              selected && { boxShadow: '0 6px 28px rgba(249, 115, 22, 0.25)' },
              borderGlow,
            ]}
          >
            <BlurView
              intensity={selected ? 70 : 50}
              tint="light"
              style={{
                paddingHorizontal: 20,
                paddingVertical: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Text style={{ fontSize: 32 }}>{option.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: selected ? fonts.headingBold : fonts.headingSemiBold,
                    fontSize: 22,
                    color: selected ? colors.deepOcean : 'rgba(15, 23, 42, 0.8)',
                  }}
                >
                  {t(option.labelKey as any)}
                </Text>
              </View>
              {selected && (
                <Animated.View entering={ZoomIn.duration(300).springify()}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.sunsetOrange,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                </Animated.View>
              )}
            </BlurView>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── Progress dots ──

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current
              ? colors.sunsetOrange
              : i < current
                ? 'rgba(249, 115, 22, 0.4)'
                : 'rgba(255, 255, 255, 0.3)',
          }}
        />
      ))}
    </View>
  );
}

// ── Typing dots ──

function TypingDots() {
  const dots = useRef([
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
    new RNAnimated.Value(0),
  ]).current;

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(dot, { toValue: -6, duration: 500, delay: i * 250, useNativeDriver: true }),
          RNAnimated.timing(dot, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ),
    );
    RNAnimated.parallel(animations).start();
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((dot, i) => (
        <RNAnimated.View
          key={i}
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: colors.sunsetOrange + '60',
            transform: [{ translateY: dot }],
          }}
        />
      ))}
    </View>
  );
}

// ── Home Landing ──

function HomeLanding({
  onCreatePlan,
  screenWidth,
  screenHeight,
}: {
  onCreatePlan: () => void;
  screenWidth: number;
  screenHeight: number;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Logo float animation
  const floatY = useSharedValue(0);
  const breathe = useSharedValue(1);
  const idleRotate = useSharedValue(0);

  useEffect(() => {
    floatY.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(-14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    breathe.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.95, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    idleRotate.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(-5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { scale: breathe.value },
      { rotate: `${idleRotate.value}deg` },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(floatY.value, [-14, 14], [1.3, 0.7], Extrapolate.CLAMP) },
      { scaleY: interpolate(floatY.value, [-14, 14], [1, 0.5], Extrapolate.CLAMP) },
    ],
    opacity: interpolate(floatY.value, [-14, 14], [0.35, 0.08], Extrapolate.CLAMP),
  }));

  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: insets.bottom,
      }}
    >
      <Animated.Text
        entering={FadeInDown.duration(700).delay(400).springify().damping(14)}
        style={{
          fontFamily: fonts.headingSemiBold,
          fontSize: 32,
          lineHeight: 40,
          color: 'rgba(255, 255, 255, 0.9)',
          textAlign: 'center',
          marginBottom: 48,
          textShadowColor: 'rgba(0, 0, 0, 0.2)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {t('home.subtitle')}
      </Animated.Text>

      {/* Create Plan CTA */}
      <Animated.View
        entering={FadeInUp.duration(700).delay(600).springify().damping(12)}
        style={{ width: '100%' }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onCreatePlan();
          }}
          style={{
            borderRadius: 24,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: colors.sunsetOrange,
            paddingVertical: 20,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
            boxShadow: '0 8px 36px rgba(249, 115, 22, 0.5)',
          }}
        >
            <Ionicons name="sparkles" size={22} color="#FFFFFF" />
            <Text
              style={{
                fontFamily: fonts.headingSemiBold,
                fontSize: 20,
                color: '#FFFFFF',
              }}
            >
              {t('home.createPlan')}
            </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Floating decorative emojis */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <FloatingEmoji emoji={'\u{1F334}'} size={28} startX={30} startY={screenHeight * 0.15} delay={800} driftX={18} driftY={-12} duration={3200} rotateDeg={12} />
        <FloatingEmoji emoji={'\u2708\uFE0F'} size={24} startX={screenWidth - 70} startY={screenHeight * 0.22} delay={1200} driftX={-15} driftY={16} duration={3600} rotateDeg={-15} />
        <FloatingEmoji emoji={'\u{1F30D}'} size={26} startX={screenWidth * 0.5} startY={screenHeight * 0.65} delay={1000} driftX={20} driftY={-10} duration={4000} rotateDeg={8} />
      </View>
    </View>
  );
}

// ── Main component ──

export function HomeV2() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [showWizard, setShowWizard] = useState(false);

  // Crossfade: both views stay mounted, animate opacity on UI thread
  const wizardProgress = useSharedValue(0);
  useEffect(() => {
    wizardProgress.value = withTiming(showWizard ? 1 : 0, { duration: 350 });
  }, [showWizard]);
  const landingStyle = useAnimatedStyle(() => ({
    opacity: 1 - wizardProgress.value,
  }));
  const wizardStyle = useAnimatedStyle(() => ({
    opacity: wizardProgress.value,
  }));
  const landingPointerEvents = showWizard ? 'none' as const : 'auto' as const;
  const wizardPointerEvents = showWizard ? 'auto' as const : 'none' as const;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [selections, setSelections] = useState<(string | null)[]>([null, null, null, null]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBubbleText, setShowBubbleText] = useState(false);

  useEffect(() => {
    if (step === 5) {
      const timer = setTimeout(() => setShowBubbleText(true), 800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Parallax background
  const animatedSensor = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });
  const bgStyle = useAnimatedStyle(() => {
    const pitch = animatedSensor.sensor.value.pitch;
    const roll = animatedSensor.sensor.value.roll;
    return {
      transform: [
        { translateX: interpolate(roll, [-0.5, 0.5], [-20, 20], Extrapolate.CLAMP) },
        { translateY: interpolate(pitch, [-0.5, 0.5], [-20, 20], Extrapolate.CLAMP) },
      ],
    };
  });

  // Selecting any card (city or preference) auto-advances to next step
  const advanceToNext = useCallback(() => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection('forward');
    setStep((s) => Math.min(s + 1, 5));
  }, []);

  const handleSelect = (optionId: string) => {
    const prefIdx = step - 1;
    const newSelections = [...selections];
    newSelections[prefIdx] = optionId;
    setSelections(newSelections);
    // Auto-advance after brief visual feedback
    setTimeout(advanceToNext, 350);
  };

  const handleCitySelect = (_cityName: string) => {
    advanceToNext();
  };

  const handleBack = () => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) {
      setShowWizard(false);
      return;
    }
    setDirection('back');
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleGenerate = useCallback(async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const body = {
      message: message.trim() || 'Plan a great trip for me',
      tripContext: {
        groupType: selections[1] ?? 'solo',
        preferences: selections[2] ? [selections[2]] : [],
        vibes: selections[2] ? [selections[2]] : [],
        duration: selections[0] ?? undefined,
        budget: selections[3] ?? undefined,
      },
    };

    const res = await api<BuilderResponse>('/builder/chat', { method: 'POST', body });
    setLoading(false);

    if (res.data) {
      setPreviewPlan(res.data);
      router.push('/plan/preview');
    } else {
      setError(res.error ?? t('wizard.errorDefault'));
    }
  }, [loading, message, selections]);

  const entering = direction === 'forward' ? SlideInRight.duration(400).springify().damping(18) : SlideInLeft.duration(400).springify().damping(18);
  const exiting = direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300);

  const isCityStep = step === 0;
  const currentStep = (step >= 1 && step <= 4) ? STEPS[step - 1] : null;
  const isChatStep = step === 5;

  return (
    <View style={{ flex: 1 }}>
      {/* Parallax background */}
      <Animated.Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={[
          {
            position: 'absolute',
            top: -100, left: -100, right: -100, bottom: -200,
            width: screenWidth + 200,
            height: screenHeight + 300,
          },
          bgStyle,
        ]}
        resizeMode="cover"
      />
      <View
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: -100,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
        }}
      />

      {/* Home Landing + Wizard — both mounted, crossfade via opacity */}
      <Animated.View pointerEvents={landingPointerEvents} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, landingStyle]}>
        <HomeLanding
          onCreatePlan={() => {
            setDirection('forward');
            setStep(0);
            setSelections([null, null, null, null]);
            setMessage('');
            setShowBubbleText(false);
            setShowWizard(true);
          }}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      </Animated.View>

      <Animated.View pointerEvents={wizardPointerEvents} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: insets.top + 12 }, wizardStyle]}>
          {/* Header: back button + progress dots */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.7}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <ProgressDots current={step} total={6} />
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Decorations layer — absolute, doesn't block touches */}
          <StepDecorations step={step} screenWidth={screenWidth} screenHeight={screenHeight} />

          {/* Step content */}
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            {/* Step 0: City selection */}
            {isCityStep && (
              <Animated.View key="step-city" entering={entering} exiting={exiting} style={{ flex: 1, justifyContent: 'center' }}>
                <Text
                  style={{
                    fontFamily: fonts.headingBold,
                    fontSize: 38,
                    lineHeight: 46,
                    color: '#FFFFFF',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0, 0, 0, 0.3)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 8,
                  }}
                >
                  {t('destination.title')}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 15,
                    lineHeight: 22,
                    color: 'rgba(255, 255, 255, 0.75)',
                    textAlign: 'center',
                    marginTop: 12,
                    marginBottom: 36,
                    textShadowColor: 'rgba(0, 0, 0, 0.2)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }}
                >
                  {t('destination.subtitle')}
                </Text>
                <View style={{ width: '100%' }}>
                  {CITIES.map((city, index) => (
                    <CityCard
                      key={city.name}
                      city={city}
                      index={index}
                      onSelect={handleCitySelect}
                    />
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Steps 1-4: Preference steps */}
            {currentStep && (
              <Animated.View key={`step-${step}`} entering={entering} exiting={exiting} style={{ flex: 1, justifyContent: 'center' }}>
                {/* Title */}
                <Text
                  style={{
                    fontFamily: fonts.headingBold,
                    fontSize: 36,
                    lineHeight: 44,
                    color: '#FFFFFF',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0, 0, 0, 0.3)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  {t(currentStep.titleKey as any)}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 15,
                    lineHeight: 22,
                    color: 'rgba(255, 255, 255, 0.7)',
                    textAlign: 'center',
                    marginBottom: 24,
                    textShadowColor: 'rgba(0, 0, 0, 0.2)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }}
                >
                  {t(currentStep.subtitleKey as any)}
                </Text>

                {/* Option cards */}
                <View>
                  {currentStep.options.map((option, index) => (
                    <OptionCard
                      key={option.id}
                      option={option}
                      index={index}
                      selected={selections[step - 1] === option.id}
                      onSelect={() => handleSelect(option.id)}
                    />
                  ))}
                </View>

                {/* Skip button */}
                <View style={{ marginTop: 20, paddingBottom: insets.bottom + 20 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={advanceToNext}
                    style={{
                      borderRadius: 20,
                      borderCurve: 'continuous',
                      overflow: 'hidden',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <BlurView
                      intensity={60}
                      tint="light"
                      style={{
                        paddingVertical: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.bodySemiBold,
                          fontSize: 17,
                          color: '#FFFFFF',
                        }}
                      >
                        {t('wizard.skip')}
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </BlurView>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Step 5: Chat / Generate */}
            {isChatStep && (
              <Animated.View key="step-chat" entering={entering} exiting={exiting} style={{ flex: 1 }}>
                {/* Hero animation */}
                <Text
                  style={{
                    fontFamily: fonts.headingBold,
                    fontSize: 36,
                    lineHeight: 44,
                    color: '#FFFFFF',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0, 0, 0, 0.3)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  {t('wizard.chatTitle')}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 15,
                    lineHeight: 22,
                    color: 'rgba(255, 255, 255, 0.7)',
                    textAlign: 'center',
                    marginBottom: 28,
                    textShadowColor: 'rgba(0, 0, 0, 0.2)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }}
                >
                  {t('wizard.chatSubtitle')}
                </Text>

                {/* Chat bubble */}
                <Animated.View
                  entering={FadeInUp.duration(600).delay(200).springify().damping(14)}
                  style={{
                    borderRadius: 24,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                    marginBottom: 20,
                  }}
                >
                  <BlurView intensity={70} tint="light" style={{ padding: 18 }}>
                    {/* AI message */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                      <View
                        style={{
                          width: 32, height: 32, borderRadius: 16,
                          backgroundColor: colors.sunsetOrange + '18',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Image
                          source={require('../../assets/images/icon.png')}
                          style={{ width: 18, height: 22 }}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        {showBubbleText ? (
                          <Text
                            style={{
                              fontFamily: fonts.body,
                              fontSize: 15,
                              lineHeight: 22,
                              color: colors.deepOcean,
                            }}
                          >
                            {t('wizard.chatAiMessage')}
                          </Text>
                        ) : (
                          <TypingDots />
                        )}
                      </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: colors.deepOcean + '10', marginBottom: 12 }} />

                    {/* User input */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                      <TextInput
                        style={{
                          flex: 1,
                          fontFamily: fonts.body,
                          fontSize: 15,
                          color: colors.textMain,
                          maxHeight: 80,
                          minHeight: 20,
                          paddingVertical: 0,
                        }}
                        value={message}
                        onChangeText={setMessage}
                        placeholder={t('wizard.chatPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={500}
                      />
                    </View>
                  </BlurView>
                </Animated.View>

                {/* Error */}
                {error && (
                  <Animated.View
                    entering={FadeIn.duration(300)}
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <Text style={{ fontFamily: fonts.body, fontSize: 14, color: '#ef4444', textAlign: 'center' }}>
                      {error}
                    </Text>
                  </Animated.View>
                )}

                {/* Generate button */}
                <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: insets.bottom + 20 }}>
                  <Animated.View entering={FadeInUp.duration(600).delay(400).springify().damping(12)}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleGenerate}
                      disabled={loading}
                      style={{
                        borderRadius: 20,
                        borderCurve: 'continuous',
                        backgroundColor: colors.sunsetOrange,
                        paddingVertical: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 10,
                        opacity: loading ? 0.7 : 1,
                        boxShadow: '0 6px 24px rgba(249, 115, 22, 0.4)',
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                          <Text
                            style={{
                              fontFamily: fonts.bodySemiBold,
                              fontSize: 17,
                              color: '#FFFFFF',
                            }}
                          >
                            {t('wizard.buildMyPlan')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
    </View>
  );
}
