import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { PASSWORD_CHECKS } from '../../lib/auth/useAuthForm';

type Props = {
  password: string;
};

export function PasswordStrengthIndicator({ password }: Props) {
  const { t } = useTranslation();
  return (
    <View style={s.container}>
      {PASSWORD_CHECKS.map((rule, idx) => {
        const isMet = rule.check(password);
        return (
          <View key={idx} style={s.row}>
            <Ionicons
              name={isMet ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={isMet ? colors.successEmerald : colors.textSecondary}
            />
            <Text style={[s.label, { color: isMet ? colors.textMain : colors.textSecondary }]}>
              {t(rule.key)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
