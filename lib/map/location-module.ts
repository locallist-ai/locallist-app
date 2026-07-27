/**
 * Carga perezosa y GUARDADA de expo-location.
 *
 * Mismo patrón que `lib/trial-reminder/native-module.ts`: el módulo JS de
 * expo-location resuelve un módulo nativo al evaluarse, así que un import
 * estático mataría la app en el arranque sobre cualquier binario SIN el módulo
 * (todos los dev clients previos al rebuild que añade expo-location). El
 * `require` vive dentro de una función, en try/catch, con el resultado cacheado
 * a nivel de módulo: una sola detección por proceso y TODO el uso de ubicación
 * degrada con elegancia (sin punto azul) cuando no está disponible.
 */
import { logger } from '../logger';

export type LocationModule = typeof import('expo-location');

/** undefined = aún no intentado; null = no disponible en este binario. */
let cached: LocationModule | null | undefined;

export function getLocationModule(): LocationModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-location') as LocationModule;
    } catch (err) {
      logger.warn(
        'follow map: expo-location native module unavailable (binary predates rebuild?), user location disabled',
        err,
      );
      cached = null;
    }
  }
  return cached;
}

export function isLocationAvailable(): boolean {
  return getLocationModule() !== null;
}

/** Solo para tests: fuerza una nueva detección. */
export function resetLocationModuleForTesting(): void {
  cached = undefined;
}
