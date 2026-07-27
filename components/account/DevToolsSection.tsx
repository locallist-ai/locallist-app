import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { setDevTier, resetDevQuota } from '../../lib/api';
import { logger } from '../../lib/logger';

// Dev Tools — only rendered in development for @locallist.ai admins (guard in caller).
//
// Both actions hit DEV-ONLY backend endpoints that flip the REAL server-side
// state (no client-only override that would lie to `isPro` while the server gate
// still says "free" — that was Pablo's bug). On success we re-fetch `/account`
// so `isPro`/quota reflect the truth; on a 404 (endpoint disabled in this
// environment) we leave local state untouched and warn, never a fake tier.
export function DevToolsSection() {
  const { t } = useTranslation();
  const { isPro, user, refreshUser, refreshAiPlansQuota } = useAuth();
  const [tierLoading, setTierLoading] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);

  const realTier = user?.tier ?? 'free';

  const notifyDisabled = () => {
    Alert.alert(t('devTools.disabledTitle'), t('devTools.disabledBody'));
  };

  const handleToggleTier = async () => {
    if (tierLoading) return;
    setTierLoading(true);
    try {
      const target = isPro ? 'free' : 'pro';
      const res = await setDevTier(target);
      if (res.disabled) {
        notifyDisabled();
        return;
      }
      if (res.ok) {
        // Re-fetch /account → user.tier drives isPro and the server gates agree.
        await refreshUser();
      }
    } catch (error) {
      logger.warn('dev tier toggle failed', error);
    } finally {
      setTierLoading(false);
    }
  };

  const handleResetQuota = async () => {
    if (quotaLoading) return;
    setQuotaLoading(true);
    try {
      const res = await resetDevQuota();
      if (res.disabled) {
        notifyDisabled();
        return;
      }
      if (res.ok) {
        // Refresh the monthly counter so "X of N plans" reflects the reset.
        await refreshAiPlansQuota();
      }
    } catch (error) {
      logger.warn('dev quota reset failed', error);
    } finally {
      setQuotaLoading(false);
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(300)}>
      <View style={s.devHeader}>
        <MaterialCommunityIcons name="wrench-outline" size={14} color={colors.sunsetOrange} />
        <Text style={s.devHeaderText}>{t('devTools.header')}</Text>
      </View>
      <View style={s.section}>
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={handleToggleTier}
          disabled={tierLoading}
        >
          <MaterialCommunityIcons
            name={isPro ? 'star' : 'star-outline'}
            size={22}
            color={isPro ? colors.sunsetOrange : colors.textMain}
          />
          <Text style={s.rowText}>
            {isPro ? t('devTools.switchToFree') : t('devTools.switchToPlus')}
          </Text>
          {tierLoading ? (
            <ActivityIndicator size="small" color={colors.sunsetOrange} />
          ) : (
            <View style={[s.tierBadge, isPro && s.tierBadgePro]}>
              <Text style={[s.tierText, isPro && s.tierTextPro]}>
                {isPro ? t('devTools.badgePlus') : t('devTools.badgeFree')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={handleResetQuota}
          disabled={quotaLoading}
        >
          <MaterialCommunityIcons name="refresh" size={22} color={colors.textMain} />
          <Text style={s.rowText}>{t('devTools.resetQuota')}</Text>
          {quotaLoading ? (
            <ActivityIndicator size="small" color={colors.sunsetOrange} />
          ) : (
            <Text style={s.rowValue}>{realTier}</Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    gap: 12,
  },
  rowText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
  },
  rowValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 4,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  devHeaderText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.sunsetOrange,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
