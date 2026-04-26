import { useState, useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { api } from '../../lib/api';
import { logger } from '../../lib/logger';
import { setPreviewPlan } from '../../lib/plan-store';
import { hapticImpact, WIZARD_ONLY, LAST_STEP_INDEX, tierFromBudgetAmount } from './constants';
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

  /** Top-level interests (multi). */
  interests: string[];
  /** Sub-categorías por interest top-level: { food: ['sushi','italian'] }. */
  subcategoryPicks: Record<string, string[]>;
  /** Toggle add/remove de un interest top-level. */
  toggleInterest: (id: string) => void;
  /** Setter de subcategorías para un interest concreto. */
  setSubcategoriesFor: (interestId: string, subs: string[]) => void;

  /** Presupuesto USD/día/persona (custom). null = sin valor. */
  budgetAmount: number | null;
  /** Setter del amount. Sincroniza también el tier en selections[4]. */
  setBudgetAmount: (n: number | null) => void;

  /** Sub-tags del company parent activo (ej. ['honeymoon'] cuando couple). */
  companySubs: string[];
  /** Setter de sub-tags para el company activo. */
  setCompanySubs: (subs: string[]) => void;
  /** Sub-tags del style parent activo. */
  styleSubs: string[];
  /** Setter de sub-tags para el style activo. */
  setStyleSubs: (subs: string[]) => void;
  /** Selector del parent en company step (resetea subs si cambia). */
  selectCompany: (id: string) => void;
  /** Selector del parent en style step (resetea subs si cambia). */
  selectStyle: (id: string) => void;
  /** Ciudad seleccionada (step 0). */
  city: string | null;
}

// ── Hook ──

export const useWizard = (): UseWizardResult => {
  const { t } = useTranslation();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  // Slot indices: 0=days, 1=company, 2=style, 3=interests-marker (unused),
  // 4=budget. Slot 3 queda null porque interests usa estado dedicado.
  const [selections, setSelections] = useState<(string | null)[]>([null, null, null, null, null]);
  const [city, setCity] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBubbleText, setShowBubbleText] = useState(false);

  // Interests step state — multi-select + sub-categorías por interest.
  const [interests, setInterests] = useState<string[]>([]);
  const [subcategoryPicks, setSubcategoryPicks] = useState<Record<string, string[]>>({});

  // Budget custom amount (USD/día/persona). El tier derivado se mantiene en
  // selections[4] para no cambiar la firma del payload existente.
  const [budgetAmount, setBudgetAmountState] = useState<number | null>(null);
  const setBudgetAmount = useCallback((n: number | null) => {
    setBudgetAmountState(n);
    setSelections((prev) => {
      const next = [...prev];
      next[4] = n != null && n > 0 ? tierFromBudgetAmount(n) : null;
      return next;
    });
  }, []);

  // Drill-down state para Company y Style. Solo se mantienen los subs del
  // parent ACTIVO; al cambiar parent se resetean (ver handleSelect override).
  const [companySubs, setCompanySubs] = useState<string[]>([]);
  const [styleSubs, setStyleSubs] = useState<string[]>([]);

  // Show bubble text after a delay when reaching the chat step.
  // En WIZARD_ONLY no entramos a step 5, este efecto queda dormido.
  useEffect(() => {
    if (step === 5 && !WIZARD_ONLY) {
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

  // Ref para que advanceToNext pueda llamar al último handleGenerate sin crear
  // dependencias circulares en el useCallback (selections cambia en cada step).
  const generateRef = useRef<() => void>(() => {});

  const advanceToNext = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Light);
    setDirection('forward');
    setStep((s) => {
      // Si ya estamos en el último step interactivo, disparar generate en vez
      // de avanzar a un step inexistente. Diferimos al siguiente tick para que
      // generateRef tenga el handleGenerate con las selections más recientes.
      if (s >= LAST_STEP_INDEX) {
        setTimeout(() => generateRef.current(), 50);
        return s;
      }
      return s + 1;
    });
  }, []);

  const handleBack = useCallback(() => {
    if (step === 0) return;
    hapticImpact(ImpactFeedbackStyle.Light);
    setDirection('back');
    setStep((s) => Math.max(s - 1, 0));
  }, [step]);

  const handleCitySelect = useCallback((cityName: string) => {
    // Pablo 2026-04-26: no auto-advance. Solo guardamos la ciudad; el usuario
    // pulsa Continue/Skip explícitamente para avanzar.
    setCity(cityName);
    hapticImpact(ImpactFeedbackStyle.Light);
  }, []);

  const handleSelect = useCallback((optionId: string) => {
    // Step 4 = interests (multi-select), no usa este path; tiene su propio
    // toggleInterest con botón Continue. Evitamos pisar selections[3].
    if (step === 4) return;
    const prefIdx = step - 1;
    setSelections((prev) => {
      const next = [...prev];
      next[prefIdx] = optionId;
      return next;
    });
    hapticImpact(ImpactFeedbackStyle.Light);
    // Pablo 2026-04-26: no auto-advance. El usuario pulsa Continue/Skip
    // explícitamente. Antes había setTimeout(advanceToNext, 350).
  }, [step]);

  // Selectores de parents con drill-down. RefineableStep llama estos handlers
  // cuando el usuario tap un parent — NO auto-advance aquí, el sheet del
  // RefineableStep maneja el continue. Al cambiar de parent, reseteamos los
  // sub-tags del parent anterior (no tienen sentido fuera de su contexto).
  const selectCompany = useCallback((id: string) => {
    hapticImpact(ImpactFeedbackStyle.Light);
    setSelections((prev) => {
      if (prev[1] !== id) {
        // Parent cambió, reset subs del anterior.
        setCompanySubs([]);
      }
      const next = [...prev];
      next[1] = id;
      return next;
    });
  }, []);

  const selectStyle = useCallback((id: string) => {
    hapticImpact(ImpactFeedbackStyle.Light);
    setSelections((prev) => {
      if (prev[2] !== id) {
        setStyleSubs([]);
      }
      const next = [...prev];
      next[2] = id;
      return next;
    });
  }, []);

  const toggleInterest = useCallback((id: string) => {
    hapticImpact(ImpactFeedbackStyle.Light);
    setInterests((prev) => {
      if (prev.includes(id)) {
        // Al deseleccionar, también limpiamos sus sub-picks.
        setSubcategoryPicks((sp) => {
          const next = { ...sp };
          delete next[id];
          return next;
        });
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const setSubcategoriesFor = useCallback((interestId: string, subs: string[]) => {
    setSubcategoryPicks((prev) => {
      const next = { ...prev };
      if (subs.length === 0) {
        delete next[interestId];
      } else {
        next[interestId] = subs;
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (loading) return;

    // Client-side validation — espejo de ValidateMinimumInput del backend (PR #48 api-net).
    // Evita roundtrip innecesario al backend cuando sabemos que va a devolver 400.
    // Regla: ≥3 de 5 señales wizard {city, days, groupType, style, budget}. El
    // nuevo step "interests" no se cuenta todavía porque el backend no los
    // procesa aún — al activar matching backend, sumarlo al threshold.
    const hasCity = !!city;
    const hasDays = !!selections[0];
    const hasGroupType = !!selections[1];
    const hasPreferences = !!selections[2];
    const hasBudget = !!selections[4];
    const wizardSignals = [hasCity, hasDays, hasGroupType, hasPreferences, hasBudget]
      .filter(Boolean).length;
    if (wizardSignals < 3) {
      hapticImpact(ImpactFeedbackStyle.Heavy);
      setError(t('wizard.errorInsufficientInput'));
      return;
    }

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
    // El chat es opcional. Si usuario no escribió nada, enviamos string vacío; el
    // backend lo acepta (PR #48 Message nullable) y usa solo el wizard para el
    // pipeline. En WIZARD_ONLY siempre va vacío (Pablo 2026-04-25).
    // `categories` = interests top-level (food, outdoors, ...) que el backend
    // mapeará contra Place.Category. `subcategories` = drill-down per category
    // que el backend mapeará contra Place.Subcategory (substring match).
    // `budget` = tier derivado desde budgetAmount (compat con backend actual).
    // `budgetAmount` = USD/día/persona raw para futuro matching más fino.
    // Backend: campos additive (System.Text.Json ignora unknown), añadidos al
    // DTO en este turno; matching se implementa en sesión siguiente.
    const body = {
      message: WIZARD_ONLY ? '' : message.trim(),
      tripContext: {
        city: city ?? undefined,
        groupType: selections[1] ?? 'solo',
        preferences: selections[2] ? [selections[2]] : [],
        vibes: selections[2] ? [selections[2]] : [],
        days: daysFromDuration(selections[0]),
        budget: selections[4] ?? undefined,
        budgetAmount: budgetAmount != null && budgetAmount > 0 ? budgetAmount : undefined,
        categories: interests.length > 0 ? interests : undefined,
        subcategories:
          Object.keys(subcategoryPicks).length > 0 ? subcategoryPicks : undefined,
        // Drill-down tags para company/style. Solo se envían los del parent
        // ACTUALMENTE seleccionado (al cambiar parent, los subs anteriores se
        // limpian — ver selectCompany/selectStyle).
        companyTags: companySubs.length > 0 ? companySubs : undefined,
        styleTags: styleSubs.length > 0 ? styleSubs : undefined,
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
        // 429 = rate limit. Builder limita planes por hora (ver
        // locallist-api-net Program.cs rate limiter). Mensaje específico
        // amigable en vez del genérico.
        if (res.status === 429) {
          setError(t('wizard.errorRateLimit'));
        } else {
          setError(res.error ?? t('wizard.errorDefault'));
        }
      }
    } catch (e) {
      logger.error('[builder/chat] THROW', e);
      setError(t('wizard.errorDefault'));
    } finally {
      setLoading(false);
    }
  }, [loading, message, selections, city, interests, subcategoryPicks, budgetAmount, companySubs, styleSubs, t]);

  // Mantener el ref siempre apuntando al último handleGenerate. advanceToNext
  // lo invoca cuando el usuario completa el último step de prefs y necesitamos
  // disparar la generación sin tener handleGenerate como dependencia (evita
  // re-crear advanceToNext en cada render con selections distinto).
  useEffect(() => {
    generateRef.current = handleGenerate;
  }, [handleGenerate]);

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
    interests,
    subcategoryPicks,
    toggleInterest,
    setSubcategoriesFor,
    budgetAmount,
    setBudgetAmount,
    companySubs,
    setCompanySubs,
    styleSubs,
    setStyleSubs,
    selectCompany,
    selectStyle,
    city,
  };
};
