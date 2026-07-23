import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { completeOnboarding } from '../../lib/onboarding-store';
import { track } from '../../lib/analytics';
import { logger } from '../../lib/logger';

/**
 * Onboarding screen 1 — SKELETON (W1). Value proposition + a single CTA that
 * marks onboarding complete (guest enters the app) and a secondary link for
 * returning users to sign in.
 *
 * The full 3–5 screen flow + dismissable timeline paywall lands in W2. Rendered
 * directly by the root entry gate (no navigator mounted yet), so `onSignIn` is
 * injected by the gate to swap to the login view; `router.push('/login')` is the
 * fallback for when this screen is reached as a real route (W2, inside a stack).
 */
export default function OnboardingScreen({ onSignIn }: { onSignIn?: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    track({ event: 'onboarding_started' });
  }, []);

  const handleGetStarted = () => {
    track({ event: 'onboarding_completed' });
    // Fire-and-forget persistence; the entry gate flips to the app as soon as
    // the in-memory flag notifies subscribers.
    completeOnboarding().catch((err) =>
      logger.warn('onboarding: completeOnboarding failed', err),
    );
  };

  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn();
      return;
    }
    router.push('/login');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.content}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={s.logo}
          resizeMode="contain"
        />
        <Text style={s.title}>{t('onboarding.title')}</Text>
        <Text style={s.subtitle}>{t('onboarding.subtitle')}</Text>
      </View>

      <View style={s.footer}>
        <TouchableOpacity
          style={s.primaryBtn}
          activeOpacity={0.85}
          onPress={handleGetStarted}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.getStarted')}
        >
          <Text style={s.primaryBtnText}>{t('onboarding.getStarted')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          activeOpacity={0.7}
          onPress={handleSignIn}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.haveAccount')}
        >
          <Text style={s.secondaryBtnText}>{t('onboarding.haveAccount')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 30,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.electricBlue,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: '#FFFFFF' },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.electricBlue },
});
