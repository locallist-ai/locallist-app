import React from 'react';
import {
  View,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import { useResponsive } from '../lib/responsive';
import { useAuthForm } from '../lib/auth/useAuthForm';
import { AuthModeToggle } from '../components/auth/AuthModeToggle';
import { AppleSignInButton } from '../components/auth/AppleSignInButton';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { EmailSignInButton } from '../components/auth/EmailSignInButton';
import { CredentialsForm } from '../components/auth/CredentialsForm';

/**
 * Login screen. Used both as a modal route (from inside the app, dismissed
 * natively) and inline inside the first-run onboarding flow. In the inline case
 * the flow passes `onClose` so the user can back out to the value screens — the
 * fix for the W1 dead-end where "I already have an account" trapped the user with
 * no way back short of authenticating or killing the app.
 */
export default function LoginScreen({ onClose }: { onClose?: () => void } = {}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
      {onClose && (
        <TouchableOpacity
          style={[s.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          testID="login-close"
        >
          <Ionicons name="chevron-back" size={26} color={colors.deepOcean} />
        </TouchableOpacity>
      )}
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
  closeBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
