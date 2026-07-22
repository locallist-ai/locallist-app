/**
 * Hook de app (montado una vez en el AppStack autenticado, ver app/_layout):
 *
 *  1. Presentación en foreground: registra el notification handler para que
 *     el recordatorio se muestre como banner si la app está abierta (sin
 *     handler, iOS lo silencia en foreground). Hoy es la única notificación
 *     local de la app; si aparecen más, el handler se centralizará.
 *
 *  2. Tap → evento + deep link: `trial_reminder_shown { day: 5 }` se emite AL
 *     TAP (notification response), no al mostrarse. Decisión documentada: con
 *     la app matada o en background, la entrega de una notificación local NO
 *     es observable client-side (haría falta una Notification Service
 *     Extension, y solo para remotas); el tap es la única señal fiable en
 *     todos los estados del ciclo de vida. `useLastNotificationResponse`
 *     cubre tanto el tap en caliente como el cold start (app lanzada desde la
 *     notificación), con dedupe por identidad de la notificación.
 *     Tras el tap se navega a la pantalla de cuenta (gestión de suscripción).
 *
 *  3. Reconciliación: cuando el tier reconciliado (`isPro`, fuente `/account`)
 *     está/pasa a 'free', delega en `reconcileTrialReminder` la decisión de
 *     cancelar el recordatorio huérfano. Se apoya en los puntos que YA
 *     refrescan el tier (auto-login, foreground, listener de activación) — no
 *     intenta detectar la cancelación del trial en tiempo real.
 *     Nota: el override de tier de DevTools también mueve `isPro`; aceptado
 *     (solo founders, y la ventana de gracia protege la compra recién hecha).
 *
 * Guarda del módulo nativo: la disponibilidad de expo-notifications se decide
 * UNA vez a nivel de módulo (require perezoso y guardado en `native-module`).
 * `useLastNotificationResponse` es un hook y no puede envolverse en try/catch
 * por llamada: sin módulo se monta una alternativa no-op ESTABLE para todo el
 * proceso — la elección nunca cambia entre renders, así que el orden de hooks
 * se mantiene. La reconciliación sigue llamándose (reconcile ya es no-op sin
 * módulo).
 */
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../auth';
import { track } from '../analytics';
import { getNotificationsModule } from './native-module';
import { reconcileTrialReminder, TRIAL_REMINDER_ID } from './index';
import { TRIAL_REMINDER_DAY } from './logic';

/** Decidido una vez por proceso (ver docstring). */
const Notifications = getNotificationsModule();

type LastNotificationResponse = ReturnType<
  NonNullable<typeof Notifications>['useLastNotificationResponse']
>;

/** Alternativa no-op cuando el binario no trae el módulo nativo. */
function useLastNotificationResponseUnavailable(): LastNotificationResponse {
  return undefined;
}

const useLastNotificationResponseSafe =
  Notifications?.useLastNotificationResponse ?? useLastNotificationResponseUnavailable;

/**
 * Dedupe a nivel de módulo (no ref): sobrevive al remontaje del AppStack
 * (logout→login en el mismo proceso), donde `useLastNotificationResponse`
 * re-entregaría la misma response y duplicaría evento y navegación.
 */
let handledResponseKey: string | null = null;

/** Solo para tests: resetea el dedupe del módulo. */
export function resetTrialReminderResponseDedupeForTesting(): void {
  handledResponseKey = null;
}

export function useTrialReminder(): void {
  const { isPro } = useAuth();

  // ── Presentación en foreground ──
  useEffect(() => {
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // En foreground el banner basta; el sonido queda para la entrega en
        // background (content.sound de la notificación programada).
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // ── Tap: evento + deep link a cuenta ──
  const lastResponse = useLastNotificationResponseSafe();

  useEffect(() => {
    if (!lastResponse) return;
    const request = lastResponse.notification.request;
    if (request.identifier !== TRIAL_REMINDER_ID) return;
    const responseKey = `${request.identifier}:${lastResponse.notification.date}`;
    if (handledResponseKey === responseKey) return;
    handledResponseKey = responseKey;

    track({ event: 'trial_reminder_shown', day: TRIAL_REMINDER_DAY });
    router.push('/(tabs)/account');
  }, [lastResponse]);

  // ── Reconciliación por tier ──
  const wasProRef = useRef(false);
  useEffect(() => {
    const wasPro = wasProRef.current;
    if (isPro) {
      wasProRef.current = true;
      return;
    }
    void reconcileTrialReminder({ tier: 'free', wasPro });
  }, [isPro]);
}
