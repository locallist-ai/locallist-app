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
import { chatTurn, chatGenerate, deleteChatSession, upsertProfile, getAccessToken } from '../../lib/api';
import { getSavedSessionId, saveSessionId, clearSessionId } from '../../lib/chat-store';
import { BlurView } from 'expo-blur';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { CityNoticeBubble } from '../../components/chat/CityNoticeBubble';
import { ChatErrorBubble } from '../../components/chat/ChatErrorBubble';
import { QuickReplyChips } from '../../components/chat/QuickReplyChips';
import { SaveProfileSheet } from '../../components/chat/SaveProfileSheet';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TypingDots } from '../../components/home/TypingDots';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { mapGateError, parseClampedHint } from '../../lib/gate-errors';
import { track, countFilledSlots } from '../../lib/analytics';
import { useTripContext } from '../../lib/trip-context-store';
import type { ChatMessage, ChatSlots, QuickReply, BuilderResponse } from '../../lib/types';

const EMPTY_SLOTS: ChatSlots = {
  city: null, days: null, groupType: null, categories: null,
  budget: null, pace: null, dietary: null, exclusions: null, vibesPrimary: null,
};

export default function ChatScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isAuthenticated, isPro, aiPlansMonth, refreshAiPlansQuota } = useAuth();
  const { presentGate, presentClamped } = useGateHandler();
  const { city: preSeededCity } = useTripContext();

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
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const initRef = useRef(false);
  // Guard síncrono contra doble-envío: el state `loading` no protege contra
  // dos toques en el mismo batch (ambos handlers ven loading=false por
  // closure stale); el ref se escribe síncronamente antes de cualquier await.
  const pendingRef = useRef(false);
  // Thunk para reintentar el último turno que falló por infra (ai_unavailable).
  // Lo fija quien detecta el error; el botón de reintento lo invoca.
  const retryRef = useRef<(() => void) | null>(null);

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
        // fills city slot and returns a greeting without user typing the city.
        // Envuelto en una función local para poder reintentarlo si la infra cae.
        // `existingSessionId` reusa la sesión que un turno preseed fallido ya
        // creó: null en el primer intento, el sessionId real en el reintento.
        const runPreSeeded = async (existingSessionId: string | null = null): Promise<boolean> => {
          if (pendingRef.current) return false;
          pendingRef.current = true;
          setLoading(true);
          try {
            const result = await chatTurn({
              sessionId: existingSessionId,
              message: '',
              quickReplyId: null,
              preSeededSlots: { city: preSeededCity },
            });
            if (!result.data) return false;
            const data = result.data;
            setSessionId(data.sessionId);
            await saveSessionId(data.sessionId);
            setSlots(data.slots);
            setReady(data.ready);
            setTurnCount(data.turnCount);
            // Infra caída en el primer turno: estado de error con reintento, no
            // saludo normal. El reintento reejecuta este mismo turno preseed
            // reusando la sesión que el backend ya creó (data.sessionId), no
            // sessionId:null — que dejaría huérfana esta sesión al crear otra.
            if (data.error === 'ai_unavailable') {
              retryRef.current = () => { runPreSeeded(data.sessionId); };
              track({ event: 'chat_ai_unavailable', sessionId: data.sessionId });
              setMessages([{ role: 'ai', text: data.aiMessage, aiError: true }]);
              setQuickReplies([]);
            } else if (data.cityUnsupported) {
              // Red de seguridad: una ciudad pre-seleccionada no debería ser no
              // cubierta (el selector ya la gatea), pero un prefill de perfil
              // podría serlo. El backend limpia slots.city, así que reportamos
              // la ciudad que el usuario pidió (el preseed), no null.
              track({ event: 'chat_city_unsupported', sessionId: data.sessionId, city: preSeededCity ?? null });
              setMessages([{ role: 'ai', text: data.aiMessage, cityUnsupported: true }]);
              setQuickReplies([]);
            } else {
              setMessages([{ role: 'ai', text: data.aiMessage }]);
              setQuickReplies(data.ready ? [] : data.quickReplies);
            }
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
            return true;
          } finally {
            pendingRef.current = false;
            setLoading(false);
          }
        };
        const handled = await runPreSeeded();
        if (handled) return;
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

  // Aviso de ciudad no cubierta: el texto ya viene del backend (`aiMessage`),
  // pero se marca para renderizar como aviso con CTA, no como turno normal.
  const appendCityNotice = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'ai', text, cityUnsupported: true }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSwitchCity = useCallback(() => {
    router.push('/(tabs)/home');
  }, []);

  // Estado de error de infra (LLM caído): el texto genérico viene del backend
  // (`aiMessage`); se marca para renderizar como error con reintento.
  const appendAiError = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'ai', text, aiError: true }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleRetry = useCallback(() => {
    const retry = retryRef.current;
    if (!retry || pendingRef.current || loading || generating) return;
    // Quita el estado de error antes de reintentar el turno que falló.
    setMessages((prev) => prev.filter((m) => !m.aiError));
    retry();
  }, [loading, generating]);

  const sendTurn = useCallback(
    async (message: string, quickReplyId: string | null = null) => {
      if (pendingRef.current || loading || generating) return;
      pendingRef.current = true;
      setLoading(true);
      const prevReplies = quickReplies;
      setQuickReplies([]);

      try {
        const result = await chatTurn({ sessionId, message, quickReplyId });

        if (result.error || !result.data) {
          // Error transitorio (429/red): LastOfferedChips sigue vigente en el
          // server, así que los chips anteriores se restauran.
          setQuickReplies(prevReplies);
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

        // Error de infraestructura: la cadena LLM falló de verdad (distinto de
        // "no te he entendido"). Estado de error con reintento, no turno normal.
        // No exponemos detalle técnico: solo el mensaje genérico + reintentar.
        if (data.error === 'ai_unavailable') {
          // Reintentar vía el ref al sendTurn más reciente (sessionId ya fijado):
          // evita recrear sesión cuando el fallo ocurre en el primer turno.
          retryRef.current = () => sendTurnRef.current(message, quickReplyId);
          track({ event: 'chat_ai_unavailable', sessionId: newSessionId });
          appendAiError(data.aiMessage);
          setQuickReplies([]);
          return;
        }

        // Ciudad no cubierta: el backend limpió el slot city y NO avanzó el
        // slot-filling. Renderizamos el aviso (que ya viene en aiMessage) como
        // aviso con CTA, no como turno normal, y no mostramos quick replies.
        if (data.cityUnsupported) {
          // slots.city viene limpio del backend; el valor real es lo que el
          // usuario escribió en este turno (la ciudad que pidió).
          track({ event: 'chat_city_unsupported', sessionId: newSessionId, city: message || null });
          appendCityNotice(data.aiMessage);
          setQuickReplies([]);
          return;
        }

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
        setQuickReplies(data.ready ? [] : data.quickReplies);
      } finally {
        pendingRef.current = false;
        setLoading(false);
      }
    },
    [sessionId, loading, generating, quickReplies, appendAiMessage, appendCityNotice, appendAiError, t],
  );

  // Espejo del sendTurn más reciente: el reintento de un ai_unavailable debe usar
  // el sessionId ya actualizado. En el primer turno, el closure capturado tendría
  // sessionId=null y recrearía sesión (dejando la primera huérfana); leyendo el
  // ref se reusa la sesión que el turno fallido ya creó.
  const sendTurnRef = useRef(sendTurn);
  useEffect(() => {
    sendTurnRef.current = sendTurn;
  }, [sendTurn]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || pendingRef.current || loading || generating) return;
    setInputText('');
    appendUserMessage(text);
    sendTurn(text);
  }, [inputText, loading, generating, appendUserMessage, sendTurn]);

  const handleChipSelect = useCallback(
    (reply: QuickReply) => {
      // Mismo pre-guard que handleSend: sin él, un doble-tap appendea el
      // bubble del usuario y sendTurn descarta el envío en silencio.
      if (pendingRef.current || loading || generating) return;
      appendUserMessage(reply.label);
      sendTurn(reply.label, reply.id);
    },
    [loading, generating, appendUserMessage, sendTurn],
  );

  const handleGenerate = useCallback(async () => {
    if (!sessionId || pendingRef.current || generating) return;

    // Claim the synchronous double-tap guard BEFORE any await (the token read
    // below yields): two taps in the same batch must not both slip through.
    pendingRef.current = true;

    // Generation is `[Authorize]` on the backend. Gate on TOKEN PRESENCE, not on
    // the in-memory `user`: a transient `/account` failure at startup leaves
    // `user` null while the token still lives in SecureStore (G1). A real guest
    // has no token → prompt signup; an expired token is caught by the 401 map.
    const token = await getAccessToken();
    if (!token) {
      pendingRef.current = false;
      presentGate({ type: 'signup_required' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);

    try {
      const result = await chatGenerate({ sessionId });

      if (result.error || !result.data) {
        const errorBody = result.errorBody as { error?: string; city?: string | null } | null;
        if (errorBody?.error === 'city_unsupported') {
          // Red de seguridad: la sesión llegó a generar con una ciudad no
          // cubierta (prefill antiguo). Aviso amable + CTA, no pantalla rota.
          // El 400 reporta la ciudad real (`city`); usamos esa, no null.
          track({ event: 'chat_city_unsupported', sessionId, city: errorBody.city ?? slots.city });
          Alert.alert(
            t('chat.cityUnsupportedTitle'),
            t('chat.cityUnsupportedBody'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('chat.cityUnsupportedCta'), onPress: handleSwitchCity },
            ],
          );
          return;
        }
        // Centralised gate mapping: 401 → signup, 403 structured → upsell,
        // 429 daily_cap → soft throttle (Plus, no upsell), else rate_limit/generic.
        const action = mapGateError(result.status, result.errorBody);
        if (action.type === 'signup_required' || action.type === 'upsell' || action.type === 'soft_throttle') {
          presentGate(action);
        } else if (action.type === 'rate_limit') {
          Alert.alert(t('chat.rateLimitTitle'), t('chat.rateLimitBody'));
        } else {
          Alert.alert(t('common.somethingWentWrong'), t('common.unexpectedError'));
        }
        return;
      }

      const plan = (result.data as BuilderResponse).plan;
      track({ event: 'chat_generated', sessionId: sessionId!, planId: plan.id, turnCount });
      await clearSessionId();

      // Soft upsell if the plan's duration was clamped to the free cap (`clamped`).
      const clamped = parseClampedHint(result.data);
      if (clamped) presentClamped(clamped.appliedDays ?? plan.durationDays);

      // A successful generation consumes one of the free monthly plans — refresh
      // the quota so the "X of N" line stays current for the rest of the session (g3).
      void refreshAiPlansQuota();

      // Offer to save profile preferences if user is authenticated and has meaningful slots
      if (isAuthenticated && (slots.groupType || slots.pace || slots.budget || slots.dietary?.length)) {
        setPendingPlanId(plan.id);
        setSaveSheetVisible(true);
      } else {
        router.push(`/plan/${plan.id}`);
      }
    } finally {
      pendingRef.current = false;
      setGenerating(false);
    }
  }, [sessionId, generating, slots, turnCount, isAuthenticated, handleSwitchCity, t, presentGate, presentClamped, refreshAiPlansQuota]);

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
    setQuickReplies([]);
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
          accessibilityLabel={t('common.back')}
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
              accessibilityLabel={t('chat.cityPillA11y', { city: preSeededCity })}
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
          accessibilityLabel={t('chat.resetA11y')}
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
          renderItem={({ item }) =>
            item.aiError ? (
              <ChatErrorBubble text={item.text} onRetry={handleRetry} />
            ) : item.cityUnsupported ? (
              <CityNoticeBubble text={item.text} onSwitchCity={handleSwitchCity} />
            ) : (
              <MessageBubble message={item} />
            )
          }
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

        {/* Monthly AI-plan quota — free users only, when the backend exposes it. */}
        {ready && !loading && !isPro && aiPlansMonth && (
          <Text style={styles.quotaText}>
            {t('gate.quotaRemaining', { used: aiPlansMonth.used, limit: aiPlansMonth.limit })}
          </Text>
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

        {/* Quick reply chips */}
        {!ready && !loading && quickReplies.length > 0 && (
          <QuickReplyChips replies={quickReplies} onSelect={handleChipSelect} />
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
              editable={!loading && !generating}
            />
          </BlurView>
          <TouchableOpacity
            testID="chat-send-btn"
            onPress={handleSend}
            disabled={!inputText.trim() || loading || generating}
            style={[styles.sendBtn, (!inputText.trim() || loading || generating) && styles.sendBtnDisabled]}
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
  quotaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
