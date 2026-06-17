import React from 'react';
import { Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, borderRadius } from '../../lib/theme';
import type { AuthMode } from '../../lib/auth/useAuthForm';

type Props = {
  authMode: AuthMode;
  loading: string | null;
  onPress: () => void;
};

// Siempre visible. Si el env var no está configurado, onPress muestra un error
// claro en runtime en lugar de que el botón desaparezca sin explicación.
export function GoogleSignInButton({ authMode, loading, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [
        s.btn,
        { opacity: loading ? 0.6 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
      onPress={onPress}
      disabled={!!loading}
    >
      {loading === 'google' ? (
        <ActivityIndicator size="small" color={colors.deepOcean} />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color={colors.deepOcean} />
          <Text style={s.label}>
            {authMode === 'signin' ? t('auth.logInWithGoogle') : t('auth.signUpWithGoogle')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.deepOcean },
});
