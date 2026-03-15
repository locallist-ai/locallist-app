import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';
import { TypingDots } from './TypingDots';

// ── Types ──

interface ChatStepProps {
  message: string;
  onChangeMessage: (text: string) => void;
  showBubbleText: boolean;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}

// ── Component ──

export const ChatStep: React.FC<ChatStepProps> = ({
  message,
  onChangeMessage,
  showBubbleText,
  loading,
  error,
  onGenerate,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Hero text */}
      <Text style={styles.title}>
        {t('wizard.chatTitle')}
      </Text>
      <Text style={styles.subtitle}>
        {t('wizard.chatSubtitle')}
      </Text>

      {/* Chat bubble */}
      <Animated.View
        entering={FadeInUp.duration(600).delay(200).springify().damping(14)}
        style={styles.bubble}
      >
        <BlurView intensity={70} tint="light" style={styles.bubbleInner}>
          {/* AI message */}
          <View style={styles.aiRow}>
            <View style={styles.aiAvatar}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.aiIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.aiMessageContainer}>
              {showBubbleText ? (
                <Text style={styles.aiMessage}>
                  {t('wizard.chatAiMessage')}
                </Text>
              ) : (
                <TypingDots />
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* User input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={onChangeMessage}
              placeholder={t('wizard.chatPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              accessibilityLabel={t('wizard.chatPlaceholder')}
            />
          </View>
        </BlurView>
      </Animated.View>

      {/* Error */}
      {error && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}

      {/* Generate button */}
      <View style={[styles.generateWrapper, { paddingBottom: insets.bottom + 20 }]}>
        <Animated.View entering={FadeInUp.duration(600).delay(400).springify().damping(12)}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onGenerate}
            disabled={loading}
            style={[styles.generateButton, loading && styles.generateButtonLoading]}
            accessibilityLabel={t('wizard.buildMyPlan')}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                <Text style={styles.generateText}>
                  {t('wizard.buildMyPlan')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 36,
    lineHeight: 44,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bubble: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 20,
  },
  bubbleInner: {
    padding: 18,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIcon: {
    width: 18,
    height: 22,
  },
  aiMessageContainer: {
    flex: 1,
  },
  aiMessage: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.deepOcean,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
    maxHeight: 80,
    minHeight: 20,
    paddingVertical: 0,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  generateWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  generateButton: {
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.sunsetOrange,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  generateButtonLoading: {
    opacity: 0.7,
  },
  generateText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
