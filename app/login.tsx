import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AuthResponse } from '../lib/types';

// Required for Google Auth redirect to close the browser on web
WebBrowser.maybeCompleteAuthSession();

type AuthStep = 'choose' | 'credentials';
type CredentialsMode = 'login' | 'register';
type AuthMode = 'signin' | 'signup';

// Password requirements
const PASSWORD_RULES = [
  { text: 'At least 8 characters', check: (p: string) => p.length >= 8 },
  { text: 'Uppercase letter (A-Z)', check: (p: string) => /[A-Z]/.test(p) },
  { text: 'Lowercase letter (a-z)', check: (p: string) => /[a-z]/.test(p) },
  { text: 'Number (0-9)', check: (p: string) => /[0-9]/.test(p) },
  { text: 'Special character (!@#$%)', check: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function LoginScreen() {
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

  // Check Apple Sign In availability on mount
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

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
    if (googleResponse?.type !== 'success') return;

    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      setError('Google Sign In failed — no token received');
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
        await login(res.data.user, res.data.accessToken, res.data.refreshToken);
      } else {
        setError(res.error ?? 'Google Sign In failed');
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

      const name = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;

      const res = await api<AuthResponse>(
        '/auth/signin',
        {
          method: 'POST',
          body: {
            provider: 'apple',
            idToken: credential.identityToken,
            name: name || undefined,
          },
        },
      );

      if (res.data) {
        await login(res.data.user, res.data.accessToken, res.data.refreshToken);
      } else {
        setError(res.error ?? 'Log in failed');
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError('Apple Sign In failed');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);

    if (!googleConfigured) {
      setError('Google Sign In no está configurado en este build. Usa Apple o email por ahora.');
      return;
    }

    setLoading('google');

    if (!googleRequest) {
      setError('Google Sign In is not ready yet — try again in a moment');
      setLoading(null);
      return;
    }

    try {
      await googlePromptAsync();
    } catch {
      setError('Google Sign In failed');
      setLoading(null);
    }
  };

  const handleRegister = async () => {
    setError(null);

    // Validate inputs
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading('email');

    const res = await api<AuthResponse>(
      '/auth/register',
      {
        method: 'POST',
        body: {
          email: email.trim(),
          password: password.trim(),
          name: name.trim() || undefined,
        },
      },
    );

    setLoading(null);

    if (res.data) {
      await login(res.data.user, res.data.accessToken, res.data.refreshToken);
    } else {
      setError(res.error ?? 'Registration failed');
    }
  };

  const handleLogin = async () => {
    setError(null);

    // Validate inputs
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading('email');

    const res = await api<AuthResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: {
          email: email.trim(),
          password: password.trim(),
        },
      },
    );

    setLoading(null);

    if (res.data) {
      await login(res.data.user, res.data.accessToken, res.data.refreshToken);
    } else {
      setError(res.error ?? 'Login failed');
    }
  };

  // Calculate password strength (for register mode only)
  const passwordStrength = credentialsMode === 'register'
    ? PASSWORD_RULES.filter(r => r.check(password)).length
    : 0;

  // ─── Main login screen ────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgMain }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../assets/images/icon.png')}
          style={{ width: 64, height: 80, marginBottom: spacing.lg }}
          resizeMode="contain"
        />
        <Text
          style={{
            fontFamily: fonts.headingBold,
            fontSize: 26,
            color: colors.deepOcean,
            marginBottom: spacing.sm,
            textAlign: 'center',
          }}
        >
          {step === 'choose'
            ? (authMode === 'signin' ? 'Welcome back' : 'Join LocalList')
            : credentialsMode === 'login' ? 'Log in' : 'Create account'}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 15,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: spacing.lg,
            lineHeight: 22,
          }}
        >
          Stop researching. Start traveling.{'\n'}
          Only the best, nothing else.
        </Text>

        {error && (
          <View
            style={{
              backgroundColor: colors.error + '12',
              borderRadius: borderRadius.md,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: spacing.md,
              width: '100%',
            }}
          >
            <Text
              selectable
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.error,
                textAlign: 'center',
              }}
            >
              {error}
            </Text>
          </View>
        )}

        {step === 'choose' ? (
          <View style={{ width: '100%', gap: 12 }}>
            {/* Top toggle Log in / Sign up — deja claro que las 3 opciones
                de abajo sirven tanto para registrarse como para volver a entrar. */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: colors.bgCard,
                borderRadius: borderRadius.lg,
                borderCurve: 'continuous',
                padding: 4,
                marginBottom: spacing.sm,
              }}
            >
              {(['signin', 'signup'] as const).map((mode) => {
                const active = authMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => { setError(null); setAuthMode(mode); }}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: borderRadius.md,
                      borderCurve: 'continuous',
                      backgroundColor: active ? colors.sunsetOrange : 'transparent',
                      alignItems: 'center',
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.bodySemiBold,
                        fontSize: 14,
                        color: active ? '#FFFFFF' : colors.textSecondary,
                      }}
                    >
                      {mode === 'signin' ? 'Log in' : 'Sign up'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Apple */}
            {appleAvailable && (
              <Pressable
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  width: '100%',
                  paddingVertical: 16,
                  borderRadius: borderRadius.lg,
                  borderCurve: 'continuous',
                  backgroundColor: '#000000',
                  opacity: loading ? 0.6 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
                onPress={handleAppleSignIn}
                disabled={!!loading}
              >
                {loading === 'apple' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                    <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' }}>
                      {authMode === 'signin' ? 'Log in with Apple' : 'Sign up with Apple'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Google — siempre visible. Si el env var no está configurado,
                handleGoogleSignIn muestra un error claro en runtime en lugar
                de que el botón desaparezca sin explicación. */}
            <Pressable
              style={({ pressed }) => ({
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
                opacity: loading ? 0.6 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
              onPress={handleGoogleSignIn}
              disabled={!!loading}
            >
              {loading === 'google' ? (
                <ActivityIndicator size="small" color={colors.deepOcean} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={colors.deepOcean} />
                  <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.deepOcean }}>
                    {authMode === 'signin' ? 'Log in with Google' : 'Sign up with Google'}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Email */}
            <Pressable
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                paddingVertical: 16,
                borderRadius: borderRadius.lg,
                borderCurve: 'continuous',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: colors.sunsetOrange,
                opacity: loading ? 0.6 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
              onPress={() => {
                setError(null);
                setStep('credentials');
                setCredentialsMode(authMode === 'signin' ? 'login' : 'register');
              }}
              disabled={!!loading}
            >
              <Ionicons name="mail-outline" size={20} color={colors.sunsetOrange} />
              <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.sunsetOrange }}>
                {authMode === 'signin' ? 'Log in with Email' : 'Sign up with Email'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ width: '100%', gap: 12 }}>
            {/* Email Input */}
            <TextInput
              style={{
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
              }}
              placeholder="your@email.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
            />

            {/* Password Input */}
            <TextInput
              style={{
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
              }}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />

            {/* Name Input (register only) */}
            {credentialsMode === 'register' && (
              <TextInput
                style={{
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
                }}
                placeholder="Your name (optional)"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />
            )}

            {/* Password Requirements (register only) */}
            {credentialsMode === 'register' && password && (
              <View style={{ backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm }}>
                {PASSWORD_RULES.map((rule, idx) => {
                  const isMet = rule.check(password);
                  return (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Ionicons
                        name={isMet ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={isMet ? colors.successEmerald : colors.textSecondary}
                      />
                      <Text
                        style={{
                          fontFamily: fonts.body,
                          fontSize: 13,
                          color: isMet ? colors.textMain : colors.textSecondary,
                        }}
                      >
                        {rule.text}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Main Button */}
            <Pressable
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                paddingVertical: 16,
                borderRadius: borderRadius.lg,
                borderCurve: 'continuous',
                backgroundColor: colors.sunsetOrange,
                opacity:
                  (credentialsMode === 'login' && (!email.trim() || !password.trim())) ||
                  (credentialsMode === 'register' && (!email.trim() || !password.trim() || passwordStrength < 5))
                    ? 0.5
                    : loading ? 0.6 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
              onPress={credentialsMode === 'login' ? handleLogin : handleRegister}
              disabled={
                loading !== null ||
                (credentialsMode === 'login' && (!email.trim() || !password.trim())) ||
                (credentialsMode === 'register' && (!email.trim() || !password.trim() || passwordStrength < 5))
              }
            >
              {loading === 'email' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' }}>
                  {credentialsMode === 'login' ? 'Log In' : 'Create Account'}
                </Text>
              )}
            </Pressable>

            {/* Toggle Register/Login */}
            <Pressable
              style={({ pressed }) => ({
                paddingVertical: spacing.md,
                alignItems: 'center' as const,
                opacity: pressed ? 0.7 : 1,
              })}
              onPress={() => {
                setError(null);
                setPassword('');
                setName('');
                setCredentialsMode(credentialsMode === 'login' ? 'register' : 'login');
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 14,
                  color: colors.textSecondary,
                }}
              >
                {credentialsMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={{ color: colors.sunsetOrange, fontFamily: fonts.bodySemiBold }}>
                  {credentialsMode === 'login' ? 'Create one' : 'Log in'}
                </Text>
              </Text>
            </Pressable>

            {/* Back Button */}
            <Pressable
              style={({ pressed }) => ({
                paddingVertical: spacing.md,
                alignItems: 'center' as const,
                opacity: pressed ? 0.7 : 1,
              })}
              onPress={() => { setError(null); setStep('choose'); setEmail(''); setPassword(''); setName(''); }}
            >
              <Text
                style={{
                  fontFamily: fonts.bodyMedium,
                  fontSize: 14,
                  color: colors.sunsetOrange,
                }}
              >
                Back
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
