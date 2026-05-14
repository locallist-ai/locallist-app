import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { chatTurn, chatGenerate, deleteChatSession } from '../../lib/api';
import { getSavedSessionId, saveSessionId, clearSessionId } from '../../lib/chat-store';
import { BlurView } from 'expo-blur';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { SaveProfileSheet } from '../../components/chat/SaveProfileSheet';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TypingDots } from '../../components/home/TypingDots';
import { upsertProfile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { track, countFilledSlots } from '../../lib/analytics';
import { useTripContext } from '../../lib/trip-context-store';
import type { ChatMessage, ChatSlots, BuilderResponse } from '../../lib/types';

const EMPTY_SLOTS: ChatSlots = {
  city: null, days: null, groupType: null, categories: null,
  budget: null, pace: null, dietary: null, exclusions: null, vibesPrimary: null,
};

export default function ChatScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isAuthenticated } = useAuth();
  const { city: preSeededCity } = useTripContext();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [slots, setSlots] = useState<ChatSlots>(EMPTY_SLOTS);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const initRef = useRef(false);

  // Resume prior session on mount; if city was pre-selected, seed it on first turn
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    track({ event: 'chat_started', sessionId: null });
    (async () => {
      const saved = await getSavedSessionId();
      if (saved) {
        setSessionId(saved);
        appendAiMessage(t('chat.welcomeMessage'));
        return;
      }
      if (preSeededCity) {
        // New session with pre-selected city: send preSeededSlots so backend
        // fills city slot and returns a greeting without user typing the city
        setLoading(true);
        try {
          const result = await chatTurn({
            sessionId: null,
            message: '',
            quickReplyId: null,
            preSeededSlots: { city: preSeededCity },
          });
          if (result.data) {
            const data = result.data;
            setSessionId(data.sessionId);
            await saveSessionId(data.sessionId);
            setSlots(data.slots);
            setReady(data.ready);
            setTurnCount(data.turnCount);
            setMessages([{ role: 'ai', text: data.aiMessage }]);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
            return;
          }
        } finally {
          setLoading(false);
        }
      }
      appendAiMessage(t('chat.welcomeMessage'));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendAiMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'ai', text }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendTurn = useCallback(
    async (message: string) => {
      if (loading || generating) return;
      setLoading(true);

      try {
        const result = await chatTurn({ sessionId, message, quickReplyId: null });

        if (result.error || !result.data) {
          if (result.status === 429) {
            appendAiMessage(t('chat.rateLimited'));
          } else {
            appendAiMessage(t('chat.errorRetry'));
          }
          return;
        }

        const data = result.data;
        const newSessionId = data.sessionId;

        if (!sessionId || sessionId !== newSessionId) {
          setSessionId(newSessionId);
          await saveSessionId(newSessionId);
        }

        setSlots(data.slots);
        setReady(data.ready);
        setTurnCount(data.turnCount);
        track({
          event: 'chat_turn',
          sessionId: newSessionId,
          turnCount: data.turnCount,
          slotsFilled: countFilledSlots(data.slots),
          totalSlots: 9,
        });
        if (data.ready) {
          track({ event: 'chat_ready', sessionId: newSessionId, turnCount: data.turnCount });
        }
        appendAiMessage(data.aiMessage);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading, generating, appendAiMessage, t],
  );

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || loading || generating) return;
    setInputText('');
    appendUserMessage(text);
    sendTurn(text);
  }, [inputText, loading, generating, appendUserMessage, sendTurn]);

  const handleGenerate = useCallback(async () => {
    if (!sessionId || generating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);

    try {
      const result = await chatGenerate({ sessionId });

      if (result.error || !result.data) {
        if (result.status === 429) {
          Alert.alert(t('chat.rateLimitTitle'), t('chat.rateLimitBody'));
        } else {
          Alert.alert(t('common.somethingWentWrong'), t('common.unexpectedError'));
        }
        return;
      }

      const plan = (result.data as BuilderResponse).plan;
      track({ event: 'chat_generated', sessionId: sessionId!, planId: plan.id, turnCount });
      await clearSessionId();

      // Offer to save profile preferences if user is authenticated and has meaningful slots
      if (isAuthenticated && (slots.groupType || slots.pace || slots.budget || slots.dietary?.length)) {
        setPendingPlanId(plan.id);
        setSaveSheetVisible(true);
      } else {
        router.push(`/plan/${plan.id}`);
      }
    } finally {
      setGenerating(false);
    }
  }, [sessionId, generating, slots, isAuthenticated, t]);

  const handleReset = useCallback(() => {
    setResetConfirmVisible(true);
  }, []);

  const executeReset = useCallback(async () => {
    setResetConfirmVisible(false);
    if (sessionId) {
      track({ event: 'chat_abandoned', sessionId, turnCount });
      await deleteChatSession(sessionId).catch(() => null);
      await clearSessionId();
    }
    setSessionId(null);
    setMessages([]);
    setSlots(EMPTY_SLOTS);
    setReady(false);
    setTurnCount(0);
    appendAiMessage(t('chat.welcomeMessage'));
  }, [sessionId, turnCount, appendAiMessage, t]);

  const handleUseWizard = useCallback(() => {
    track({ event: 'chat_to_wizard_escape', sessionId, turnCount });
    router.push('/builder/wizard');
  }, [sessionId, turnCount]);

  const handleProfileSave = async (fields: {
    groupType?: string; pace?: string; budget?: string; dietary?: string[];
  }) => {
    await upsertProfile({
      defaultGroupType: fields.groupType,
      pacePreference: fields.pace,
      defaultBudgetTier: fields.budget,
      dietaryRestrictions: fields.dietary,
    });
    setSaveSheetVisible(false);
    if (pendingPlanId) router.push(`/plan/${pendingPlanId}`);
  };

  const handleProfileSkip = () => {
    setSaveSheetVisible(false);
    if (pendingPlanId) router.push(`/plan/${pendingPlanId}`);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.root}>
      <StatusBar style="light" />
      <SaveProfileSheet
        visible={saveSheetVisible}
        slots={slots}
        onSave={handleProfileSave}
        onSkip={handleProfileSkip}
      />
      <ConfirmModal
        visible={resetConfirmVisible}
        icon="refresh-outline"
        iconColor={colors.sunsetOrange}
        title={t('chat.resetTitle')}
        body={t('chat.resetBody')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('chat.resetConfirm')}
        confirmDestructive
        onCancel={() => setResetConfirmVisible(false)}
        onConfirm={executeReset}
      />

      {/* Background — idéntico al wizard (HomeScreen) */}
      <Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={[styles.bgImage, { width: screenWidth + 200, height: screenHeight + 300 }]}
        resizeMode="cover"
      />
<View style={styles.bgOverlay} />

      {/* Floating header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {preSeededCity ? (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/home')}
              style={styles.cityPill}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`City: ${preSeededCity}, tap to change`}
            >
              <Text style={styles.cityPillText} numberOfLines={1}>
                {preSeededCity}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleReset}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Reset conversation"
        >
          <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Message list + input */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <MessageBubble message={item} />}
          style={styles.list}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Typing indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.typingAvatar}>
              <Image source={require('../../assets/images/icon.png')} style={styles.typingAvatarIcon} resizeMode="contain" />
            </View>
            <View style={styles.typingBubbleOuter}>
              <BlurView intensity={70} tint="light" style={styles.typingBubbleInner}>
                <TypingDots />
              </BlurView>
            </View>
          </View>
        )}

        {/* Ready CTA */}
        {ready && !loading && (
          <TouchableOpacity
            style={[styles.buildBtn, generating && styles.buildBtnDisabled]}
            onPress={handleGenerate}
            disabled={generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.buildBtnText}>{t('chat.buildPlan')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Input row */}
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <BlurView intensity={60} tint="light" style={styles.inputBlur}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={t('chat.inputPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
              editable={!loading && !generating && !ready}
            />
          </BlurView>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || loading || generating || ready}
            style={[styles.sendBtn, (!inputText.trim() || loading || generating || ready) && styles.sendBtnDisabled]}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Escape hatch */}
        <TouchableOpacity onPress={handleUseWizard} style={styles.wizardLink}>
          <Text style={styles.wizardLinkText}>{t('chat.useWizard')}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bgImage: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    bottom: -200,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  cityPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    maxWidth: 160,
  },
  cityPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  messageList: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  typingRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  typingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  typingAvatarIcon: {
    width: 18,
    height: 22,
  },
  typingBubbleOuter: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomLeftRadius: 4,
    overflow: 'hidden',
  },
  typingBubbleInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buildBtn: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.sunsetOrange,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  buildBtnDisabled: {
    opacity: 0.7,
  },
  buildBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: spacing.sm,
  },
  inputBlur: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    shadowOpacity: 0,
    elevation: 0,
  },
  wizardLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  wizardLinkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
