import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';

/**
 * Pill discreto de CONECTIVIDAD en tiempo real para Follow Mode. Distinto del
 * badge `follow.offlineCached` (datos cacheados en disco): esto avisa de que
 * AHORA MISMO no hay red y se están usando los datos guardados. No bloqueante:
 * cuando hay red, no renderiza nada.
 */
export function OfflineBanner({ isOffline }: { isOffline: boolean }): React.ReactElement | null {
  const { t } = useTranslation();
  if (!isOffline) return null;
  return (
    <View style={s.banner} accessibilityRole="alert">
      <MaterialCommunityIcons name="wifi-off" size={13} color={colors.sunsetOrange} />
      <Text style={s.text}>{t('follow.offlineLive')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.xs,
  },
  text: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
  },
});
