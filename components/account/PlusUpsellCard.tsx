import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';

// ── Plus Upsell Card with animations ──

export function PlusUpsellCard() {
  const { t } = useTranslation();
  const shimmer = useSharedValue(0);
  const sparkleScale = useSharedValue(1);

  useEffect(() => {
    // Subtle pulse
    sparkleScale.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.98, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    // Shimmer sweep
    shimmer.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
  }, []);

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.15,
    transform: [{ translateX: -200 + shimmer.value * 500 }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(200).springify().damping(14)}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push('/paywall')}
        style={s.plusCard}
      >
        <LinearGradient
          colors={[colors.electricBlue, '#2563eb', '#1d4ed8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.plusGradient}
        >
          {/* Shimmer overlay */}
          <Animated.View style={[s.plusShimmer, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ width: 120, height: '100%' }}
            />
          </Animated.View>

          {/* Content */}
          <View style={s.plusRow}>
            <View style={s.plusIconBig}>
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>
            <View style={s.plusInfo}>
              <Text style={s.plusTitle}>{t('account.plusTitle')}</Text>
              <Text style={s.plusSubtitle}>{t('account.plusSubtitle')}</Text>
            </View>
          </View>

          {/* CTA */}
          <Animated.View style={[s.plusCtaBtn, sparkleStyle]}>
            <Text style={s.plusCtaText}>{t('account.plusCta')}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Animated.View>

          {/* Decorative circles */}
          <View style={s.plusDeco1} />
          <View style={s.plusDeco2} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  plusCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  plusGradient: {
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  plusShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  plusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  plusIconBig: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusInfo: { flex: 1 },
  plusTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  plusSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  plusCtaBtn: {
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plusCtaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  plusDeco1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  plusDeco2: {
    position: 'absolute',
    bottom: -10,
    right: 40,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
});
