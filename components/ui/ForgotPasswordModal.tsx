import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, sendPasswordResetEmail } from '@react-native-firebase/auth';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { logger } from '../../lib/logger';

type Props = {
  visible: boolean;
  initialEmail?: string;
  onClose: () => void;
};

type ModalState = 'idle' | 'sending' | 'success' | 'error';

export function ForgotPasswordModal({ visible, initialEmail = '', onClose }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<ModalState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setEmail(initialEmail);
      setState('idle');
      setErrorMessage('');
    }
  }, [visible, initialEmail]);

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      setState('error');
      return;
    }

    setState('sending');
    try {
      await sendPasswordResetEmail(getAuth(), email.trim());
      setState('success');
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? (err as { code: string }).code : '';
      logger.error('Password reset failed', err);

      if (code === 'auth/user-not-found') {
        setErrorMessage('No account found with this email address.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Too many requests. Please wait a few minutes and try again.');
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('Please enter a valid email address.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
      setState('error');
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={s.overlay} onPress={handleClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <View style={s.backdrop} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.keyboardWrap}
        >
          <Animated.View
            entering={FadeIn.duration(250).springify()}
            exiting={FadeOut.duration(150)}
            style={s.content}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.container}>
                <View style={s.handleBar} />

                {state === 'success' ? (
                  <>
                    <View style={[s.iconWrap, { backgroundColor: colors.successEmerald + '12' }]}>
                      <Ionicons name="checkmark-circle" size={28} color={colors.successEmerald} />
                    </View>
                    <Text style={s.title}>Check Your Email</Text>
                    <Text style={s.body}>
                      A password reset link has been sent to{' '}
                      <Text style={{ fontFamily: fonts.bodySemiBold, color: colors.textMain }}>
                        {email.trim()}
                      </Text>
                      .{'\n\n'}Check your spam or junk folder if you don't see it within a few minutes.
                    </Text>
                    <Pressable
                      style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
                      onPress={handleClose}
                    >
                      <Text style={s.primaryBtnText}>Back to Login</Text>
                    </Pressable>
                  </>
                ) : state === 'error' ? (
                  <>
                    <View style={[s.iconWrap, { backgroundColor: colors.error + '12' }]}>
                      <Ionicons name="alert-circle" size={28} color={colors.error} />
                    </View>
                    <Text style={s.title}>Couldn't Send Email</Text>
                    <Text style={s.body}>{errorMessage}</Text>
                    <View style={s.buttons}>
                      <Pressable
                        style={({ pressed }) => [s.cancelBtn, { opacity: pressed ? 0.85 : 1 }]}
                        onPress={handleClose}
                      >
                        <Text style={s.cancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [s.primaryBtn, { flex: 1, opacity: pressed ? 0.85 : 1 }]}
                        onPress={() => { setState('idle'); setErrorMessage(''); }}
                      >
                        <Text style={s.primaryBtnText}>Try Again</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[s.iconWrap, { backgroundColor: colors.electricBlue + '12' }]}>
                      <Ionicons name="mail-outline" size={28} color={colors.electricBlue} />
                    </View>
                    <Text style={s.title}>Reset Password</Text>
                    <Text style={s.body}>
                      Enter your email and we'll send you a link to reset your password.
                    </Text>
                    <TextInput
                      style={s.input}
                      placeholder="your@email.com"
                      placeholderTextColor={colors.textSecondary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      editable={state !== 'sending'}
                      autoFocus
                    />
                    <Pressable
                      style={({ pressed }) => [
                        s.primaryBtn,
                        { width: '100%' as const },
                        (!email.trim() || !email.includes('@')) && { opacity: 0.5 },
                        state === 'sending' && { opacity: 0.6 },
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={handleSend}
                      disabled={state === 'sending' || !email.trim() || !email.includes('@')}
                    >
                      {state === 'sending' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={s.primaryBtnText}>Send Reset Link</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [s.textBtn, { opacity: pressed ? 0.7 : 1 }]}
                      onPress={handleClose}
                    >
                      <Text style={s.textBtnLabel}>Cancel</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardWrap: {
    width: '85%',
    maxWidth: 340,
  },
  content: {
    width: '100%',
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    width: '100%',
    marginBottom: spacing.md,
  },
  primaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.sunsetOrange,
    marginBottom: 8,
  },
  primaryBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  textBtn: {
    paddingVertical: spacing.sm,
    marginBottom: 4,
  },
  textBtnLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  cancelText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
