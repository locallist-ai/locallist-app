/**
 * Recordatorio de fin de trial (día 5 de 7) — wiring nativo sobre la lógica
 * pura de `logic.ts`, vía expo-notifications (notificaciones LOCALES; sin
 * push/APNs: el config plugin NO está registrado a propósito, porque añadiría
 * el entitlement `aps-environment` que las locales no necesitan).
 *
 * Puntos de enganche (públicos, sin tocar la cola de identidad de purchases):
 *  - Compra: `scheduleTrialReminderAfterPurchase` desde el outcome del paywall.
 *  - Pérdida de entitlement: `reconcileTrialReminder` desde el hook
 *    `useTrialReminder` observando el tier reconciliado (`isPro`).
 *  - Logout: `cancelTrialReminder` desde `lib/auth`.
 *
 * UX de permisos: el permiso se pide AQUÍ, en el momento de la compra con
 * trial (el paywall muestra a la vez el contexto "te avisaremos antes del
 * cobro") — nunca en el arranque de la app. Denegado ⇒ log, la compra sigue
 * intacta.
 *
 * Contenido: se construye con el idioma vigente EN EL MOMENTO DE LA COMPRA
 * (las notificaciones locales llevan el payload congelado). Si el usuario
 * cambia de idioma durante el trial, el aviso llega en el idioma anterior —
 * aceptado: es el mismo idioma en el que leyó la promesa al comprar.
 */
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import { logger } from '../logger';
import {
  TRIAL_REMINDER_ID,
  ensureReminderScheduled,
  isTrialReminderPurchase,
  shouldCancelReminder,
  type ReminderContent,
  type ReminderScheduler,
  type TrialPurchaseInput,
} from './logic';

export { TRIAL_REMINDER_ID, TRIAL_REMINDER_DAY } from './logic';

// ─── Permiso ─────────────────────────────────────────────

function isGranted(perm: Notifications.NotificationPermissionsStatus): boolean {
  return (
    perm.granted || perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Verifica el permiso y, si aún no se ha preguntado, muestra el prompt del
 * sistema. Nunca lanza: cualquier fallo se trata como denegado (la compra no
 * puede romperse por esto).
 */
async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (isGranted(current)) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return isGranted(requested);
  } catch (err) {
    logger.warn('trial reminder: permission check failed', err);
    return false;
  }
}

// ─── Adapter del scheduler nativo ────────────────────────

/**
 * `purchasedAt` viaja en `content.data` de la propia notificación: es la única
 * persistencia (no hay estado paralelo que pueda desincronizarse) y la lee la
 * reconciliación para distinguir compra reciente de recordatorio huérfano.
 */
const nativeScheduler: ReminderScheduler = {
  async getPending(identifier) {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const request = all.find((r) => r.identifier === identifier);
    if (!request) return null;
    const iso = (request.content.data as { purchasedAt?: unknown } | null)?.purchasedAt;
    const date = typeof iso === 'string' ? new Date(iso) : null;
    return { purchasedAt: date && !Number.isNaN(date.getTime()) ? date : null };
  },
  async schedule({ identifier, content, triggerDate, purchasedAt }) {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: content.title,
        body: content.body,
        sound: 'default',
        data: { purchasedAt: purchasedAt.toISOString() },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  },
  async cancel(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },
};

// ─── Contenido (i18n, congelado al programar) ────────────

function buildReminderContent(firstChargeDate: Date): ReminderContent {
  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-US';
  const date = firstChargeDate.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return {
    title: i18n.t('trialReminder.notificationTitle'),
    body: i18n.t('trialReminder.notificationBody', { date }),
  };
}

// ─── API pública ─────────────────────────────────────────

export type TrialReminderResult = 'scheduled' | 'permission_denied' | 'skipped' | 'error';

/**
 * Punto de enganche del outcome de compra (paywall). Fire-and-forget seguro:
 * nunca lanza — el flujo de compra jamás se rompe por el recordatorio.
 */
export async function scheduleTrialReminderAfterPurchase(
  input: TrialPurchaseInput & { purchasedAt?: Date },
): Promise<TrialReminderResult> {
  if (!isTrialReminderPurchase(input)) return 'skipped';
  try {
    const outcome = await ensureReminderScheduled(
      {
        ensurePermission: ensureNotificationPermission,
        scheduler: nativeScheduler,
        buildContent: buildReminderContent,
      },
      input.purchasedAt ?? new Date(),
    );
    if (outcome === 'permission_denied') {
      // Requisito del brief: registrar el permiso denegado (log, no evento nuevo).
      logger.info('trial reminder: notification permission denied, day-5 reminder not scheduled');
      return 'permission_denied';
    }
    logger.debug('trial reminder: day-5 reminder scheduled');
    return 'scheduled';
  } catch (err) {
    logger.warn('trial reminder: scheduling failed', err);
    return 'error';
  }
}

/**
 * Cancela el recordatorio pendiente (logout, entitlement perdido). Síncrona y
 * nunca lanza — apta para el camino de logout, que no bloquea por nada.
 */
export function cancelTrialReminder(reason: 'logout' | 'entitlement_lost'): void {
  try {
    void Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID)
      .then(() => logger.debug('trial reminder: cancelled', { reason }))
      .catch((err) => logger.warn('trial reminder: cancel failed', err));
  } catch (err) {
    logger.warn('trial reminder: cancel failed', err);
  }
}

/**
 * Reconciliación: dado el tier vigente del backend (y si en esta sesión se le
 * vio como pro), cancela el recordatorio si quedó huérfano. La invoca
 * `useTrialReminder` cuando cambia `isPro` — los mismos puntos que ya
 * reconcilian el tier (mount, foreground, listener de activación). Nunca lanza.
 */
export async function reconcileTrialReminder(state: {
  tier: 'free' | 'pro';
  wasPro: boolean;
}): Promise<void> {
  try {
    // 'pro' nunca cancela: atajo sin tocar el scheduler (caso mayoritario).
    if (state.tier === 'pro') return;
    const pending = await nativeScheduler.getPending(TRIAL_REMINDER_ID);
    if (pending === null) return; // nada programado
    if (shouldCancelReminder({ ...state, pendingPurchasedAt: pending.purchasedAt, now: new Date() })) {
      cancelTrialReminder('entitlement_lost');
    }
  } catch (err) {
    logger.warn('trial reminder: reconcile failed', err);
  }
}
