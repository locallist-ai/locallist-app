/**
 * Lógica pura del recordatorio de fin de trial (día 5 de 7) — sin imports
 * nativos, inyectable y testeable con mocks de fecha/scheduler.
 *
 * La promesa publicada en el paywall y la landing es "7 días gratis,
 * recordatorio el día 5, cobro el día 8 — nunca antes". Este módulo decide
 * CUÁNDO programar, A QUÉ HORA dispara y CUÁNDO cancelar; el wiring nativo
 * (expo-notifications, i18n, analytics) vive en `index.ts`.
 *
 * Sesgo de diseño ante ambigüedad: NUNCA romper la promesa. Un recordatorio
 * de más (usuario que ya canceló lo recibe igualmente) es un roce menor; un
 * recordatorio de menos convierte la promesa del paywall en mentira. Por eso
 * la cancelación por pérdida de entitlement exige señal clara (transición
 * pro→free observada, o tier free con la compra ya fuera de la ventana de
 * gracia del webhook).
 */
import { trialTimelineFromDays } from '../trial-timeline';

/** Identificador único de la notificación — la re-programación reemplaza, nunca duplica. */
export const TRIAL_REMINDER_ID = 'trial-reminder-day5';

/** Día del trial en que avisamos (de 7). Va como prop del evento `trial_reminder_shown`. */
export const TRIAL_REMINDER_DAY = 5;

/**
 * Duración del trial en días. DECISIÓN DE NEGOCIO: 7 días (recordatorio día 5,
 * cobro día 8). Se usa SOLO como default de fallback: cuando el paywall conoce
 * la duración real del producto (derivada del introPrice de StoreKit) la pasa
 * explícitamente a las funciones de programación, y aviso + cobro se derivan de
 * ESA misma duración (la misma fuente que el display del timeline). Así, si App
 * Store Connect cambiara la duración del trial, notificación y display se mueven
 * juntos en vez de desincronizarse.
 */
export const TRIAL_DAYS = 7;

/** Hora local (0–23) a la que dispara el recordatorio. */
export const REMINDER_HOUR_LOCAL = 10;

/**
 * Ventana de gracia para el estado `pending_backend`: recién comprado, el tier
 * del backend sigue en 'free' hasta que llega el webhook de RevenueCat
 * (típicamente segundos/minutos). Mientras la compra sea más reciente que esta
 * ventana, un tier 'free' NO es señal de trial cancelado y el recordatorio se
 * conserva. 24h absorbe cualquier retraso realista del webhook y sigue muy por
 * debajo del día 5.
 */
export const FREE_TIER_GRACE_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Puertos (inyectables) ───────────────────────────────

export interface ReminderContent {
  title: string;
  body: string;
}

export interface ScheduleReminderRequest {
  identifier: string;
  content: ReminderContent;
  /** Instante exacto de disparo (día 5 a las 10:00 locales). */
  triggerDate: Date;
  /** Momento de la compra — persiste con la notificación para la reconciliación. */
  purchasedAt: Date;
}

/** Notificación pendiente. `purchasedAt` null = payload ilegible (fecha perdida). */
export interface PendingReminder {
  purchasedAt: Date | null;
}

/** Puerto del scheduler nativo (expo-notifications en producción, mock en tests). */
export interface ReminderScheduler {
  /** Notificación pendiente con ese id, o null si no hay ninguna. */
  getPending(identifier: string): Promise<PendingReminder | null>;
  schedule(request: ScheduleReminderRequest): Promise<void>;
  cancel(identifier: string): Promise<void>;
}

// ─── Programación ────────────────────────────────────────

export interface TrialPurchaseInput {
  /** `packageType` de RevenueCat ('ANNUAL' | 'MONTHLY' | ...). */
  packageType: string;
  /**
   * `periodType` REAL del entitlement "plus" del customerInfo de la compra
   * ('TRIAL' | 'INTRO' | 'NORMAL' | 'PREPAID' | null). OJO: no confundir con
   * el `introPrice` del producto — ese dice que el plan OFRECE trial; a un
   * usuario que ya consumió el suyo Apple le cobra YA y el entitlement llega
   * como 'NORMAL'. Programarle un aviso de "tu trial acaba" sería mentirle.
   */
  entitlementPeriodType: string | null;
  /** Outcome de `purchasePlusPackage`. */
  outcomeStatus: string;
}

export type PurchaseReminderAction = 'schedule' | 'cancel_stale' | 'none';

/**
 * Decide qué hacer con el recordatorio tras un outcome de compra:
 *  - 'schedule': plan ANUAL con el entitlement en periodo 'TRIAL' real y
 *    compra efectiva ('success' | 'pending_backend') — hay trial que recordar.
 *  - 'cancel_stale': compra efectiva SIN trial real (mensual, o anual con el
 *    trial ya consumido). Además de no programar, CANCELA cualquier pendiente:
 *    un cambio de plan durante el trial dejaría un aviso obsoleto ("tu prueba
 *    acaba en 2 días") sobre una suscripción ya cobrada.
 *  - 'none': compra no efectiva (cancelled / no_entitlement / error) — no se
 *    cobró nada nuevo, el estado del recordatorio no cambia.
 */
export function decideReminderActionForPurchase(input: TrialPurchaseInput): PurchaseReminderAction {
  const effective = input.outcomeStatus === 'success' || input.outcomeStatus === 'pending_backend';
  if (!effective) return 'none';
  return input.packageType === 'ANNUAL' && input.entitlementPeriodType === 'TRIAL'
    ? 'schedule'
    : 'cancel_stale';
}

/**
 * Disparo: día del recordatorio del trial (duración-2, mínimo 1), normalizado a
 * las 10:00 locales del dispositivo (hora razonable — ni madrugada ni
 * compitiendo con la cena). El offset se deriva de `trialTimelineFromDays` — la
 * MISMA fuente que el display del timeline del paywall — para que aviso y copy
 * nunca discrepen. Con la duración real de 7 días: +5d (día 5). `trialDays`
 * default = `TRIAL_DAYS` (7) cuando el caller no conoce la duración del producto.
 */
export function computeReminderTriggerDate(purchasedAt: Date, trialDays: number = TRIAL_DAYS): Date {
  const { reminderDay } = trialTimelineFromDays(trialDays);
  const trigger = new Date(purchasedAt.getTime() + reminderDay * DAY_MS);
  trigger.setHours(REMINDER_HOUR_LOCAL, 0, 0, 0);
  return trigger;
}

/**
 * Fecha del primer cobro: fin del trial (compra + `trialDays` días — con la
 * duración real de 7 días cae en el "día 8", nunca antes). Va en el cuerpo del
 * aviso. Deriva de la MISMA `trialDays` que el recordatorio y el display.
 */
export function computeFirstChargeDate(purchasedAt: Date, trialDays: number = TRIAL_DAYS): Date {
  return new Date(purchasedAt.getTime() + trialDays * DAY_MS);
}

export type ScheduleOutcome = 'scheduled' | 'permission_denied';

export interface ScheduleDeps {
  /** Pide/verifica el permiso de notificaciones. Nunca lanza; false = denegado. */
  ensurePermission(): Promise<boolean>;
  scheduler: ReminderScheduler;
  /** Construye título/cuerpo (i18n) a partir de la fecha del primer cobro. */
  buildContent(firstChargeDate: Date): ReminderContent;
}

/**
 * Programa el recordatorio del día 5. Idempotente: si ya hay una notificación
 * pendiente con `TRIAL_REMINDER_ID` se cancela antes de re-programar — nunca
 * hay dos. Permiso denegado NO es error (la compra ya se completó y no se
 * bloquea): se devuelve `permission_denied` y el caller lo registra en log.
 */
export async function ensureReminderScheduled(
  deps: ScheduleDeps,
  purchasedAt: Date,
  trialDays: number = TRIAL_DAYS,
): Promise<ScheduleOutcome> {
  const granted = await deps.ensurePermission();
  if (!granted) return 'permission_denied';

  const pending = await deps.scheduler.getPending(TRIAL_REMINDER_ID);
  if (pending !== null) await deps.scheduler.cancel(TRIAL_REMINDER_ID);

  await deps.scheduler.schedule({
    identifier: TRIAL_REMINDER_ID,
    content: deps.buildContent(computeFirstChargeDate(purchasedAt, trialDays)),
    triggerDate: computeReminderTriggerDate(purchasedAt, trialDays),
    purchasedAt,
  });
  return 'scheduled';
}

// ─── Cancelación / reconciliación ────────────────────────

export interface ReminderTierState {
  /** Tier vigente del backend (fuente de verdad del gating). */
  tier: 'free' | 'pro';
  /**
   * True si EN ESTA SESIÓN se observó al usuario como pro antes de este estado
   * (transición pro→free = entitlement perdido, señal inequívoca de cancelar).
   */
  wasPro: boolean;
  /** `purchasedAt` de la notificación pendiente; null = fecha ilegible en el payload. */
  pendingPurchasedAt: Date | null;
  now: Date;
}

/**
 * Decide si el recordatorio pendiente sigue vivo dado el tier del backend.
 * La cancelación del trial NO es detectable client-side en tiempo real (brief):
 * se usa la señal que ya existe — el tier reconciliado vía `/account`.
 *
 *  - tier 'pro' → keep (trial o suscripción activos; el caso normal).
 *  - pro→free observado → cancel (entitlement perdido: canceló y expiró, refund…).
 *  - tier 'free' sin transición observada → solo se cancela si la compra quedó
 *    fuera de la ventana de gracia del webhook. Dentro de la ventana (o con
 *    fecha ilegible) se CONSERVA: cancelar de más rompe la promesa del día 5.
 */
export function shouldCancelReminder(state: ReminderTierState): boolean {
  if (state.tier === 'pro') return false;
  if (state.wasPro) return true;
  if (state.pendingPurchasedAt === null) return false;
  return state.now.getTime() - state.pendingPurchasedAt.getTime() > FREE_TIER_GRACE_MS;
}
