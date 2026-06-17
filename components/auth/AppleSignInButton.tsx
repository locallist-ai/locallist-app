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

export function AppleSignInButton({ authMode, loading, onPress }: Props) {
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
      {loading === 'apple' ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
          <Text style={s.label}>
            {authMode === 'signin' ? t('auth.logInWithApple') : t('auth.signUpWithApple')}
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
    backgroundColor: '#000000',
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
