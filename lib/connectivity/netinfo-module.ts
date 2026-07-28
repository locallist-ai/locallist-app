/**
 * Carga perezosa y GUARDADA de @react-native-community/netinfo.
 *
 * Mismo patrón que `lib/map/location-module.ts` / `lib/trial-reminder/native-module.ts`:
 * el módulo JS de netinfo resuelve un módulo nativo al evaluarse, así que un
 * import estático mataría la app en el arranque (red screen) sobre cualquier
 * binario SIN el módulo nativo — todos los dev clients previos al rebuild que
 * lo añade. El `require` vive dentro de una función, en try/catch, con el
 * resultado cacheado a nivel de módulo: una sola detección por proceso y TODA
 * la detección de conectividad degrada con elegancia a "asumimos online" (sin
 * suscripción, sin banner offline) cuando no está disponible.
 */
import { logger } from '../logger';

export type NetInfoModule = typeof import('@react-native-community/netinfo').default;

/** undefined = aún no intentado; null = no disponible en este binario. */
let cached: NetInfoModule | null | undefined;

export function getNetInfoModule(): NetInfoModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@react-native-community/netinfo') as {
        default?: NetInfoModule;
      } & NetInfoModule;
      // El paquete expone la API tanto en `default` (import por defecto) como en
      // el propio namespace del CJS; toma el que exista.
      const resolved = (mod.default ?? mod) as NetInfoModule;
      // Probe SYNC barato y fiable bajo new arch: comprobar la FORMA JS del módulo
      // (que `addEventListener` sea una función), NO `NativeModules.RNCNetInfo`
      // (los TurboModules no viven en ese registro, daría un falso negativo). Ojo:
      // esto NO detecta el módulo nativo null de un binario pre-rebuild — ahí la
      // función existe pero LANZA al invocarse; ese caso lo contiene el try/catch
      // del punto de uso en `use-connectivity.ts`. Aquí solo descartamos un módulo
      // JS malformado o ausente antes de considerarlo disponible.
      if (!resolved || typeof resolved.addEventListener !== 'function') {
        throw new Error('netinfo module resolved without a usable addEventListener');
      }
      cached = resolved;
    } catch (err) {
      logger.warn(
        'connectivity: @react-native-community/netinfo native module unavailable (binary predates rebuild?), assuming online',
        err,
      );
      cached = null;
    }
  }
  return cached;
}

export function isConnectivityAvailable(): boolean {
  return getNetInfoModule() !== null;
}

/** Solo para tests: fuerza una nueva detección. */
export function resetNetInfoModuleForTesting(): void {
  cached = undefined;
}
