import { useState, useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { api } from '../../lib/api';
import { logger } from '../../lib/logger';
import { setPreviewPlan } from '../../lib/plan-store';
import { hapticImpact } from './constants';
import type { BuilderResponse } from '../../lib/types';

// ── Return type ──

export interface UseWizardResult {
  /** Current step index (0 = city, 1-4 = prefs, 5 = chat) */
  step: number;
  /** Slide direction for enter/exit animations */
  direction: 'forward' | 'back';
  /** User's preference selections (indexed 0-3 for steps 1-4) */
  selections: (string | null)[];
  /** Chat message text */
  message: string;
  /** Whether the AI request is in flight */
  loading: boolean;
  /** Error message from the last generate attempt */
  error: string | null;
  /** Whether the AI bubble text should be shown (after typing dots) */
  showBubbleText: boolean;

  /** Navigate back one step (no-op at step 0) */
  handleBack: () => void;
  /** Select a city and auto-advance */
  handleCitySelect: (cityName: string) => void;
  /** Select a preference option and auto-advance */
  handleSelect: (optionId: string) => void;
  /** Skip current preference step */
  advanceToNext: () => void;
  /** Update the chat message */
  setMessage: (text: string) => void;
  /** Submit the wizard and generate a plan */
  handleGenerate: () => void;
}

// ── Hook ──

export const useWizard = (): UseWizardResult => {
  const { t } = useTranslation();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [selections, setSelections] = useState<(string | null)[]>([null, null, null, null]);
  const [city, setCity] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBubbleText, setShowBubbleText] = useState(false);

  // Show bubble text after a delay when reaching the chat step
  useEffect(() => {
    if (step === 5) {
      const timer = setTimeout(() => setShowBubbleText(true), 800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Cleanup advance timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const advanceToNext = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Light);
    setDirection('forward');
    setStep((s) => Math.min(s + 1, 5));
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) return;
    hapticImpact(ImpactFeedbackStyle.Light);
    setDirection('back');
    setStep((s) => Math.max(s - 1, 0));
  }, [step]);

  const handleCitySelect = useCallback((cityName: string) => {
    setCity(cityName);
    advanceToNext();
  }, [advanceToNext]);

  const handleSelect = useCallback((optionId: string) => {
    const prefIdx = step - 1;
    setSelections((prev) => {
      const next = [...prev];
      next[prefIdx] = optionId;
      return next;
    });
    // Clear any pending advance timer before setting a new one
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(advanceToNext, 350);
  }, [step, advanceToNext]);

  const handleGenerate = useCallback(async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    hapticImpact(ImpactFeedbackStyle.Medium);

    // Backend's TripContextDto has `Days: int? [Range(1,7)]`, not `duration`.
    // Duration option ids are stringified integers ("1" | "2" | "3") — parse to int.
    const daysFromDuration = (id: string | null | undefined): number | undefined => {
      if (!id) return undefined;
      const n = parseInt(id, 10);
      return Number.isFinite(n) && n >= 1 && n <= 7 ? n : undefined;
    };

    // El tripContext recoge TODAS las señales capturadas por el wizard para que el
    // backend pueda contar las completadas y rechazar con 400 'insufficient_input'
    // si no llegan al umbral mínimo (ver PR #47 api-net + ValidateMinimumInput).
    // - city (step 0): seleccionado en el chooser de ciudad.
    // - days (step 1): 1/2/3 via daysFromDuration.
    // - groupType (step 2): solo/couple/family-kids/etc.
    // - preferences + vibes (step 3): mismo valor (adventure/relax/cultural).
    // - budget (step 4): budget/moderate/premium.
    const body = {
      message: message.trim() || t('place.defaultMessage'),
      tripContext: {
        city: city ?? undefined,
        groupType: selections[1] ?? 'solo',
        preferences: selections[2] ? [selections[2]] : [],
        vibes: selections[2] ? [selections[2]] : [],
        days: daysFromDuration(selections[0]),
        budget: selections[3] ?? undefined,
      },
    };

    // Dev-only inspection of the builder request/response. `logger.debug` is a
    // no-op in Release (`MIN_LEVEL = 'warn'` when __DEV__ is false), so these
    // calls disappear at runtime in TestFlight / App Store builds without
    // needing `#if DEBUG`-style guards. Passing the objects directly (not
    // JSON.stringify) avoids evaluation cost in prod too.
    logger.debug('[builder/chat] REQUEST', body);

    try {
      const res = await api<BuilderResponse>('/builder/chat', { method: 'POST', body });
      logger.debug('[builder/chat] RESPONSE status', res.status);
      if (res.data) {
        logger.debug('[builder/chat] RESPONSE body', res.data);
        setPreviewPlan(res.data);
        router.push('/plan/preview');
      } else {
        logger.debug('[builder/chat] ERROR body', res.errorBody);
        setError(res.error ?? t('wizard.errorDefault'));
      }
    } catch (e) {
      logger.error('[builder/chat] THROW', e);
      setError(t('wizard.errorDefault'));
    } finally {
      setLoading(false);
    }
  }, [loading, message, selections, city, t]);

  return {
    step,
    direction,
    selections,
    message,
    loading,
    error,
    showBubbleText,
    handleBack,
    handleCitySelect,
    handleSelect,
    advanceToNext,
    setMessage,
    handleGenerate,
  };
};
