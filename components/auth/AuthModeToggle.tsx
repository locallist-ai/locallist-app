import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import type { AuthMode } from '../../lib/auth/useAuthForm';

type Props = {
  authMode: AuthMode;
  onSelect: (mode: AuthMode) => void;
};

// Top toggle Log in / Sign up — deja claro que las 3 opciones de abajo sirven
// tanto para registrarse como para volver a entrar.
export function AuthModeToggle({ authMode, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <View style={s.container}>
      {(['signin', 'signup'] as const).map((mode) => {
        const active = authMode === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onSelect(mode)}
            style={({ pressed }) => [
              s.btn,
              { backgroundColor: active ? colors.sunsetOrange : 'transparent', opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[s.btnText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
              {mode === 'signin' ? t('auth.logIn') : t('auth.signUp')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    padding: 4,
    marginBottom: spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  btnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
});
