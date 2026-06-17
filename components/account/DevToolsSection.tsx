import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';

type Props = {
  isPro: boolean;
  realTier: string;
  onToggleTier: () => void;
  onResetTier: () => void;
};

// Dev Tools — only rendered in development for @locallist.ai admins (guard in caller).
export function DevToolsSection({ isPro, realTier, onToggleTier, onResetTier }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(300)}>
      <View style={s.devHeader}>
        <Ionicons name="construct-outline" size={14} color={colors.sunsetOrange} />
        <Text style={s.devHeaderText}>Dev Tools</Text>
      </View>
      <View style={s.section}>
        <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onToggleTier}>
          <Ionicons
            name={isPro ? 'sparkles' : 'sparkles-outline'}
            size={22}
            color={isPro ? colors.sunsetOrange : colors.textMain}
          />
          <Text style={s.rowText}>{isPro ? 'Switch to Free' : 'Switch to Pro'}</Text>
          <View style={[s.tierBadge, isPro && s.tierBadgePro]}>
            <Text style={[s.tierText, isPro && s.tierTextPro]}>{isPro ? 'PRO' : 'FREE'}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onResetTier}>
          <Ionicons name="refresh-outline" size={22} color={colors.textMain} />
          <Text style={s.rowText}>Reset to real tier</Text>
          <Text style={s.rowValue}>{realTier}</Text>
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
