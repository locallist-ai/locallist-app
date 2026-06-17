import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import type { CredentialsMode } from '../../lib/auth/useAuthForm';

type Props = {
  credentialsMode: CredentialsMode;
  email: string;
  password: string;
  name: string;
  loading: string | null;
  passwordStrength: number;
  emailInputRef: React.RefObject<TextInput | null>;
  onChangeEmail: (v: string) => void;
  onChangePassword: (v: string) => void;
  onChangeName: (v: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onBack: () => void;
};

export function CredentialsForm({
  credentialsMode,
  email,
  password,
  name,
  loading,
  passwordStrength,
  emailInputRef,
  onChangeEmail,
  onChangePassword,
  onChangeName,
  onSubmit,
  onToggleMode,
  onBack,
}: Props) {
  const { t } = useTranslation();

  const invalid =
    (credentialsMode === 'login' && (!email.trim() || !password)) ||
    (credentialsMode === 'register' && (!email.trim() || !password || passwordStrength < 5));

  return (
    <View style={s.container}>
      {/* Email Input */}
      <TextInput
        style={s.input}
        placeholder={t('auth.emailPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={onChangeEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        ref={emailInputRef}
      />

      {/* Password Input */}
      <TextInput
        style={s.input}
        placeholder={t('auth.passwordPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={onChangePassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
      />

      {/* Name Input (register only) */}
      {credentialsMode === 'register' && (
        <TextInput
          style={s.input}
          placeholder={t('auth.namePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={onChangeName}
          autoCapitalize="words"
          autoComplete="name"
        />
      )}

      {/* Password Requirements (register only) */}
      {credentialsMode === 'register' && !!password && <PasswordStrengthIndicator password={password} />}

      {/* Main Button */}
      <Pressable
        style={({ pressed }) => [
          s.mainBtn,
          { opacity: invalid ? 0.5 : loading ? 0.6 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
        onPress={onSubmit}
        disabled={loading !== null || invalid}
      >
        {loading === 'email' ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={s.mainBtnText}>
            {credentialsMode === 'login' ? t('auth.logInButton') : t('auth.createAccountButton')}
          </Text>
        )}
      </Pressable>

      {/* Toggle Register/Login */}
      <Pressable style={({ pressed }) => [s.linkBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={onToggleMode}>
        <Text style={s.linkText}>
          {credentialsMode === 'login' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
          <Text style={s.linkAccent}>
            {credentialsMode === 'login' ? t('auth.createOne') : t('auth.logIn')}
          </Text>
        </Text>
      </Pressable>

      {/* Back Button */}
      <Pressable style={({ pressed }) => [s.linkBtn, { opacity: pressed ? 0.7 : 1 }]} onPress={onBack}>
        <Text style={s.backText}>{t('auth.back')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', gap: 12 },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.sunsetOrange,
  },
  mainBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
  linkBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  linkAccent: {
    color: colors.sunsetOrange,
    fontFamily: fonts.bodySemiBold,
  },
  backText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.sunsetOrange,
  },
});
