import React, { useEffect } from 'react';
import { View, Text, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedSensor,
  SensorType,
  interpolate,
  Extrapolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

type City = { name: string; emoji: string; color: string };

const CITIES: City[] = [
  { name: 'Miami', emoji: '\u{1F334}', color: '#f97316' },
];

// ── City card with pulse animation ──

function CityCard({ city, index, onSelect }: { city: City; index: number; onSelect: (name: string) => void }) {
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    const delay = 2200 + index * 200;
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
    <Animated.View
      entering={FadeInUp.duration(700).delay(1500 + index * 150).springify().damping(12)}
    >
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

export default function DestinationScreen({ onCitySelect }: { onCitySelect: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // ── Logo "drop-in" animation ──
  const logoTranslateY = useSharedValue(-300);
  const logoScale = useSharedValue(0.6);
  const logoRotate = useSharedValue(-8);
  const wavePivot = useSharedValue(0);

  // Idle loop values
  const floatY = useSharedValue(0);
  const idleRotate = useSharedValue(0);
  const breathe = useSharedValue(1);

  const startIdleLoop = () => {
    'worklet';
    floatY.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    idleRotate.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.94, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  };

  useEffect(() => {
    logoTranslateY.value = withDelay(
      300,
      withSpring(0, { damping: 12, stiffness: 120, mass: 1 }),
    );
    logoScale.value = withDelay(
      300,
      withSpring(1, { damping: 10, stiffness: 100 }),
    );
    logoRotate.value = withDelay(
      300,
      withSequence(
        withSpring(6, { damping: 8, stiffness: 200 }),
        withSpring(-4, { damping: 10, stiffness: 180 }),
        withSpring(0, { damping: 14, stiffness: 160 }),
      ),
    );
    wavePivot.value = withDelay(
      1400,
      withSequence(
        withTiming(10, { duration: 200, easing: Easing.out(Easing.quad) }),
        withTiming(-8, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(6, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 250, easing: Easing.out(Easing.quad) }),
      ),
    );
    const idleTimer = setTimeout(() => {
      startIdleLoop();
    }, 2400);
    return () => clearTimeout(idleTimer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: logoTranslateY.value + floatY.value },
      { scale: logoScale.value * breathe.value },
      { rotate: `${logoRotate.value + wavePivot.value + idleRotate.value}deg` },
    ],
  }));

  // ── Parallax background ──
  const animatedSensor = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });
  const bgStyle = useAnimatedStyle(() => {
    const pitch = animatedSensor.sensor.value.pitch;
    const roll = animatedSensor.sensor.value.roll;
    return {
      transform: [
        { translateX: interpolate(roll, [-0.5, 0.5], [-15, 15], Extrapolate.CLAMP) },
        { translateY: interpolate(pitch, [-0.5, 0.5], [-15, 15], Extrapolate.CLAMP) },
      ],
    };
  });

  const handleSelectCity = (cityName: string) => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCitySelect();
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Full-screen background */}
      <Animated.Image
        source={require('../assets/images/hero-bg.jpg')}
        style={[
          {
            position: 'absolute',
            top: -80,
            left: -80,
            right: -80,
            bottom: -80,
            width: screenWidth + 160,
            height: screenHeight + 160,
          },
          bgStyle,
        ]}
        resizeMode="cover"
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
        }}
      />

      {/* Content — single centered column */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: insets.bottom,
        }}
      >
        {/* Animated pin logo + shadow */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Animated.View style={logoStyle}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.Image
                source={require('../assets/images/icon.png')}
                style={{ width: 60, height: 60 }}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
          {/* Ground shadow */}
          <Animated.View
            style={useAnimatedStyle(() => ({
              width: 50,
              height: 10,
              borderRadius: 25,
              backgroundColor: 'rgba(0, 0, 0, 0.15)',
              marginTop: 8,
              transform: [
                { scaleX: interpolate(floatY.value, [-14, 14], [1.3, 0.7], Extrapolate.CLAMP) },
                { scaleY: interpolate(floatY.value, [-14, 14], [1, 0.5], Extrapolate.CLAMP) },
              ],
              opacity: interpolate(floatY.value, [-14, 14], [0.35, 0.08], Extrapolate.CLAMP),
            }))}
          />
        </View>

        {/* Main question */}
        <Animated.Text
          entering={FadeInDown.duration(800).delay(900).springify().damping(14)}
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
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.duration(800).delay(1100).springify().damping(14)}
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
        </Animated.Text>

        {/* City cards */}
        <View style={{ width: '100%' }}>
          {CITIES.map((city, index) => (
            <CityCard
              key={city.name}
              city={city}
              index={index}
              onSelect={handleSelectCity}
            />
          ))}
        </View>

      </View>
    </View>
  );
}
