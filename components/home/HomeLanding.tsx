import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';
import { FloatingEmoji } from './FloatingEmoji';

// ── Types ──

interface HomeLandingProps {
  onCreatePlan: () => void;
  screenWidth: number;
  screenHeight: number;
}

// ── Component ──

export const HomeLanding: React.FC<HomeLandingProps> = ({ onCreatePlan, screenWidth, screenHeight }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Animated.Text
        entering={FadeInDown.duration(700).delay(400).springify().damping(14)}
        style={styles.subtitle}
      >
        {t('home.subtitle')}
      </Animated.Text>

      {/* Create Plan CTA */}
      <Animated.View
        entering={FadeInUp.duration(700).delay(600).springify().damping(12)}
        style={styles.ctaWrapper}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onCreatePlan();
          }}
          style={styles.ctaButton}
          accessibilityLabel={t('home.createPlan')}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
          <Text style={styles.ctaText}>{t('home.createPlan')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Floating decorative emojis */}
      <View style={styles.emojiOverlay} pointerEvents="none">
        <FloatingEmoji emoji={'\u{1F334}'} size={28} startX={30} startY={screenHeight * 0.15} delay={800} driftX={18} driftY={-12} duration={3200} rotateDeg={12} />
        <FloatingEmoji emoji={'\u2708\uFE0F'} size={24} startX={screenWidth - 70} startY={screenHeight * 0.22} delay={1200} driftX={-15} driftY={16} duration={3600} rotateDeg={-15} />
        <FloatingEmoji emoji={'\u{1F30D}'} size={26} startX={screenWidth * 0.5} startY={screenHeight * 0.65} delay={1000} driftX={20} driftY={-10} duration={4000} rotateDeg={8} />
      </View>
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 32,
    lineHeight: 40,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 48,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ctaWrapper: {
    width: '100%',
  },
  ctaButton: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.sunsetOrange,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  ctaText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  emojiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
