import { useState, useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { api } from '../../lib/api';
import { setPreviewPlan } from '../../lib/plan-store';
import { hapticImpact } from './constants';
import type { BuilderResponse } from '../../lib/types';

// ── Return type ──

export interface UseWizardResult {
  /** Whether the wizard overlay is visible */
  showWizard: boolean;
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

  /** Open the wizard from the landing screen */
  openWizard: () => void;
  /** Navigate back one step (or close wizard from step 0) */
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

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [selections, setSelections] = useState<(string | null)[]>([null, null, null, null]);
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

  const openWizard = useCallback(() => {
    setDirection('forward');
    setStep(0);
    setSelections([null, null, null, null]);
    setMessage('');
    setShowBubbleText(false);
    setShowWizard(true);
  }, []);

  const handleBack = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Light);
    if (step === 0) {
      setShowWizard(false);
      return;
    }
    setDirection('back');
    setStep((s) => Math.max(s - 1, 0));
  }, [step]);

  const handleCitySelect = useCallback((_cityName: string) => {
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

    const body = {
      message: message.trim() || t('place.defaultMessage'),
      tripContext: {
        groupType: selections[1] ?? 'solo',
        preferences: selections[2] ? [selections[2]] : [],
        duration: selections[0] ?? undefined,
        budget: selections[3] ?? undefined,
      },
    };

    try {
      const res = await api<BuilderResponse>('/builder/chat', { method: 'POST', body });
      if (res.data) {
        setPreviewPlan(res.data);
        router.push('/plan/preview');
      } else {
        setError(res.error ?? t('wizard.errorDefault'));
      }
    } catch {
      setError(t('wizard.errorDefault'));
    } finally {
      setLoading(false);
    }
  }, [loading, message, selections, t]);

  return {
    showWizard,
    step,
    direction,
    selections,
    message,
    loading,
    error,
    showBubbleText,
    openWizard,
    handleBack,
    handleCitySelect,
    handleSelect,
    advanceToNext,
    setMessage,
    handleGenerate,
  };
};
