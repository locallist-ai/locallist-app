import { useState, useEffect, useRef } from 'react';
import type { TextInput } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api, getAccessToken } from '../api';
import { useAuth } from '../auth';
import { track } from '../analytics';
import type { AuthResponse } from '../types';

// Required for Google Auth redirect to close the browser on web
WebBrowser.maybeCompleteAuthSession();

export type AuthStep = 'choose' | 'credentials';
export type CredentialsMode = 'login' | 'register';
export type AuthMode = 'signin' | 'signup';

export const PASSWORD_CHECKS: Array<{
  key: 'auth.passwordRuleLength' | 'auth.passwordRuleUpper' | 'auth.passwordRuleLower' | 'auth.passwordRuleDigit' | 'auth.passwordRuleSpecial';
  check: (p: string) => boolean;
}> = [
  { key: 'auth.passwordRuleLength', check: (p: string) => p.length >= 8 },
  { key: 'auth.passwordRuleUpper', check: (p: string) => /[A-Z]/.test(p) },
  { key: 'auth.passwordRuleLower', check: (p: string) => /[a-z]/.test(p) },
  { key: 'auth.passwordRuleDigit', check: (p: string) => /[0-9]/.test(p) },
  { key: 'auth.passwordRuleSpecial', check: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

async function trackAuthEvent(provider: 'apple' | 'google' | 'email') {
  const hadToken = await getAccessToken();
  track({ event: hadToken ? 'sign_in' : 'sign_up', provider });
}

/**
 * Dismiss the login screen after a successful `login()`. In guest mode login is
 * a modal pushed on top of the app stack, so we pop it; if there is nothing to
 * pop (onboarding "I have an account" inline path, or a cold deep link) we fall
 * back to the home tab. Previously the screen self-closed only because the old
 * AuthGate re-rendered the whole tree — with guest mode it stays mounted.
 */
function closeAfterLogin() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)/home');
  }
}

/**
 * Owns the entire login/registration flow: choose vs credentials step,
 * Apple/Google OAuth, email login/register with validation, and the
 * password-strength derivation. Keeps `app/login.tsx` a thin composition.
 */
export function useAuthForm() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [step, setStep] = useState<AuthStep>('choose');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [credentialsMode, setCredentialsMode] = useState<CredentialsMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const emailInputRef = useRef<TextInput>(null);

  // Check Apple Sign In availability on mount
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  // Focus email input after step transition animation completes (iOS crash prevention)
  useEffect(() => {
    if (step === 'credentials') {
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Google OAuth setup — pass a dummy clientId when env vars are missing to satisfy
  // the hook's invariant (can't skip hooks conditionally). The Google button is hidden
  // when unconfigured so the dummy value is never used for a real auth flow.
  const googleConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'unconfigured.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type !== 'success') {
      setLoading(null);
      if (googleResponse.type === 'error') {
        setError(t('auth.errorGoogleFailed'));
      }
      return;
    }

    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setError(t('auth.errorGoogleNoToken'));
      setLoading(null);
      return;
    }

    (async () => {
      const res = await api<AuthResponse>(
        '/auth/signin',
        {
          method: 'POST',
          body: { provider: 'google', idToken },
        },
      );

      if (res.data) {
        await trackAuthEvent('google');
        await login(res.data.user, res.data.accessToken, res.data.refreshToken);
        closeAfterLogin();
      } else {
        setError(res.error ?? t('auth.errorGoogleFailed'));
      }
      setLoading(null);
    })();
  }, [googleResponse]);

  const handleAppleSignIn = async () => {
    try {
      setError(null);
      setLoading('apple');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;

      const res = await api<AuthResponse>(
        '/auth/signin',
        {
          method: 'POST',
          body: {
            provider: 'apple',
            idToken: credential.identityToken,
            name: fullName || undefined,
          },
        },
      );

      if (res.data) {
        await trackAuthEvent('apple');
        await login(res.data.user, res.data.accessToken, res.data.refreshToken);
        closeAfterLogin();
      } else {
        setError(res.error ?? t('auth.errorLoginFailed'));
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError(t('auth.errorAppleFailed'));
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);

    if (!googleConfigured) {
      setError(t('auth.errorGoogleNotConfigured'));
      return;
    }

    setLoading('google');

    if (!googleRequest) {
      setError(t('auth.errorGoogleNotReady'));
      setLoading(null);
      return;
    }

    try {
      await googlePromptAsync();
    } catch {
      setError(t('auth.errorGoogleFailed'));
      setLoading(null);
    }
  };

  const handleRegister = async () => {
    setError(null);

    // Validate inputs
    if (!email.trim() || !email.includes('@')) {
      setError(t('auth.errorInvalidEmail'));
      return;
    }
    if (!password) {
      setError(t('auth.errorPasswordRequired'));
      return;
    }

    setLoading('email');

    const res = await api<AuthResponse>(
      '/auth/register',
      {
        method: 'POST',
        body: {
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        },
      },
    );

    setLoading(null);

    if (res.data) {
      track({ event: 'sign_up', provider: 'email' });
      await login(res.data.user, res.data.accessToken, res.data.refreshToken);
      closeAfterLogin();
    } else {
      setError(res.error ?? t('auth.errorRegistrationFailed'));
    }
  };

  const handleLogin = async () => {
    setError(null);

    // Validate inputs
    if (!email.trim() || !email.includes('@')) {
      setError(t('auth.errorInvalidEmail'));
      return;
    }
    if (!password) {
      setError(t('auth.errorPasswordRequired'));
      return;
    }

    setLoading('email');

    const res = await api<AuthResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: {
          email: email.trim(),
          password,
        },
      },
    );

    setLoading(null);

    if (res.data) {
      await trackAuthEvent('email');
      await login(res.data.user, res.data.accessToken, res.data.refreshToken);
      closeAfterLogin();
    } else {
      setError(res.error ?? t('auth.errorLoginFailed'));
    }
  };

  // Calculate password strength (for register mode only)
  const passwordStrength = credentialsMode === 'register'
    ? PASSWORD_CHECKS.filter((r) => r.check(password)).length
    : 0;

  // ─── Step transition actions (declarative wrappers for the screen) ───
  const selectAuthMode = (mode: AuthMode) => {
    setError(null);
    setAuthMode(mode);
  };

  const goToCredentials = () => {
    setError(null);
    setStep('credentials');
    setCredentialsMode(authMode === 'signin' ? 'login' : 'register');
  };

  const toggleCredentialsMode = () => {
    setError(null);
    setPassword('');
    setName('');
    setCredentialsMode(credentialsMode === 'login' ? 'register' : 'login');
  };

  const backToChoose = () => {
    setError(null);
    setStep('choose');
    setEmail('');
    setPassword('');
    setName('');
  };

  const submitCredentials = () => (credentialsMode === 'login' ? handleLogin() : handleRegister());

  return {
    // state
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
    // field setters
    setEmail,
    setPassword,
    setName,
    // provider actions
    handleAppleSignIn,
    handleGoogleSignIn,
    // step actions
    selectAuthMode,
    goToCredentials,
    toggleCredentialsMode,
    backToChoose,
    submitCredentials,
  };
}
