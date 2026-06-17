import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';

type Props = {
  insets: EdgeInsets;
  count: number;
  onCancel: () => void;
  onDelete: () => void;
};

// Bottom bar for bulk-delete in "my plans" selection mode.
export function SelectionBar({ insets, count, onCancel, onDelete }: Props) {
  const { t } = useTranslation();
  return (
    <View style={[s.selectionBar, { paddingBottom: insets.bottom + 12 }]}>
      <TouchableOpacity
        onPress={onCancel}
        activeOpacity={0.7}
        style={s.selectionCancel}
        accessibilityRole="button"
      >
        <Text style={s.selectionCancelText}>{t('plans.selectionCancel')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDelete}
        activeOpacity={0.85}
        style={s.selectionDelete}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        <Text style={s.selectionDeleteText}>{t('plans.selectionDelete', { count })}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    gap: spacing.md,
  },
  selectionCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  selectionCancelText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  selectionDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
  },
  selectionDeleteText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
