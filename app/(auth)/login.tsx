import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';

export default function LoginScreen() {
  const { login, loginWithMagicLink } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const name = credential.fullName
          ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
          : undefined;

        await login('apple', credential.identityToken, name || undefined);
        router.back();
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', 'Apple Sign In failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    try {
      setIsLoading(true);
      await loginWithMagicLink(email.trim());
      setMagicLinkSent(true);
    } catch {
      Alert.alert('Error', 'Failed to send magic link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a sign-in link to {email}. Tap it to continue.
          </Text>
          <Button
            title="Resend"
            onPress={() => setMagicLinkSent(false)}
            variant="outline"
            style={styles.resendButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to LocalList</Text>
        <Text style={styles.subtitle}>
          Plans you can trust. Made by people who've been there.
        </Text>

        {/* Apple Sign In — iOS only */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={borderRadius.md}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Google Sign In */}
        <Button
          title="Continue with Google"
          onPress={() => {
            // TODO: Implement Google OAuth flow via expo-auth-session
            Alert.alert('Coming Soon', 'Google Sign In is being set up.');
          }}
          variant="outline"
          size="lg"
          style={styles.googleButton}
        />

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email Magic Link */}
        <TextInput
          style={styles.emailInput}
          placeholder="Enter your email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          title="Send Magic Link"
          onPress={handleMagicLink}
          variant="primary"
          size="lg"
          loading={isLoading}
          style={styles.magicLinkButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: spacing.md,
  },
  googleButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderColor,
  },
  dividerText: {
    ...typography.bodySmall,
    paddingHorizontal: spacing.md,
  },
  emailInput: {
    width: '100%',
    height: 50,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textMain,
    marginBottom: spacing.md,
  },
  magicLinkButton: {
    width: '100%',
  },
  resendButton: {
    marginTop: spacing.lg,
  },
});
