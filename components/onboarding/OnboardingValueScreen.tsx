import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { EditorialTitle } from '../ui/design-system';

// Onboarding screen 1 — value proposition. Logo + editorial claim + three
// benefit bullets, a primary "Get started" CTA that advances the flow, and a
// secondary "I already have an account" link that swaps to the inline login.

interface OnboardingValueScreenProps {
  onStart: () => void;
  onSignIn: () => void;
}

const BULLET_KEYS = [
  'onboarding.valueBullet1',
  'onboarding.valueBullet2',
  'onboarding.valueBullet3',
] as const;

export function OnboardingValueScreen({ onStart, onSignIn }: OnboardingValueScreenProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <EditorialTitle text={t('onboarding.valueClaim')} size="lg" color={colors.paperWhite} withShadow />

        <View style={styles.bullets}>
          {BULLET_KEYS.map((key) => (
            <View key={key} style={styles.bulletRow}>
              <View style={styles.bulletIcon}>
                <Ionicons name="checkmark" size={18} color={colors.paperWhite} />
              </View>
              <Text style={styles.bulletText}>{t(key)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.getStarted')}
        >
          <Text style={styles.primaryBtnText}>{t('onboarding.getStarted')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.7}
          onPress={onSignIn}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.haveAccount')}
        >
          <Text style={styles.secondaryBtnText}>{t('onboarding.haveAccount')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: spacing.lg,
  },
  bullets: {
    marginTop: spacing.xl,
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bulletIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: colors.paperWhite,
  },
  footer: {
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
  secondaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.paperWhite },
});
