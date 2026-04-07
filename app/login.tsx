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
import {
  getAuth,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  AppleAuthProvider,
  updateProfile,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { logger } from '../lib/logger';
import { ForgotPasswordModal } from '../components/ui/ForgotPasswordModal';

// Configure Google Sign-In with webClientId from google-services.json
GoogleSignin.configure({
  webClientId: '195843426507-92etgqen23mv2epi9i3b4so8ghasd7lu.apps.googleusercontent.com',
});

function getFirebaseAuth() {
  return getAuth();
}

type AuthStep = 'choose' | 'credentials';
type CredentialsMode = 'login' | 'register';

// Password requirements
const PASSWORD_RULES = [
  { text: 'At least 8 characters', check: (p: string) => p.length >= 8 },
  { text: 'Uppercase letter (A-Z)', check: (p: string) => /[A-Z]/.test(p) },
  { text: 'Lowercase letter (a-z)', check: (p: string) => /[a-z]/.test(p) },
  { text: 'Number (0-9)', check: (p: string) => /[0-9]/.test(p) },
  { text: 'Special character (!@#$%)', check: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function LoginScreen() {
  const [step, setStep] = useState<AuthStep>('choose');
  const [credentialsMode, setCredentialsMode] = useState<CredentialsMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const { syncError, retrySync } = useAuth();

  // Check Apple Sign In availability on mount
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

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

      if (!credential.identityToken) {
        setError('Apple Sign In failed — no token received');
        return;
      }

      // Create Firebase credential from Apple token
      const appleCredential = AppleAuthProvider.credential(
        credential.identityToken,
        credential.authorizationCode ?? undefined,
      );

      // Sign in to Firebase (triggers onAuthStateChanged → backend sync)
      const userCredential = await signInWithCredential(getFirebaseAuth(), appleCredential);

      // Update display name if Apple provided it (only on first sign-in)
      if (credential.fullName) {
        const displayName = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ');
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'ERR_REQUEST_CANCELED') return;
        if (code === 'auth/account-exists-with-different-credential') {
          setError('This email is already registered with a different sign-in method. Try using your email and password instead.');
          return;
        }
      }
      logger.error('Apple Sign In failed', err);
      setError('Apple Sign In failed');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setLoading('google');

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (!response.data?.idToken) {
        setError('Google Sign In failed — no token received');
        return;
      }

      // Create Firebase credential from Google token
      const googleCredential = GoogleAuthProvider.credential(response.data.idToken);

      // Sign in to Firebase (triggers onAuthStateChanged → backend sync)
      await signInWithCredential(getFirebaseAuth(), googleCredential);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err) {
        const code = (err as { code: string }).code;
        // User cancelled
        if (code === 'SIGN_IN_CANCELLED' || code === '12501') return;
        if (code === 'auth/account-exists-with-different-credential') {
          setError('This email is already registered with email/password. Please sign in with your password instead.');
          return;
        }
      }
      logger.error('Google Sign In failed', err);
      setError('Google Sign In failed');
    } finally {
      setLoading(null);
    }
  };

  const handleLogin = async () => {
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading('email');

    try {
      // Firebase email/password sign-in (triggers onAuthStateChanged → backend sync)
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password.trim());
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? (err as { code: string }).code : '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleRegister = async () => {
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading('email');

    try {
      // Firebase create account (triggers onAuthStateChanged → backend sync)
      const userCredential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password.trim());

      // Set display name if provided
      if (name.trim()) {
        await updateProfile(userCredential.user, { displayName: name.trim() });
      }
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? (err as { code: string }).code : '';
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Registration failed');
      }
    } finally {
      setLoading(null);
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
          {step === 'choose' ? 'Sign in to LocalList' : credentialsMode === 'login' ? 'Sign in' : 'Create account'}
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

        {syncError && !error && (
          <View
            style={{
              backgroundColor: colors.sunsetOrange + '12',
              borderRadius: borderRadius.md,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: spacing.md,
              width: '100%',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.sunsetOrange,
                textAlign: 'center',
              }}
            >
              {syncError}
            </Text>
            <Pressable
              style={({ pressed }) => ({
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.sunsetOrange,
                opacity: pressed ? 0.85 : 1,
              })}
              onPress={retrySync}
            >
              <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: '#FFFFFF' }}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {step === 'choose' ? (
          <View style={{ width: '100%', gap: 12 }}>
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
                      Continue with Apple
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Google */}
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
                    Continue with Google
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
              onPress={() => { setError(null); setStep('credentials'); setCredentialsMode('login'); }}
              disabled={!!loading}
            >
              <Ionicons name="mail-outline" size={20} color={colors.sunsetOrange} />
              <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.sunsetOrange }}>
                Continue with Email
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
                  {credentialsMode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </Pressable>

            {/* Forgot Password (login only) */}
            {credentialsMode === 'login' && (
              <Pressable
                style={({ pressed }) => ({
                  paddingVertical: spacing.sm,
                  alignItems: 'center' as const,
                  opacity: pressed ? 0.7 : 1,
                })}
                onPress={() => setForgotModalVisible(true)}
              >
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 14,
                    color: colors.electricBlue,
                  }}
                >
                  Forgot password?
                </Text>
              </Pressable>
            )}

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
                  {credentialsMode === 'login' ? 'Create one' : 'Sign in'}
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

      <ForgotPasswordModal
        visible={forgotModalVisible}
        initialEmail={email.trim()}
        onClose={() => setForgotModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}
