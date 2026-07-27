/**
 * Lightweight PostHog analytics — uses the REST capture API directly (no native SDK,
 * no rebuild required). All calls are fire-and-forget; errors are silent in prod.
 *
 * Enable by setting EXPO_PUBLIC_POSTHOG_KEY in .env. Without the key, every call
 * is a no-op.
 *
 * Identidad:
 *  - Sin usuario logueado, el `distinct_id` es un UUID anónimo generado una vez
 *    y persistido en el fichero local `analytics_anon_id` (ver `ANON_ID_FILE`) —
 *    cada dispositivo es una persona en PostHog, no un "anonymous" global.
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
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from './logger';
import { getCachedStorefront, type OfferingsError } from './purchases';
import type { MediaKind } from './import/native-picker';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

/**
 * Persistencia del anonId: fichero en el directorio de datos de la app.
 * Semántica elegida A PROPÓSITO: sobrevive a reinicios y updates de la app
 * pero MUERE con la desinstalación. En Keychain (SecureStore) sobreviviría a
 * desinstalar→reinstalar y sería un identificador de dispositivo no reseteable
 * por el usuario (riesgo App Review y contradice el posicionamiento
 * no-tracking). Borrar la app = resetear la identidad anónima.
 */
const ANON_ID_FILE = `${FileSystem.documentDirectory ?? ''}analytics_anon_id`;

let _distinctId: string | null = null;

// ─── Anon distinct_id persistente ────────────────────────

let _anonIdPromise: Promise<string> | null = null;
/**
 * Fallback si el storage falla: id efímero de proceso — los eventos anónimos
 * no se pierden en silencio, solo pierden persistencia entre reinicios.
 */
let _ephemeralAnonId: string | null = null;

/**
 * UUID anónimo del dispositivo: se genera una vez y se persiste. La Promise se
 * memoiza para que llamadas concurrentes en cold start compartan una sola
 * lectura (y una sola generación si no existía). Un RECHAZO no se memoiza: se
 * resetea la Promise (el siguiente track reintenta el storage) y se responde
 * con el id efímero del proceso.
 */
function loadAnonId(): Promise<string> {
  if (!_anonIdPromise) {
    _anonIdPromise = (async () => {
      const info = await FileSystem.getInfoAsync(ANON_ID_FILE);
      if (info.exists) {
        const stored = (await FileSystem.readAsStringAsync(ANON_ID_FILE)).trim();
        if (stored) return stored;
      }
      // Si ya hubo un id efímero en este proceso (storage caído y recuperado),
      // se promociona a persistente: la historia del proceso queda unida.
      const fresh = _ephemeralAnonId ?? Crypto.randomUUID();
      // Persistencia fire-and-forget: si falla, el id vive lo que el proceso.
      FileSystem.writeAsStringAsync(ANON_ID_FILE, fresh).catch((err) =>
        logger.debug('analytics: anonId persist failed', err),
      );
      return fresh;
    })().catch((err) => {
      // Riesgo ACEPTADO: con fichero preexistente + fallo transitorio de la
      // PRIMERA lectura, la sesión puede partirse en dos ids anónimos (efímero
      // ahora, el persistido cuando el storage se recupere). Aceptado porque el
      // fallo transitorio de FS en el sandbox de iOS es rarísimo, ambos ids son
      // anónimos, y preferir el efímero al recuperarse rotaría la identidad
      // persistida del dispositivo (peor).
      logger.debug('analytics: anonId load failed', err);
      _anonIdPromise = null;
      if (!_ephemeralAnonId) _ephemeralAnonId = Crypto.randomUUID();
      return _ephemeralAnonId;
    });
  }
  return _anonIdPromise;
}

/**
 * Fija el usuario de los eventos. En la transición anon→user emite `$identify`
 * (fire-and-forget) para unir la historia anónima con el usuario. Con `null`
 * (logout) vuelve al anonId persistido, sin rotarlo.
 *
 * Nota (aceptado por diseño del spec): dos usuarios secuenciales en el mismo
 * dispositivo comparten anonId. El segundo `$identify` con un
 * `$anon_distinct_id` ya fusionado es un no-op en PostHog (no fusiona
 * identified↔identified), así que no mezcla las personas — solo la historia
 * anónima pre-primer-login queda en la primera cuenta.
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
  | 'settings'
  | 'onboarding';

interface PurchaseProps {
  productId: string;
  priceString: string;
  price: number;
  currency: string;
  period: 'monthly' | 'annual';
  hasTrial: boolean;
}

/**
 * The onboarding screens, in order: the three W2 value screens plus the W5
 * timeline paywall as the final step (value, interests, preview, paywall).
 * City is chosen in the home (builder-first), never in onboarding.
 */
export type OnboardingStepName = 'value' | 'interests' | 'preview' | 'paywall';

/** Where a favorite was toggled from, for funnel attribution (no PII). */
export type FavoriteSource = 'place_detail' | 'card' | 'list';

/** Attribution for an imported video (own content vs a tagged third-party clip). */
export type ImportPlatform = 'self' | 'tiktok' | 'instagram' | 'other';

export type AppEvent =
  // Auth
  | { event: 'sign_up'; provider: 'apple' | 'google' | 'email' }
  | { event: 'sign_in'; provider: 'apple' | 'google' | 'email' }
  // Onboarding / guest mode (first-run funnel)
  | { event: 'guest_mode_entered' }
  | { event: 'onboarding_started' }
  // Each value/interests/preview/paywall screen becoming visible (once per
  // step, deduped by the orchestrator's seenSteps so back-nav never re-emits).
  | { event: 'onboarding_step_viewed'; step: OnboardingStepName }
  // Demanda de una ciudad no cubierta enviada al backend (`POST /cities/request`).
  // Solo en éxito (201/200). SIN PII: nunca se manda el texto de la ciudad (ya
  // vive en BBDD); `source` = superficie desde la que se pidió.
  | { event: 'city_request_submitted'; source: 'onboarding' | 'home' }
  // Flow finished (from the W5 paywall step). `skippedPaywall` is true when the
  // user tapped "not now" or the paywall degraded (auto-skip), false after an
  // effective purchase/restore.
  | { event: 'onboarding_completed'; skippedPaywall: boolean }
  // "Save this plan" hook on the showcase preview: the user tapped the primary
  // save CTA. No ids/PII — just the funnel signal.
  | { event: 'onboarding_save_plan_tapped' }
  // The showcase plan was cloned into the user's own private copy. `viaSignup` =
  // the save required registration first (guest → signup → replay), false when an
  // already-authenticated user saved directly. No ids/PII.
  | { event: 'onboarding_plan_saved'; viaSignup: boolean }
  // Content
  | { event: 'plan_viewed'; planId: string; source?: 'feed' | 'builder' | 'deep_link' }
  | { event: 'place_viewed'; placeId: string; planId?: string }
  // Plan sharing (Social S1). SIN PII/ids: solo el flag del evento (abrir el share
  // sheet nativo / revocar el enlace) para el funnel de sharing.
  | { event: 'plan_share_opened' }
  | { event: 'plan_share_revoked' }
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
  // Opt-in del wizard (flujo primario) al chat IA (secundario), desde el 1er paso.
  | { event: 'wizard_to_chat_optin' }
  | { event: 'chat_city_unsupported'; sessionId: string | null; city: string | null }
  | { event: 'chat_ai_unavailable'; sessionId: string | null }
  // Profile
  | { event: 'profile_saved'; fields: string[] }
  | { event: 'profile_reset' }
  // Favorites — a place saved/unsaved (source = surface it was toggled from).
  | { event: 'favorite_added'; source: FavoriteSource }
  | { event: 'favorite_removed'; source: FavoriteSource }
  // 403 favorites_limit_reached: the free save cap was hit (funnel → upsell).
  | { event: 'favorites_limit_hit' }
  // Monetization (paywall / IAP)
  // SOLO cuando las offerings renderizan con precios visibles (denominador de
  // la señal 1 de pricing ES/US); la pantalla de error emite paywall_unavailable.
  | { event: 'paywall_viewed'; source: PaywallSource; offeringId: string | null }
  // Cierre/back del paywall sin outcome de compra. `phase` = estado al cerrar;
  // con 'shown', msOnScreen cuenta desde que los precios se mostraron (para el
  // resto, desde el mount). Un dismissed con phase 'loading'/'unavailable' no
  // tiene paywall_viewed emparejado — correcto, nunca vio precios.
  | {
      event: 'paywall_dismissed';
      source: PaywallSource;
      msOnScreen: number;
      phase: 'loading' | 'shown' | 'unavailable';
    }
  // `OfferingsError` ya cubre 'not_configured' | 'no_offerings' | 'network', los
  // dos call sites del paywall (configure fallido / getPlusOfferings con error).
  | { event: 'paywall_unavailable'; reason: OfferingsError }
  | ({ event: 'purchase_started' } & PurchaseProps)
  | ({ event: 'purchase_completed'; pendingBackend: boolean } & PurchaseProps)
  | ({ event: 'purchase_cancelled' } & PurchaseProps)
  | ({ event: 'purchase_failed' } & PurchaseProps)
  | { event: 'restore_completed'; found: boolean }
  // Import from video/image (F2 T5). SIN PII: `platform` (atribución) y
  // `mediaKind` (vídeo|imagen) SÍ, el handle NO. Se emite tras elegir el medio
  // (`mediaKind` solo se conoce post-picker).
  | { event: 'import_video_started'; platform: ImportPlatform; mediaKind: MediaKind }
  // Medio subido y analizado: nº total de candidatos y cuántos matchearon.
  | { event: 'import_video_uploaded'; candidates: number; matched: number; platform: ImportPlatform; mediaKind: MediaKind }
  // Plan creado desde el import: nº de sitios seleccionados.
  | { event: 'import_plan_created'; places: number }
  // Gate golpeado en el flujo de import (signup invitado / upsell Plus / límite).
  | { event: 'import_gate_hit'; reason: 'signup' | 'plus' | 'limit' }
  // 403 estructurado de un gate del catálogo Plus (ver trackPlanLimitIfGate403).
  | { event: 'plan_limit_hit'; gate: string }
  // Aviso de fin de trial (día 5 de 7). Se emite AL TAP de la notificación
  // local (lib/trial-reminder/useTrialReminder): la entrega en background no
  // es observable client-side, el tap es la única señal fiable.
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
