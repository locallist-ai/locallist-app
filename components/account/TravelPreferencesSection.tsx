import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { useProfile } from '../../lib/use-profile';
import { track } from '../../lib/analytics';

type Props = {
  /** Disable profile loading/persisting (e.g. unauthenticated). */
  disabled?: boolean;
};

export function TravelPreferencesSection({ disabled }: Props) {
  const { t } = useTranslation();
  const { profile, saving: prefSaving, save: saveProfile, remove: removeProfile } = useProfile(disabled);
  const [prefSaved, setPrefSaved] = useState(false);

  const GROUP_TYPES = [
    { value: 'solo', label: t('wizard.companySolo') },
    { value: 'couple', label: t('wizard.companyCouple') },
    { value: 'family', label: t('wizard.companyFamily') },
    { value: 'friends', label: t('wizard.companyFriends') },
  ] as const;
  const PACES = [
    { value: 'slow', label: t('profile.paceSlow') },
    { value: 'normal', label: t('profile.paceNormal') },
    { value: 'fast', label: t('profile.paceFast') },
  ] as const;
  const BUDGETS = [
    { value: 'budget', label: t('profile.budgetBudget') },
    { value: 'moderate', label: t('profile.budgetModerate') },
    { value: 'premium', label: t('profile.budgetPremium') },
  ] as const;

  const handleSavePrefs = async (fields: {
    defaultGroupType?: string | null;
    pacePreference?: string | null;
    defaultBudgetTier?: string | null;
  }) => {
    const savedFields = Object.entries(fields)
      .filter(([, v]) => v != null)
      .map(([k]) => k);
    const ok = await saveProfile(fields);
    if (ok) {
      track({ event: 'profile_saved', fields: savedFields });
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2500);
    }
  };

  const handleResetPrefs = async () => {
    Alert.alert(t('profile.reset'), t('profile.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          track({ event: 'profile_reset' });
          removeProfile();
        },
      },
    ]);
  };

  return (
    <>
      <View style={s.prefHeader}>
        <Text style={s.prefHeaderTitle}>{t('profile.title')}</Text>
        <Text style={s.prefHeaderSub}>{t('profile.subtitle')}</Text>
      </View>
      <View style={s.section}>
        {/* Group type */}
        <View style={s.prefRow}>
          <Text style={s.prefLabel}>{t('profile.groupType')}</Text>
          <View style={s.chipRow}>
            {GROUP_TYPES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[s.prefChip, profile?.defaultGroupType === value && s.prefChipOn]}
                onPress={() => handleSavePrefs({ defaultGroupType: profile?.defaultGroupType === value ? null : value })}
              >
                <Text style={[s.prefChipText, profile?.defaultGroupType === value && s.prefChipTextOn]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {/* Pace */}
        <View style={s.prefRow}>
          <Text style={s.prefLabel}>{t('profile.pace')}</Text>
          <View style={s.chipRow}>
            {PACES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[s.prefChip, profile?.pacePreference === value && s.prefChipOn]}
                onPress={() => handleSavePrefs({ pacePreference: profile?.pacePreference === value ? null : value })}
              >
                <Text style={[s.prefChipText, profile?.pacePreference === value && s.prefChipTextOn]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {/* Budget */}
        <View style={[s.prefRow, s.prefRowLast]}>
          <Text style={s.prefLabel}>{t('profile.budget')}</Text>
          <View style={s.chipRow}>
            {BUDGETS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[s.prefChip, profile?.defaultBudgetTier === value && s.prefChipOn]}
                onPress={() => handleSavePrefs({ defaultBudgetTier: profile?.defaultBudgetTier === value ? null : value })}
              >
                <Text style={[s.prefChipText, profile?.defaultBudgetTier === value && s.prefChipTextOn]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Saved feedback + reset */}
      <View style={s.prefActions}>
        {prefSaved && <Text style={s.prefSaved}>{t('profile.saved')}</Text>}
        {prefSaving && <Text style={s.prefSaving}>Saving…</Text>}
        {profile && (
          <TouchableOpacity onPress={handleResetPrefs} style={s.prefReset}>
            <Text style={s.prefResetText}>{t('profile.reset')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  prefHeader: {
    marginBottom: 10,
  },
  prefHeaderTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  prefHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  prefRow: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  prefRowLast: {
    borderBottomWidth: 0,
  },
  prefLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prefChip: {
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.bgMain,
  },
  prefChipOn: {
    borderColor: colors.electricBlue,
    backgroundColor: colors.electricBlueLight,
  },
  prefChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  prefChipTextOn: {
    color: colors.electricBlue,
  },
  prefActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -8,
    marginBottom: spacing.lg,
    paddingHorizontal: 2,
  },
  prefSaved: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.successEmerald,
  },
  prefSaving: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  prefReset: {
    paddingVertical: 4,
  },
  prefResetText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
