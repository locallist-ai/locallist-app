/**
 * Reconciliación en caliente del tier tras una compra IAP, a nivel de app.
 *
 * La fuente de verdad del tier es el backend, que lo flipa a 'pro' al recibir el
 * webhook de RevenueCat. Si ese webhook se retrasa (>10s) o falla puntualmente,
 * StoreKit ya cobró pero `isPro` seguiría en false hasta un cold start o un
 * Restore manual. Este hook cierra ese hueco sin depender de que el usuario siga
 * en el paywall:
 *
 *  1. Registra un listener del SDK: cuando el entitlement "plus" pase a activo,
 *     refresca `/account` en caliente (el flip llega sin reiniciar la app).
 *  2. Al volver la app a foreground con sesión activa, reconcilia (configure +
 *     refreshUser) por si el webhook llegó con la app en background.
 *
 * Se monta una sola vez bajo sesión autenticada (ver app/_layout.tsx). Verificar
 * el webhook end-to-end sigue siendo config externa; el cliente reconcilia solo.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from './auth';
import { addPlusActivationListener, configurePurchases } from './purchases';

export function usePurchaseReconciliation() {
  const { user, refreshUser, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

  // Ref para que los listeners usen siempre el refreshUser vigente sin re-suscribir.
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let cleanupListener: (() => void) | undefined;

    (async () => {
      const ok = await configurePurchases(userId);
      if (!ok || cancelled) return;
      cleanupListener = addPlusActivationListener(() => {
        void refreshRef.current();
      });
    })();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      void (async () => {
        const ok = await configurePurchases(userId);
        if (ok) await refreshRef.current();
      })();
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      cancelled = true;
      cleanupListener?.();
      sub.remove();
    };
  }, [isAuthenticated, userId]);
}
