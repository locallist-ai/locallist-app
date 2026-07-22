/**
 * Lightweight PostHog analytics — uses the REST capture API directly (no native SDK,
 * no rebuild required). All calls are fire-and-forget; errors are silent in prod.
 *
 * Enable by setting EXPO_PUBLIC_POSTHOG_KEY in .env. Without the key, every call
 * is a no-op.
 *
 * Identidad:
 *  - Sin usuario logueado, el `distinct_id` es un UUID anónimo generado una vez
 *    y persistido (key `analytics.anonId`) — cada dispositivo es una persona en
 *    PostHog, no un "anonymous" global.
 *  - En la transición anon→user se emite `$identify` con `$anon_distinct_id`
 *    para unir la historia anónima con la del usuario.
 *  - En logout NO se rota el anonId: mismo dispositivo ≈ misma persona.
 *
 * Enriquecimiento global (todos los eventos):
 *  - `country`: región del locale del dispositivo (expo-localization).
 *  - `storefront`: país del storefront de Apple (caché en lib/purchases tras
 *    configure). Ambas se omiten del payload cuando no hay valor.
 */
import { getLocales } from 'expo-localization';
import * as Crypto from 'expo-crypto';
import * as SafeStore from './safe-store';
import { logger } from './logger';
import { getCachedStorefront, type OfferingsError } from './purchases';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

const ANON_ID_KEY = 'analytics.anonId';

let _distinctId: string | null = null;

// ─── Anon distinct_id persistente ────────────────────────

let _anonIdPromise: Promise<string> | null = null;

/**
 * UUID anónimo del dispositivo: se genera una vez y se persiste. La Promise se
 * memoiza para que llamadas concurrentes en cold start compartan una sola
 * lectura (y una sola generación si no existía).
 */
function loadAnonId(): Promise<string> {
  if (!_anonIdPromise) {
    _anonIdPromise = (async () => {
      const stored = await SafeStore.getItemAsync(ANON_ID_KEY);
      if (stored) return stored;
      const fresh = Crypto.randomUUID();
      // Persistencia fire-and-forget: si falla, el id vive lo que el proceso.
      SafeStore.setItemAsync(ANON_ID_KEY, fresh).catch((err) =>
        logger.debug('analytics: anonId persist failed', err),
      );
      return fresh;
    })();
  }
  return _anonIdPromise;
}

/**
 * Fija el usuario de los eventos. En la transición anon→user emite `$identify`
 * (fire-and-forget) para unir la historia anónima con el usuario. Con `null`
 * (logout) vuelve al anonId persistido, sin rotarlo.
 */
export function setAnalyticsUserId(id: string | null) {
  const wasAnonymous = _distinctId === null;
  _distinctId = id;
  if (!POSTHOG_KEY || !id || !wasAnonymous) return;
  loadAnonId()
    .then((anonId) => capture('$identify', id, { $anon_distinct_id: anonId }))
    .catch((err) => logger.debug('analytics: identify failed', err));
}

// ─── Enriquecimiento global ──────────────────────────────

/** `undefined` = aún no resuelto; `null` = resuelto sin valor. */
let _country: string | null | undefined;

function getCountry(): string | null {
  if (_country === undefined) {
    try {
      _country = getLocales()[0]?.regionCode ?? null;
    } catch {
      _country = null;
    }
  }
  return _country;
}

// ─── Eventos ─────────────────────────────────────────────

/**
 * Entradas al paywall. Hoy solo existe `account_upsell`; el resto llegan con
 * los gates del catálogo Plus (plan_limit_hit → upsell contextual).
 */
export type PaywallSource =
  | 'account_upsell'
  | 'plan_limit'
  | 'day_limit'
  | 'multi_city'
  | 'offline_follow'
  | 'favorites_limit'
  | 'video_import'
  | 'settings';

interface PurchaseProps {
  productId: string;
  priceString: string;
  price: number;
  currency: string;
  period: 'monthly' | 'annual';
  hasTrial: boolean;
}

export type AppEvent =
  // Auth
  | { event: 'sign_up'; provider: 'apple' | 'google' | 'email' }
  | { event: 'sign_in'; provider: 'apple' | 'google' | 'email' }
  // Content
  | { event: 'plan_viewed'; planId: string; source?: 'feed' | 'builder' | 'deep_link' }
  | { event: 'place_viewed'; placeId: string; planId?: string }
  // Builder
  | { event: 'wizard_started'; city?: string }
  | { event: 'wizard_completed'; planId: string; city: string; days: number }
  // Follow Mode
  | { event: 'follow_started'; planId: string }
  | { event: 'follow_completed'; planId: string; stopsCompleted: number }
  // Chat builder
  | { event: 'chat_started'; sessionId: string | null }
  | { event: 'chat_turn'; sessionId: string; turnCount: number; slotsFilled: number; totalSlots: number }
  | { event: 'chat_ready'; sessionId: string; turnCount: number }
  | { event: 'chat_generated'; sessionId: string; planId: string; turnCount: number }
  | { event: 'chat_abandoned'; sessionId: string; turnCount: number }
  | { event: 'chat_to_wizard_escape'; sessionId: string | null; turnCount: number }
  | { event: 'chat_city_unsupported'; sessionId: string | null; city: string | null }
  | { event: 'chat_ai_unavailable'; sessionId: string | null }
  // Profile
  | { event: 'profile_saved'; fields: string[] }
  | { event: 'profile_reset' }
  // Monetization (paywall / IAP)
  | { event: 'paywall_viewed'; source: PaywallSource; offeringId: string | null }
  // Cierre/back del paywall sin outcome de compra (completa el funnel view→dismiss).
  | { event: 'paywall_dismissed'; source: PaywallSource; msOnScreen: number }
  // `OfferingsError` ya cubre 'not_configured' | 'no_offerings' | 'network', los
  // dos call sites del paywall (configure fallido / getPlusOfferings con error).
  | { event: 'paywall_unavailable'; reason: OfferingsError }
  | ({ event: 'purchase_started' } & PurchaseProps)
  | ({ event: 'purchase_completed'; pendingBackend: boolean } & PurchaseProps)
  | ({ event: 'purchase_cancelled' } & PurchaseProps)
  | ({ event: 'purchase_failed' } & PurchaseProps)
  | { event: 'restore_completed'; found: boolean }
  // 403 estructurado de un gate del catálogo Plus (ver trackPlanLimitIfGate403).
  | { event: 'plan_limit_hit'; gate: string }
  // Aviso de fin de trial (día 5 de 7). Sin call site aún: lo emitirá la
  // feature de trial reminder (Fase 3, task 5). Tipado ya para cerrar taxonomía.
  | { event: 'trial_reminder_shown'; day: number };

/** @deprecated Use AppEvent */
export type ChatEvent = AppEvent;

// ─── Capture ─────────────────────────────────────────────

/**
 * Envío real a PostHog con el enriquecimiento global (`country`, `storefront`).
 * Las props globales se OMITEN cuando no hay valor — nunca `undefined`/`null`
 * serializado.
 */
function capture(event: string, distinctId: string, properties: Record<string, unknown>): void {
  const country = getCountry();
  const storefront = getCachedStorefront();
  const body = JSON.stringify({
    api_key: POSTHOG_KEY,
    event,
    distinct_id: distinctId,
    properties: {
      ...properties,
      ...(country !== null ? { country } : {}),
      ...(storefront !== null ? { storefront } : {}),
      $lib: 'locallist-app',
    },
  });
  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch((err) => logger.debug('analytics: capture failed', err));
}

export function track(payload: AppEvent): void {
  if (!POSTHOG_KEY) return;
  const { event, ...properties } = payload;
  if (_distinctId) {
    capture(event, _distinctId, properties);
    return;
  }
  // Sin usuario: espera el anonId persistido (fire-and-forget, como el envío).
  loadAnonId()
    .then((anonId) => capture(event, _distinctId ?? anonId, properties))
    .catch((err) => logger.debug('analytics: capture failed', err));
}

// ─── Gates Plus (403 estructurado del backend) ───────────

/**
 * Wiring del funnel de upsell: el backend (locallist-api-net, guard RequirePro +
 * PlanGenerationGateService) responde a los gates del catálogo Plus con un 403
 * estructurado `{ error: '<código>', ... }`. Códigos actuales: 'pro_required',
 * 'plan_limit_reached', 'duration_requires_plus', 'multicity_requires_plus',
 * 'saved_plans_limit_reached' (familia `*_requires_plus` / `*_limit_reached`).
 * El cap diario de Plus es 429 `daily_cap_reached` y queda fuera a propósito:
 * throttling, no carencia de entitlement (la app no pinta upsell a un Plus).
 *
 * Llamado desde lib/api en toda respuesta no-ok; emite `plan_limit_hit` solo
 * para 403 con código de gate reconocible.
 */
export function trackPlanLimitIfGate403(status: number, errorBody: unknown): void {
  if (status !== 403) return;
  const code = (errorBody as { error?: unknown } | null)?.error;
  if (typeof code !== 'string') return;
  const isGate =
    code === 'pro_required' || code.endsWith('_requires_plus') || code.endsWith('_limit_reached');
  if (!isGate) return;
  track({ event: 'plan_limit_hit', gate: code });
}

export function countFilledSlots(slots: {
  city: unknown; days: unknown; groupType: unknown;
  categories: unknown; budget: unknown; pace: unknown;
  dietary: unknown; exclusions: unknown; vibesPrimary: unknown;
}): number {
  return Object.values(slots).filter((v) => {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
}
