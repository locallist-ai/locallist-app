/**
 * Carga perezosa y GUARDADA de expo-notifications.
 *
 * El módulo JS de expo-notifications llama a `requireNativeModule(...)` al
 * evaluarse: un import estático en la cadena de `app/_layout` / `lib/auth`
 * mataría la app en el arranque (red screen antes del login) sobre cualquier
 * binario SIN el módulo nativo — todos los dev clients previos al rebuild.
 * Por eso el `require` vive dentro de una función, en try/catch, con el
 * resultado cacheado a nivel de módulo: una sola detección por proceso y TODO
 * el API de trial-reminder degrada a no-op cuando no está disponible.
 */
import { logger } from '../logger';

export type NotificationsModule = typeof import('expo-notifications');

/** undefined = aún no intentado; null = no disponible en este binario. */
let cached: NotificationsModule | null | undefined;

export function getNotificationsModule(): NotificationsModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-notifications') as NotificationsModule;
    } catch (err) {
      logger.warn(
        'trial reminder: expo-notifications native module unavailable (binary predates rebuild?), reminders disabled',
        err,
      );
      cached = null;
    }
  }
  return cached;
}

export function isNotificationsAvailable(): boolean {
  return getNotificationsModule() !== null;
}

/** Solo para tests: fuerza una nueva detección. */
export function resetNotificationsModuleForTesting(): void {
  cached = undefined;
}
