import { useState, useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { api, getAccessToken } from '../../lib/api';
import { track } from '../../lib/analytics';
import { logger } from '../../lib/logger';
import { setPreviewPlan } from '../../lib/plan/plan-store';
import { hapticImpact, WIZARD_ONLY, LAST_STEP_INDEX, tierFromBudgetAmount, maxDaysForTier } from './constants';
import { useTripContext, setStartDate as persistStartDate } from '../../lib/trip-context-store';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { mapGateError, parseClampedHint, type AiPlansQuota } from '../../lib/gate-errors';
import type { BuilderResponse } from '../../lib/types';

// ── Return type ──

export interface UseWizardResult {
  /** Current step index (0 = city, 1-4 = prefs, 5 = chat legacy) */
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
  /** Reset wizard to step 0, clearing all selections and errors */
  handleReset: () => void;

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
  /** Setter del amount. Sincroniza también el tier en selections[3]. */
  setBudgetAmount: (n: number | null) => void;

  /** Sub-tags del company parent activo (ej. ['honeymoon'] cuando couple). */
  companySubs: string[];
  /** Setter de sub-tags para el company activo. */
  setCompanySubs: (subs: string[]) => void;
  /** Selector del parent en company step (resetea subs si cambia). */
  selectCompany: (id: string) => void;
  /** Ciudad seleccionada (step 0). */
  city: string | null;

  /** Fecha de inicio del viaje (`yyyy-MM-dd`). Siempre presente (default hoy). */
  startDate: string;
  /** Actualiza y persiste la fecha de inicio del viaje. */
  setStartDate: (iso: string) => void;

  /** Selecciona el nº de días del viaje (step 1). Escribe selections[0]. */
  handleSelectDays: (days: number) => void;
  /** Cuota mensual de planes IA ({used,limit,resetsAt}) o null si el backend no la expone. */
  aiPlansMonth: AiPlansQuota | null;
  /** True para usuarios Plus — habilita hasta 14 días en el picker de duración. */
  isPro: boolean;
}

// ── Hook ──

export const useWizard = (): UseWizardResult => {
  const { t } = useTranslation();
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous double-tap guard, mirror del chat (app/chat/index.tsx). `loading`
  // vive en el closure y llega stale entre dos taps del mismo frame; el await de
  // getAccessToken() abajo garantiza el yield y ensancha la ventana. Este ref se
  // reclama SÍNCRONAMENTE al entrar en handleGenerate, antes de cualquier await,
  // para que dos taps no disparen ambos un POST /builder/chat (quema 2 planes).
  const pendingRef = useRef(false);
  const { city: tripCity, startDate: tripStartDate } = useTripContext();
  const { isPro, aiPlansMonth, refreshAiPlansQuota } = useAuth();
  const { presentGate, presentClamped } = useGateHandler();

  // City is pre-selected via the city-picker home screen; wizard starts at step 1.
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  // Slot indices: 0=days, 1=company, 2=interests-marker (unused), 3=budget.
  const [selections, setSelections] = useState<(string | null)[]>([null, null, null, null]);
  const [city, setCity] = useState<string | null>(tripCity);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBubbleText, setShowBubbleText] = useState(false);

  // Interests step state — multi-select + sub-categorías por interest.
  const [interests, setInterests] = useState<string[]>([]);
  const [subcategoryPicks, setSubcategoryPicks] = useState<Record<string, string[]>>({});

  // Budget custom amount (USD/día/persona). El tier derivado se mantiene en
  // selections[3] para no cambiar la firma del payload existente.
  const [budgetAmount, setBudgetAmountState] = useState<number | null>(null);
  const setBudgetAmount = useCallback((n: number | null) => {
    setBudgetAmountState(n);
    setSelections((prev) => {
      const next = [...prev];
      next[3] = n != null && n > 0 ? tierFromBudgetAmount(n) : null;
      return next;
    });
  }, []);

  // Drill-down state para Company. Solo se mantienen los subs del parent ACTIVO;
  // al cambiar parent se resetean (ver selectCompany).
  const [companySubs, setCompanySubs] = useState<string[]>([]);

  // Sync city from trip context store (in case it loads after hook mounts).
  useEffect(() => {
    if (tripCity && !city) setCity(tripCity);
  }, [tripCity, city]);

  // Show bubble text after a delay when reaching the chat step.
  // En WIZARD_ONLY no entramos a step 4 (chat legacy), este efecto queda dormido.
  useEffect(() => {
    if (step === 4 && !WIZARD_ONLY) {
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

  const handleReset = useCallback(() => {
    setStep(1);
    setDirection('forward');
    setSelections([null, null, null, null]);
    setCity(tripCity);
    setMessage('');
    setError(null);
    setInterests([]);
    setSubcategoryPicks({});
    setBudgetAmountState(null);
    setCompanySubs([]);
  }, [tripCity]);

  const handleBack = useCallback(() => {
    if (step <= 1) {
      // At the first wizard step, go back to city picker instead of stepping back
      router.push('/(tabs)/home');
      return;
    }
    hapticImpact(ImpactFeedbackStyle.Light);
    setDirection('back');
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }, [step]);

  const handleCitySelect = useCallback((cityName: string) => {
    // Pablo 2026-04-26: no auto-advance. Solo guardamos la ciudad; el usuario
    // pulsa Continue/Skip explícitamente para avanzar.
    setCity(cityName);
    hapticImpact(ImpactFeedbackStyle.Light);
  }, []);

  const handleSelect = useCallback((optionId: string) => {
    // Step 3 = interests (multi-select), no usa este path; tiene su propio
    // toggleInterest con botón Continue. Evitamos pisar selections[2].
    if (step === 3) return;
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

  // Duration step (step 1) usa DurationStep con pills numéricos (1..14 según
  // tier), en vez de las 3 cards legacy. Escribimos selections[0] como string
  // del nº de días para conservar el payload existente (daysFromDuration parsea).
  const handleSelectDays = useCallback((days: number) => {
    hapticImpact(ImpactFeedbackStyle.Light);
    setSelections((prev) => {
      const next = [...prev];
      next[0] = String(days);
      return next;
    });
  }, []);

  // Persist the chosen start date to the trip-context store (single source of
  // truth). The hook re-renders via the store subscription, so `tripStartDate`
  // stays current for the payload below.
  const setStartDate = useCallback((iso: string) => {
    hapticImpact(ImpactFeedbackStyle.Light);
    void persistStartDate(iso);
  }, []);

  // Selector de parent con drill-down. RefineableStep llama este handler
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
    if (loading || pendingRef.current) return;

    // Claim the synchronous double-tap guard BEFORE any await (the token read
    // below yields): two taps in the same batch must not both slip through and
    // fire two POST /builder/chat, each burning a free monthly plan.
    pendingRef.current = true;

    // Client-side validation — espejo de ValidateMinimumInput del backend (PR #48 api-net).
    // Evita roundtrip innecesario al backend cuando sabemos que va a devolver 400.
    // Regla: ≥3 de 5 señales wizard {city, days, groupType, budget, interests}.
    const hasCity = !!city;
    const hasDays = !!selections[0];
    const hasGroupType = !!selections[1];
    const hasBudget = !!selections[3];
    const hasInterests = interests.length > 0;
    const wizardSignals = [hasCity, hasDays, hasGroupType, hasBudget, hasInterests]
      .filter(Boolean).length;
    if (wizardSignals < 3) {
      pendingRef.current = false;
      hapticImpact(ImpactFeedbackStyle.Heavy);
      setError(t('wizard.errorInsufficientInput'));
      return;
    }

    // Generation is `[Authorize]` on the backend. Gate on TOKEN PRESENCE, not on
    // the in-memory `user`: a transient `/account` failure at startup leaves
    // `user` null while the token still lives in SecureStore and `api()` keeps
    // sending it (G1). A returning user must never be walled out of generation by
    // that blip. A real guest has no token → prompt signup; an expired token
    // still round-trips and is handled by the 401 fallback below.
    const token = await getAccessToken();
    if (!token) {
      pendingRef.current = false;
      hapticImpact(ImpactFeedbackStyle.Heavy);
      // Signup is a gate, not an error: show ONLY the Alert, never the error
      // overlay with a Retry that would just re-trigger the same wall (g2).
      presentGate({ type: 'signup_required' });
      return;
    }

    setError(null);
    setLoading(true);
    hapticImpact(ImpactFeedbackStyle.Medium);

    // Duration cap mirrors the backend Plus gate: free = 3 days, Plus = 14.
    // Duration ids are stringified integers ("1".."14") — parse and clamp to
    // the tier's max. The picker already gates the UI, this is defence in depth.
    const maxDays = maxDaysForTier(isPro);
    const daysFromDuration = (id: string | null | undefined): number | undefined => {
      if (!id) return undefined;
      const n = parseInt(id, 10);
      return Number.isFinite(n) && n >= 1 && n <= maxDays ? n : undefined;
    };

    // El tripContext recoge TODAS las señales capturadas por el wizard para que el
    // backend pueda contar las completadas y rechazar con 400 'insufficient_input'
    // si no llegan al umbral mínimo (ver PR #47 api-net + ValidateMinimumInput).
    // - city (step 0): seleccionado en el chooser de ciudad.
    // - days (step 1): 1/2/3 via daysFromDuration.
    // - groupType (step 2): solo/couple/family/friends.
    // - categories + subcategories (step 3): interests multi-select con drill-down.
    // - budget (step 4): budget/moderate/premium + amount numérico raw.
    // El chat es opcional. Si usuario no escribió nada, enviamos string vacío; el
    // backend lo acepta (PR #48 Message nullable) y usa solo el wizard para el
    // pipeline. En WIZARD_ONLY siempre va vacío (Pablo 2026-04-25).
    // `budget` = tier derivado desde budgetAmount (compat con backend actual).
    // `budgetAmount` = USD/día/persona raw para futuro matching más fino.
    // Backend: campos additive (System.Text.Json ignora unknown), añadidos al
    // DTO en este turno; matching se implementa en sesión siguiente.
    const body = {
      message: WIZARD_ONLY ? '' : message.trim(),
      tripContext: {
        city: city ?? undefined,
        // La fecha de inicio SIEMPRE se envía (default hoy, editable en el
        // DurationStep) como `yyyy-MM-dd`. El backend genera un plan viable para
        // ese día (no manda a sitios cerrados) vía TripContextDto.StartDate.
        startDate: tripStartDate,
        groupType: selections[1] ?? 'solo',
        days: daysFromDuration(selections[0]),
        budget: selections[3] ?? undefined,
        budgetAmount: budgetAmount != null && budgetAmount > 0 ? budgetAmount : undefined,
        categories: interests.length > 0 ? interests : undefined,
        subcategories:
          Object.keys(subcategoryPicks).length > 0 ? subcategoryPicks : undefined,
        // Drill-down tags para company. Solo se envían los del parent
        // ACTUALMENTE seleccionado (al cambiar parent, los subs anteriores se
        // limpian — ver selectCompany).
        companyTags: companySubs.length > 0 ? companySubs : undefined,
      },
    };

    logger.debug('[builder/chat] REQUEST', body);

    try {
      const res = await api<BuilderResponse>('/builder/chat', { method: 'POST', body });
      logger.debug('[builder/chat] RESPONSE status', res.status);
      if (res.data) {
        logger.debug('[builder/chat] RESPONSE body', res.data);
        track({ event: 'wizard_completed', planId: res.data.plan.id, city: res.data.plan.city, days: res.data.plan.durationDays });
        setPreviewPlan(res.data);
        // A free plan may have its duration clamped to the cap — surface a soft
        // upsell (non-blocking) over the preview. Tolerant hint parse (m3).
        const clamped = parseClampedHint(res.data);
        router.push('/plan/preview');
        if (clamped) presentClamped(clamped.appliedDays ?? res.data.plan.durationDays);
        // A successful generation consumes one of the free monthly plans —
        // refresh the quota so the "X of N" line reflects it (g3).
        void refreshAiPlansQuota();
      } else {
        logger.debug('[builder/chat] ERROR body', res.errorBody);
        // Centralised gate mapping: 401 → signup, 403 structured → upsell,
        // 429 daily_cap → soft throttle (Plus, no upsell), else rate_limit/generic.
        const action = mapGateError(res.status, res.errorBody);
        if (action.type === 'signup_required' || action.type === 'upsell' || action.type === 'soft_throttle') {
          // Gate states (signup / monetization upsell / soft-throttle) surface
          // ONLY their Alert. They must not land in the generic error overlay,
          // whose Retry would just re-fire the same gate (g2).
          presentGate(action);
        } else if (action.type === 'rate_limit') {
          setError(t('wizard.errorRateLimit'));
        } else {
          setError(res.error ?? t('wizard.errorDefault'));
        }
      }
    } catch (e) {
      logger.error('[builder/chat] THROW', e);
      setError(t('wizard.errorDefault'));
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }, [loading, message, selections, city, tripStartDate, interests, subcategoryPicks, budgetAmount, companySubs, t, isPro, presentGate, presentClamped, refreshAiPlansQuota]);

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
    handleReset,
    interests,
    subcategoryPicks,
    toggleInterest,
    setSubcategoriesFor,
    budgetAmount,
    setBudgetAmount,
    companySubs,
    setCompanySubs,
    selectCompany,
    city,
    startDate: tripStartDate,
    setStartDate,
    handleSelectDays,
    aiPlansMonth,
    isPro,
  };
};
