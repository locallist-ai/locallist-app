import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { chatTurn, chatGenerate, deleteChatSession } from '../../lib/api';
import { getSavedSessionId, saveSessionId, clearSessionId } from '../../lib/chat-store';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { QuickReplyChips } from '../../components/chat/QuickReplyChips';
import { SlotBadges } from '../../components/chat/SlotBadges';
import { SaveProfileSheet } from '../../components/chat/SaveProfileSheet';
import { upsertProfile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { ChatMessage, ChatSlots, QuickReply, BuilderResponse } from '../../lib/types';

const EMPTY_SLOTS: ChatSlots = {
  city: null, days: null, groupType: null, categories: null,
  budget: null, pace: null, dietary: null, exclusions: null, vibesPrimary: null,
};

export default function ChatScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [slots, setSlots] = useState<ChatSlots>(EMPTY_SLOTS);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Resume prior session on mount
  useEffect(() => {
    getSavedSessionId().then((saved) => {
      if (saved) setSessionId(saved);
    });
    // Show welcome message
    appendAiMessage(t('chat.welcomeMessage'), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendAiMessage = useCallback((text: string, replies: QuickReply[]) => {
    setMessages((prev) => [...prev, { role: 'ai', text, quickReplies: replies }]);
    setQuickReplies(replies);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendTurn = useCallback(
    async (message: string, quickReplyId: string | null) => {
      if (loading || generating) return;
      setLoading(true);
      setQuickReplies([]);

      try {
        const result = await chatTurn({ sessionId, message, quickReplyId });

        if (result.error || !result.data) {
          if (result.status === 429) {
            appendAiMessage(t('chat.rateLimited'), []);
          } else {
            appendAiMessage(t('chat.errorRetry'), []);
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
        appendAiMessage(data.aiMessage, data.ready ? [] : data.quickReplies);
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
    sendTurn(text, null);
  }, [inputText, loading, generating, appendUserMessage, sendTurn]);

  const handleChipSelect = useCallback(
    (reply: QuickReply) => {
      appendUserMessage(reply.label);
      sendTurn(reply.label, reply.id);
    },
    [appendUserMessage, sendTurn],
  );

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

  const handleReset = useCallback(async () => {
    Alert.alert(t('chat.resetTitle'), t('chat.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.resetConfirm'),
        style: 'destructive',
        onPress: async () => {
          if (sessionId) {
            await deleteChatSession(sessionId).catch(() => null);
            await clearSessionId();
          }
          setSessionId(null);
          setMessages([]);
          setSlots(EMPTY_SLOTS);
          setQuickReplies([]);
          setReady(false);
          setTurnCount(0);
          appendAiMessage(t('chat.welcomeMessage'), []);
        },
      },
    ]);
  }, [sessionId, appendAiMessage, t]);

  const handleUseWizard = useCallback(() => {
    router.push('/builder/custom');
  }, []);

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <SaveProfileSheet
        visible={saveSheetVisible}
        slots={slots}
        onSave={handleProfileSave}
        onSkip={handleProfileSkip}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={colors.deepOcean} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('chat.title')}</Text>
          {turnCount > 0 && (
            <Text style={styles.headerSub}>{t('chat.turnCount', { count: turnCount, limit: 6 })}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleReset} style={styles.headerBtn} accessibilityRole="button">
          <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Slot badges pinned below header */}
      <SlotBadges slots={slots} />

      {/* Message list */}
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
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Typing indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={colors.electricBlue} />
              <Text style={styles.typingText}>{t('chat.typing')}</Text>
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
              <Text style={styles.buildBtnText}>{t('chat.buildPlan')}</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Quick reply chips */}
        {!ready && !loading && quickReplies.length > 0 && (
          <QuickReplyChips
            replies={quickReplies}
            onSelect={handleChipSelect}
            disabled={loading || generating}
          />
        )}

        {/* Input row */}
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  headerBtn: {
    padding: 8,
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepOcean,
  },
  headerSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  messageList: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  typingRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  buildBtn: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.electricBlue,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buildBtnDisabled: {
    opacity: 0.6,
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
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
    backgroundColor: colors.bgMain,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.electricBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.4,
  },
  wizardLink: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
  },
  wizardLinkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
