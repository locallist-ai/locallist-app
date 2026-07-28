/**
 * Hook de conectividad en tiempo real. Se suscribe a `NetInfo.addEventListener`
 * y expone `{ isOffline }`. Distinto del badge `follow.offlineCached` (datos
 * cacheados en disco): esto es el estado de red AHORA MISMO.
 *
 * Reglas de decisión (`computeIsOffline`):
 *  - `isConnected === false`          → offline (sin interfaz de red).
 *  - `isInternetReachable === false`  → offline (conectado a una red sin salida).
 *  - null / undefined (desconocido)   → NO offline. netinfo emite `null` mientras
 *    aún no ha podido sondear la salida a internet; tratarlo como offline pintaría
 *    el banner en cada arranque. Ante la duda asumimos online (no bloqueante).
 *
 * Si el módulo nativo no existe (binario pre-rebuild) no hay nada que suscribir:
 * el hook se queda en "online" para siempre y jamás molesta.
 *
 * `onReconnect` se dispara SOLO en la transición offline -> online (no en cada
 * cambio de estado, ni en el primer evento online del arranque): sirve para
 * drenar la cola de mutaciones justo al recuperar la red.
 */
import { useEffect, useRef, useState } from 'react';
import type { NetInfoState } from '@react-native-community/netinfo';
import { logger } from '../logger';
import { getNetInfoModule } from './netinfo-module';

type ConnectivitySnapshot = Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>;

/** Pura y testeable: null/undefined (desconocido) NUNCA es offline. */
export function computeIsOffline(
  state: ConnectivitySnapshot | null | undefined,
): boolean {
  if (!state) return false;
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

export type UseConnectivityOptions = {
  /** Se invoca en cada transición offline -> online. */
  onReconnect?: () => void;
};

export function useConnectivity(options?: UseConnectivityOptions): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);
  // Estado previo para detectar la transición. Arranca en `false` (asumimos
  // online) para que el primer evento online del arranque NO cuente como
  // reconexión y no dispare un flush espurio.
  const wasOfflineRef = useRef(false);
  // Ref al callback más reciente: la suscripción se monta una sola vez y no se
  // re-crea aunque el caller pase un `onReconnect` nuevo en cada render.
  const onReconnectRef = useRef(options?.onReconnect);
  onReconnectRef.current = options?.onReconnect;

  useEffect(() => {
    const netInfo = getNetInfoModule();
    if (!netInfo) return; // sin módulo nativo: online permanente, nada que suscribir.

    // `addEventListener` puede LANZAR aunque el módulo JS resuelva: en un binario
    // pre-rebuild el módulo nativo `RNCNetInfo` es null y esta versión de netinfo
    // no falla en el `require` sino AQUÍ, al suscribirse. Bajo new arch tampoco
    // hay un probe sync fiable (`NativeModules.RNCNetInfo` no aplica a TurboModules),
    // así que contenemos el crash en el punto de uso: si lanza, nos quedamos online
    // permanente (nada suscrito), jamás propagamos el error a Follow Mode.
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = netInfo.addEventListener((state) => {
        const offline = computeIsOffline(state);
        if (wasOfflineRef.current && !offline) {
          onReconnectRef.current?.();
        }
        wasOfflineRef.current = offline;
        setIsOffline(offline);
      });
    } catch (err) {
      logger.warn(
        'connectivity: NetInfo.addEventListener threw (native module unavailable?), assuming online',
        err,
      );
      return; // sin suscripción: online permanente, no bloqueante.
    }

    return () => {
      // El teardown tampoco puede lanzar (módulo nativo roto/ausente).
      try {
        unsubscribe?.();
      } catch (err) {
        logger.warn('connectivity: NetInfo unsubscribe threw, ignoring', err);
      }
    };
  }, []);

  return { isOffline };
}
