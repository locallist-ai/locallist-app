import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';

export default function CustomBuilderScreen() {
  const { t } = useTranslation();
  const { isPro } = useAuth();
  const insets = useSafeAreaInsets();

  // Premium gate
  if (!isPro) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textMain} />
        </TouchableOpacity>

        <View style={s.gateContainer}>
          <View style={s.gateIconWrap}>
            <Ionicons name="lock-closed" size={48} color={colors.sunsetOrange} />
          </View>
          <Text style={s.gateTitle}>LocalList Plus</Text>
          <Text style={s.gateBody}>
            {t('account.plusSubtitle')}
          </Text>
          <TouchableOpacity style={s.upgradeBtn} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={s.upgradeBtnText}>{t('account.plusCta')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Pro users — custom builder (placeholder for now)
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={colors.textMain} />
      </TouchableOpacity>

      <View style={s.gateContainer}>
        <View style={[s.gateIconWrap, { backgroundColor: colors.electricBlueLight }]}>
          <Ionicons name="create-outline" size={48} color={colors.electricBlue} />
        </View>
        <Text style={s.gateTitle}>{t('plans.buildYourOwn')}</Text>
        <Text style={s.gateBody}>Build custom plans, save your favorite spots, and create personalized experiences.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.lg,
    marginTop: spacing.md,
  },
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: -60,
  },
  gateIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.sunsetOrangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  gateTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    color: colors.deepOcean,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  gateBody: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: 8,
  },
  upgradeBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
