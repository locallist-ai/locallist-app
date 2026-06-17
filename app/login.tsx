import React from 'react';
import {
  View,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import { useResponsive } from '../lib/responsive';
import { useAuthForm } from '../lib/auth/useAuthForm';
import { AuthModeToggle } from '../components/auth/AuthModeToggle';
import { AppleSignInButton } from '../components/auth/AppleSignInButton';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { EmailSignInButton } from '../components/auth/EmailSignInButton';
import { CredentialsForm } from '../components/auth/CredentialsForm';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { compact } = useResponsive();
  const {
    step,
    authMode,
    credentialsMode,
    email,
    password,
    name,
    loading,
    error,
    appleAvailable,
    passwordStrength,
    emailInputRef,
    setEmail,
    setPassword,
    setName,
    handleAppleSignIn,
    handleGoogleSignIn,
    selectAuthMode,
    goToCredentials,
    toggleCredentialsMode,
    backToChoose,
    submitCredentials,
  } = useAuthForm();

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../assets/images/icon.png')}
          style={[
            s.logo,
            {
              width: compact ? 120 : 180,
              height: compact ? 120 : 180,
              marginTop: compact ? spacing.md : spacing.xxl,
            },
          ]}
          resizeMode="contain"
        />
        <Text style={s.title}>
          {step === 'choose'
            ? authMode === 'signin' ? t('auth.welcomeBack') : t('auth.joinLocalList')
            : credentialsMode === 'login' ? t('auth.logIn') : t('auth.createAccount')}
        </Text>
        <Text style={s.tagline}>{t('auth.taglineLine1')}</Text>
        <Text style={[s.tagline, s.taglineLast]}>{t('auth.taglineLine2')}</Text>

        {error && (
          <View style={s.errorBox}>
            <Text selectable style={s.errorText}>
              {error}
            </Text>
          </View>
        )}

        {step === 'choose' ? (
          <View style={s.choiceStack}>
            <AuthModeToggle authMode={authMode} onSelect={selectAuthMode} />
            {appleAvailable && (
              <AppleSignInButton authMode={authMode} loading={loading} onPress={handleAppleSignIn} />
            )}
            <GoogleSignInButton authMode={authMode} loading={loading} onPress={handleGoogleSignIn} />
            <EmailSignInButton authMode={authMode} loading={loading} onPress={goToCredentials} />
          </View>
        ) : (
          <CredentialsForm
            credentialsMode={credentialsMode}
            email={email}
            password={password}
            name={name}
            loading={loading}
            passwordStrength={passwordStrength}
            emailInputRef={emailInputRef}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onChangeName={setName}
            onSubmit={submitCredentials}
            onToggleMode={toggleCredentialsMode}
            onBack={backToChoose}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: colors.deepOcean,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  taglineLast: {
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.error + '12',
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: spacing.md,
    width: '100%',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  choiceStack: { width: '100%', gap: 12 },
});
