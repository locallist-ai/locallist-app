/**
 * Adquisición de ubicación en tiempo real para Follow Mode, aislada del hook de
 * React para poder unit-testearla sin device (se le inyecta el módulo).
 *
 * Contrato de degradación:
 *  - módulo nulo (binario sin expo-location)  -> 'unavailable', sin watch
 *  - permiso DENEGADO                          -> 'denied', sin watch (nunca se
 *    arranca el watcher ni se vuelve a pedir permiso; el resto del mapa sigue)
 *  - permiso CONCEDIDO                         -> 'granted' + suscripción viva
 *  - Location Services OFF a nivel de SO / cualquier throw de expo-location ->
 *    'unavailable' (el request o el watch RECHAZAN); nunca una promesa rechazada
 *    sin capturar ni un mapa a medias.
 */
import { logger } from '../logger';

export type LocationStatus = 'idle' | 'granted' | 'denied' | 'unavailable';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LocationSubscription {
  remove: () => void;
}

/** Subconjunto de expo-location que consumimos (facilita el mock en tests). */
export interface LocationModuleLike {
  requestForegroundPermissionsAsync: () => Promise<{ granted: boolean; status?: string }>;
  watchPositionAsync: (
    options: unknown,
    callback: (location: { coords: Coordinate }) => void,
  ) => Promise<LocationSubscription>;
  Accuracy?: Record<string, number>;
}

export interface AcquireResult {
  status: LocationStatus;
  subscription: LocationSubscription | null;
}

/**
 * Pide permiso WhenInUse una vez y, SOLO si se concede, arranca el watcher.
 * `onCoordinate` recibe cada actualización de posición.
 */
export async function acquireLocation(
  module: LocationModuleLike | null,
  onCoordinate: (coordinate: Coordinate) => void,
): Promise<AcquireResult> {
  if (!module) return { status: 'unavailable', subscription: null };

  try {
    const permission = await module.requestForegroundPermissionsAsync();
    if (!permission.granted) return { status: 'denied', subscription: null };

    const subscription = await module.watchPositionAsync(
      { accuracy: module.Accuracy?.Balanced ?? 3, distanceInterval: 10 },
      (location) => onCoordinate(location.coords),
    );
    return { status: 'granted', subscription };
  } catch (err) {
    // Location Services desactivado a nivel de SO, o cualquier fallo del módulo:
    // degradar (sin punto azul) en vez de dejar una promesa rechazada colgando.
    logger.warn('follow map: location acquisition failed (services off?), disabling user dot', err);
    return { status: 'unavailable', subscription: null };
  }
}
