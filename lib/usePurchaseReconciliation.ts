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
 *     refreshUser) por si el webhook llegó con la app en background — y si el
 *     configure del montaje había fallado (blip transitorio), re-adjunta el
 *     listener aquí: sin esto un único fallo al montar dejaba la sesión entera
 *     sin reconciliación en caliente.
 *
 * El handler de foreground lleva guarda de sesión: puede quedar capturado con
 * un userId ya deslogueado (el evento llega entre el logout y el cleanup del
 * efecto), y sin la guarda re-configuraría el SDK con la identidad recién
 * desvinculada. Se lee la sesión viva por ref y se ignoran handlers obsoletos.
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

  // Refs para que los listeners usen siempre el estado vigente sin re-suscribir.
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;
  const sessionRef = useRef({ userId, isAuthenticated });
  sessionRef.current = { userId, isAuthenticated };

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let cancelled = false;
    let cleanupListener: (() => void) | undefined;

    // Configura el SDK y adjunta el listener de reconciliación si aún no está.
    // Se invoca al montar y en cada vuelta a foreground: un configure fallido
    // al montar (blip de red / carrera de logIn) se re-intenta y el listener
    // se re-adjunta en cuanto un configure confirme la identidad.
    const ensureConfiguredWithListener = async () => {
      const ok = await configurePurchases(userId);
      if (!ok || cancelled || cleanupListener) return;
      cleanupListener = addPlusActivationListener(() => {
        void refreshRef.current();
      });
    };

    void ensureConfiguredWithListener();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      // Guarda de sesión: un handler obsoleto (logout ya efectivo, o sesión de
      // otro usuario) no debe re-adoptar la identidad RC desvinculada.
      const session = sessionRef.current;
      if (!session.isAuthenticated || session.userId !== userId) return;
      void (async () => {
        // Re-asociación (y re-attach del listener si faltaba); el refresh de
        // /account no depende de la identidad RC (el flip por webhook debe
        // reconciliarse aunque el SDK esté inaccesible o el logIn haya fallado).
        await ensureConfiguredWithListener();
        if (cancelled) return;
        await refreshRef.current();
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
