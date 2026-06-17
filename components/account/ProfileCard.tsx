import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';

type Props = {
  name?: string | null;
  email?: string | null;
  isPro: boolean;
};

export function ProfileCard({ name, email, isPro }: Props) {
  const { t } = useTranslation();
  const initial = (name ?? email)?.[0]?.toUpperCase() ?? '?';

  return (
    <View style={s.profileCard}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initial}</Text>
      </View>
      <View style={s.profileInfo}>
        {name && <Text style={s.profileName}>{name}</Text>}
        <Text style={s.profileEmail}>{email}</Text>
      </View>
      <View style={[s.tierBadge, isPro && s.tierBadgePro]}>
        <Text style={[s.tierText, isPro && s.tierTextPro]}>
          {isPro ? t('account.pro') : t('account.free')}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.electricBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.electricBlue,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
  },
  profileEmail: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tierBadge: {
    backgroundColor: colors.textSecondary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  tierBadgePro: { backgroundColor: colors.sunsetOrange + '15' },
  tierText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  tierTextPro: { color: colors.sunsetOrange },
});
