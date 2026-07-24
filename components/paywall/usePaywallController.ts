import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../../lib/auth';
import {
  configurePurchases,
  getPlusOfferings,
  purchasePlusPackage,
  restorePlusPurchases,
  checkTrialEligibility,
} from '../../lib/purchases';
import type { PlusEntitlementPeriodType, TrialEligibilityStatus } from '../../lib/purchases';
import { introPriceDurationDays } from '../../lib/trial-timeline';
import { track, type PaywallSource } from '../../lib/analytics';
import { syncTrialReminderAfterPurchase } from '../../lib/trial-reminder';

/**
 * Controlador del paywall: toda la máquina de fases (load / compra / restore /
 * elegibilidad de trial), sus effects (reconciliación, degradación/timeout,
 * dismissed) y los handlers (`onPurchase`/`onRestore`/`onCheckPending`),
 * extraídos de `PaywallView` para que la vista quede como pura presentación.
 *
 * La maquinaria de compra/identidad blindada (`lib/purchases.ts`) NO se toca: se
 * consume tal cual. El gating de elegibilidad (`effectiveEligibility`) se evalúa
 * SÍNCRONO en el render de este hook (que corre dentro del render de la vista),
 * EXACTAMENTE como antes: el reset por `user.id` no vive en ningún effect, así
 * el framing de trial jamás se pinta a un no-elegible ni un frame.
 */

/**
 * Días de trial que el paywall puede PROMETER para un package — o `null` si no
 * debe pintarse framing de trial. Exige TRES cosas, no solo el producto:
 *
 *  1. El producto OFRECE trial: intro price gratuito (`introPrice.price === 0`).
 *  2. El usuario es ELEGIBLE de verdad (`checkTrialEligibility` → 'ELIGIBLE').
 *     Apple no filtra el `introPrice` por historial de canje, así que un
 *     producto con trial se lo muestra también a quien ya lo consumió — pero a
 *     ese Apple le cobra el día 0. Solo 'ELIGIBLE' evita el trial engañoso
 *     (Apple 3.1.2 + legal); 'UNKNOWN'/'INELIGIBLE'/'NO_INTRO_OFFER' → sin
 *     framing (default seguro mientras la consulta no confirme elegibilidad).
 *  3. La duración es DERIVABLE del introPrice (días concretos para la copy).
 *
 * Devuelve los días del trial (N) — la duración se deriva, nunca se hardcodea.
 * Con `null` la fase `ready` muestra precio directo, sin timeline ni "gratis".
 */
export function eligibleTrialDays(
  pkg: PurchasesPackage | null,
  eligibility: Record<string, TrialEligibilityStatus>,
): number | null {
  if (!pkg || pkg.product.introPrice?.price !== 0) return null;
  if (eligibility[pkg.product.identifier] !== 'ELIGIBLE') return null;
  return introPriceDurationDays(pkg.product.introPrice);
}

export type Phase = 'loading' | 'ready' | 'unavailable' | 'success' | 'pending';

/**
 * Timeout (ms) de la fase `loading` SOLO en modo `autoSkipOnUnavailable`
 * (onboarding). `configurePurchases`/`getPlusOfferings` no tienen timeout a nivel
 * app (solo el interno del SDK de RevenueCat); una promesa nativa que jamás
 * settle dejaría al usuario atrapado en el gate BLOQUEANTE del onboarding. Tras
 * este margen se trata como no disponible y se auto-salta. En el paywall
 * standalone NO aplica (spinner hasta que RC responda: quedarse ahí es inofensivo
 * porque el usuario sigue en la app).
 */
const LOADING_AUTOSKIP_TIMEOUT_MS = 9000;

/**
 * Props de precio para los eventos purchase_* — todo derivado del product de
 * StoreKit (precio ya localizado). `hasTrial` = intro price gratuito (el trial
 * de 7 días del plan anual); un intro de pago no es trial. OJO: refleja el
 * PRODUCTO, no la elegibilidad del usuario (Apple puede denegar el trial a
 * quien ya lo consumió) — el cruce real trial→paid vive en los billing_events
 * del backend, no en esta prop.
 */
function purchaseEventProps(pkg: PurchasesPackage) {
  return {
    productId: pkg.product.identifier,
    priceString: pkg.product.priceString,
    price: pkg.product.price,
    currency: pkg.product.currencyCode,
    period: (pkg.packageType === 'ANNUAL' ? 'annual' : 'monthly') as 'annual' | 'monthly',
    hasTrial: pkg.product.introPrice?.price === 0,
  };
}

export interface PaywallControllerParams {
  /** Entrada del funnel (taxonomía de PaywallSource): tag de paywall_viewed. */
  source: PaywallSource;
  /** Cierre/back del paywall SIN outcome de compra. */
  onClose: () => void;
  /** "Ahora no" / saltar (onboarding); también destino del auto-salto por degradación. */
  onSkip?: () => void;
  /** Terminar tras un outcome de compra/restore efectivo. */
  onDone?: () => void;
  /** Degradación limpia (onboarding): auto-salto en vez del estado "no disponible". */
  autoSkipOnUnavailable?: boolean;
}

export interface PaywallController {
  phase: Phase;
  packages: PurchasesPackage[];
  selected: PurchasesPackage | null;
  setSelected: (pkg: PurchasesPackage) => void;
  busy: boolean;
  modal: { title: string; body: string } | null;
  setModal: (modal: { title: string; body: string } | null) => void;
  trialReminderApplies: boolean;
  effectiveEligibility: Record<string, TrialEligibilityStatus>;
  selectedTrialDays: number | null;
  noticeChargeDay: number | null;
  onPurchase: () => Promise<void>;
  onRestore: () => Promise<void>;
  onCheckPending: () => Promise<void>;
  load: () => Promise<void>;
  done: () => void;
  closeAction: () => void;
}

export function usePaywallController({
  source,
  onClose,
  onSkip,
  onDone,
  autoSkipOnUnavailable,
}: PaywallControllerParams): PaywallController {
  const { t } = useTranslation();
  const { user, refreshUser, isPro } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  // Elegibilidad REAL de trial por productId (`checkTrialEligibility`), TAGGEADA
  // con el `user.id` para el que se resolvió. Arranca vacío ⇒ todo se trata como
  // no-elegible (precio directo) hasta que la consulta READ-ONLY confirme
  // 'ELIGIBLE'. El tag es la clave del gating sub-frame: en el render se trata el
  // mapa como VACÍO si `userId` no coincide con el `user.id` actual (ver
  // `effectiveEligibility`), así el commit del cambio de identidad ya rinde
  // precio directo SIN esperar a que `load()`/effects (passive, corren DESPUÉS
  // de ese commit) reseteen — cierra el leak de 1 frame del framing de trial.
  const [trialEligibility, setTrialEligibility] = useState<{
    userId: string | undefined;
    map: Record<string, TrialEligibilityStatus>;
  }>({ userId: undefined, map: {} });
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);
  // True si la compra completada fue el plan anual con trial: las pantallas de
  // éxito/pendiente muestran el contexto del permiso ("te avisaremos antes del
  // cobro") justo cuando aparece el prompt del sistema.
  const [trialReminderApplies, setTrialReminderApplies] = useState(false);

  // paywall_viewed se emite UNA vez por apertura y SOLO cuando las offerings
  // renderizan con precios visibles (denominador de la señal de pricing) — la
  // pantalla de error ya tiene su evento (paywall_unavailable). Si un retry
  // triunfa tras un fallo, el viewed se emite entonces, anclado al éxito.
  const viewTrackedRef = useRef(false);
  // Momento en que los precios se mostraron por primera vez (msOnScreen de
  // paywall_dismissed con phase 'shown' se ancla aquí, no al mount).
  const pricesShownAtRef = useRef<number | null>(null);
  // Una compra/restore con entitlement suprime paywall_dismissed en el cierre.
  const purchaseOutcomeRef = useRef(false);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  // Estado vigente al desmontar (el cleanup del unmount no ve el state actual).
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  // `user.id` vigente, leído en los effects/callbacks async para taggear el mapa
  // de elegibilidad con su dueño real sin arrastrar `user` a las deps del effect
  // `[packages]` (evita re-queries espurias en cambios de user sin nuevas
  // packages). Se actualiza en cada render, así los effects lo leen ya committed.
  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;
  // Guard de montaje (limpiado en el cleanup del effect del dismissed): un
  // load() que resuelve con éxito DESPUÉS del unmount no debe emitir un
  // paywall_viewed fantasma tras el dismissed — esos precios nunca renderizaron.
  const mountedRef = useRef(true);
  // `onSkip` vigente para el auto-salto de degradación, sin re-disparar el
  // effect si la referencia de la prop cambia entre renders.
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;

  const trackViewedOnce = useCallback((offeringId: string | null) => {
    if (!mountedRef.current) return;
    if (pricesShownAtRef.current === null) pricesShownAtRef.current = Date.now();
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    track({ event: 'paywall_viewed', source: sourceRef.current, offeringId });
  }, []);

  const load = useCallback(async () => {
    setPhase('loading');
    const configured = await configurePurchases(user?.id);
    if (!configured) {
      track({ event: 'paywall_unavailable', reason: 'not_configured' });
      setPhase('unavailable');
      return;
    }
    const { packages: pkgs, error } = await getPlusOfferings();
    if (error) {
      track({ event: 'paywall_unavailable', reason: error });
      setPhase('unavailable');
      return;
    }
    trackViewedOnce(pkgs[0]?.presentedOfferingContext?.offeringIdentifier ?? null);
    // Elegibilidad de trial: se limpia AQUÍ, en el MISMO commit que introduce
    // el nuevo array de packages (batching de React), y la re-resuelve el
    // effect [packages]. Sin este reset, un cambio de identidad con el paywall
    // ya montado (u1 ELIGIBLE → u2 INELIGIBLE) conservaría el mapa del usuario
    // anterior durante el primer paint de las nuevas packages y u2 vería el
    // framing de trial stale hasta que la nueva consulta resolviera. Con el
    // reset batched, el default seguro (mapa vacío ⇒ precio directo) rige desde
    // el PRIMER paint de las nuevas packages — nunca un paint intermedio con
    // "N días gratis" para quien no es elegible.
    setTrialEligibility({ userId: user?.id, map: {} });
    setPackages(pkgs);
    // Preselección: anual si existe (mejor precio), si no el primero.
    setSelected(pkgs.find((p) => p.packageType === 'ANNUAL') ?? pkgs[0]);
    setPhase('ready');
  }, [user?.id, trackViewedOnce]);

  useEffect(() => {
    load();
  }, [load]);

  // Degradación limpia (onboarding): en cuanto la fase cae a 'unavailable' y el
  // caller pidió auto-salto, se sale por `onSkip` (equivale a "Ahora no") en vez
  // de dejar al usuario en un estado de paywall roto. Nadie queda atrapado sin
  // RevenueCat. En standalone `autoSkipOnUnavailable` es falso ⇒ se muestra el
  // retry como siempre.
  //
  // Además, timeout del `loading` (SOLO en este modo): si `load()` no resuelve a
  // `ready`/`unavailable` tras `LOADING_AUTOSKIP_TIMEOUT_MS` (una promesa nativa
  // de RC que jamás settle), se trata como no disponible y se auto-salta — nadie
  // queda atrapado en un spinner infinito dentro del gate bloqueante. El timer se
  // limpia en el cleanup (desmontaje) y al cambiar la fase antes de que expire
  // (evita disparar tras un `ready` legítimo o una degradación ya resuelta). El
  // paywall standalone NO tiene timeout: conserva el spinner hasta que RC responda.
  useEffect(() => {
    if (!autoSkipOnUnavailable) return;
    if (phase === 'unavailable') {
      onSkipRef.current?.();
      return;
    }
    if (phase === 'loading') {
      const timer = setTimeout(() => {
        onSkipRef.current?.();
      }, LOADING_AUTOSKIP_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
  }, [autoSkipOnUnavailable, phase]);

  // Elegibilidad REAL del trial. Consulta READ-ONLY al SDK (no toca la cola de
  // identidad ni StoreKit) al tener las packages: solo con status 'ELIGIBLE' el
  // paywall pinta el framing de trial. Se pregunta SOLO por productos con
  // introPrice gratuito (los que ofrecen trial). Mientras resuelve, el mapa
  // vacío mantiene el default seguro (precio directo). Un cambio de identidad
  // vuelve a cargar offerings (nuevo array de packages) y re-dispara esto.
  useEffect(() => {
    // Default seguro AL INICIO de cada ventana (incluida cada recarga por
    // cambio de identidad): mapa vacío ⇒ precio directo. Refuerza el reset
    // batched de load() para que ninguna consulta en vuelo herede la
    // elegibilidad del array de packages anterior — el framing de trial jamás
    // sobrevive a un cambio de packages mientras la nueva consulta resuelve.
    const owner = userIdRef.current;
    setTrialEligibility({ userId: owner, map: {} });
    const trialProductIds = packages
      .filter((p) => p.product.introPrice?.price === 0)
      .map((p) => p.product.identifier);
    if (trialProductIds.length === 0) {
      return;
    }
    let active = true;
    void checkTrialEligibility(trialProductIds).then((map) => {
      // Se taggea con el `user.id` de ESTA ventana; si la identidad ya cambió,
      // `active` es false (cleanup del cambio de packages) y no se aplica.
      if (active) setTrialEligibility({ userId: owner, map });
    });
    return () => {
      active = false;
    };
  }, [packages]);

  // Funnel view→dismiss: al desmontar (X, back, swipe-down del modal) sin
  // outcome de compra se emite paywall_dismissed con la phase vigente. Un
  // dismissed con phase 'loading'/'unavailable' no lleva viewed emparejado:
  // correcto, el usuario nunca vio precios.
  useEffect(() => {
    const mountedAt = Date.now();
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (purchaseOutcomeRef.current) return;
      const dismissPhase =
        phaseRef.current === 'ready'
          ? ('shown' as const)
          : phaseRef.current === 'unavailable'
            ? ('unavailable' as const)
            : ('loading' as const);
      const since =
        dismissPhase === 'shown' && pricesShownAtRef.current !== null
          ? pricesShownAtRef.current
          : mountedAt;
      // NOTA (MINOR-2): `paywall_dismissed` incluye también el tráfico del
      // onboarding (un "Ahora no"/back en el paso 5 emite este evento con
      // `source:'onboarding'`, ADEMÁS del `onboarding_completed{skippedPaywall}`).
      // No es doble-conteo de `onboarding_completed` (una compra suprime el
      // dismissed vía `purchaseOutcomeRef`), pero infla el denominador del paywall
      // standalone. Decisión de producto: se deja así (consistente y filtrable);
      // filtrar por `source` si se quiere el denominador del paywall standalone.
      track({
        event: 'paywall_dismissed',
        source: sourceRef.current,
        phase: dismissPhase,
        msOnScreen: Date.now() - since,
      });
    };
  }, []);

  // Reconciliación en caliente: si el tier flipa a 'pro' mientras esperamos en el
  // estado pending (el listener a nivel de app refrescó /account al llegar el
  // webhook retrasado), avanzamos a éxito sin que el usuario tenga que reintentar.
  useEffect(() => {
    if (phase === 'pending' && isPro) setPhase('success');
  }, [phase, isPro]);

  // Reintento manual desde el estado pending: vuelve a preguntar al backend.
  const onCheckPending = async () => {
    if (busy) return;
    setBusy(true);
    const tier = await refreshUser();
    setBusy(false);
    if (tier === 'pro') setPhase('success');
  };

  const onPurchase = async () => {
    if (!selected || busy || !user?.id) return;
    const props = purchaseEventProps(selected);
    setBusy(true);
    track({ event: 'purchase_started', ...props });
    // user.id como identidad esperada: la lib rechaza la compra si el SDK no
    // está asociado exactamente a este usuario (identity_mismatch).
    const outcome = await purchasePlusPackage(selected, user.id, refreshUser);
    setBusy(false);

    // Promesa "recordatorio el día 5": tras una compra efectiva del plan anual
    // con trial REAL se programa la notificación local (el módulo pide el
    // permiso en este momento, con el contexto en pantalla — nunca en el
    // arranque). El criterio es `entitlementPeriodType === 'TRIAL'` del
    // outcome (elegibilidad del USUARIO), no el introPrice del producto: a
    // quien ya consumió su trial Apple le cobra ya, y avisarle de "tu prueba
    // acaba" sería mentira. Una compra efectiva SIN trial cancela cualquier
    // aviso pendiente obsoleto (cambio de plan durante el trial).
    // Fire-and-forget: nunca lanza y no puede romper el flujo de compra.
    const syncReminder = (
      entitlementPeriodType: PlusEntitlementPeriodType | null,
      outcomeStatus: 'success' | 'pending_backend',
    ) => {
      // Duración del trial DERIVADA de la MISMA fuente que el display del
      // timeline (`introPriceDurationDays` del introPrice del producto): aviso y
      // cobro se mueven con ella, nunca con una constante hardcodeada.
      const derivedTrialDays = introPriceDurationDays(selected.product.introPrice);
      const isRealTrial =
        selected.packageType === 'ANNUAL' && entitlementPeriodType === 'TRIAL';
      // Config degenerada (imposible con ASC normal, por eso no era CRITICAL):
      // entitlement TRIAL pero la duración del introPrice NO es interpretable
      // (`periodUnit`/`periodNumberOfUnits` desconocidos ⇒ null). Fail-safe: no
      // programar un recordatorio con día inventado (el default de negocio de 7d
      // mentiría sobre una duración que no conocemos) NI pintar el aviso con día
      // en blanco. No notificar es mejor que notificar mal.
      const degenerateTrial = isRealTrial && derivedTrialDays === null;
      setTrialReminderApplies(isRealTrial && derivedTrialDays !== null);
      if (degenerateTrial) return;
      void syncTrialReminderAfterPurchase({
        packageType: selected.packageType,
        entitlementPeriodType,
        outcomeStatus,
        purchasedAt: new Date(),
        // `null` aquí solo llega para compras SIN trial real (cancel_stale), donde
        // `trialDays` no se usa: el scheduler nunca programa con el default fantasma.
        trialDays: derivedTrialDays ?? undefined,
      });
    };

    switch (outcome.status) {
      case 'success':
        purchaseOutcomeRef.current = true;
        track({ event: 'purchase_completed', ...props, pendingBackend: false });
        syncReminder(outcome.entitlementPeriodType, outcome.status);
        setPhase('success');
        break;
      case 'pending_backend':
        purchaseOutcomeRef.current = true;
        track({ event: 'purchase_completed', ...props, pendingBackend: true });
        syncReminder(outcome.entitlementPeriodType, outcome.status);
        setPhase('pending');
        break;
      case 'cancelled':
        // Cancelar el sheet de Apple no es un error: sin modal, sin log.
        track({ event: 'purchase_cancelled', ...props });
        break;
      default:
        track({ event: 'purchase_failed', ...props });
        if (outcome.status === 'error' && outcome.message === 'identity_mismatch') {
          // La identidad RC quedó invalidada (divergencia/carrera): un re-load
          // re-configura (logIn fresco) y refetch — re-pulsar comprar vuelve a
          // funcionar en vez de repetir el mismatch hasta salir de la pantalla.
          await load();
          break;
        }
        setModal({ title: t('paywall.errorTitle'), body: t('paywall.errorBody') });
    }
  };

  const onRestore = async () => {
    if (busy || !user?.id) return;
    setBusy(true);
    const outcome = await restorePlusPurchases(user.id, refreshUser);
    setBusy(false);

    switch (outcome.status) {
      case 'success':
        purchaseOutcomeRef.current = true;
        track({ event: 'restore_completed', found: true });
        setPhase('success');
        break;
      case 'pending_backend':
        purchaseOutcomeRef.current = true;
        track({ event: 'restore_completed', found: true });
        setPhase('pending');
        break;
      case 'no_entitlement':
        track({ event: 'restore_completed', found: false });
        setModal({ title: t('paywall.restoreNoneTitle'), body: t('paywall.restoreNoneBody') });
        break;
      default:
        if (outcome.status === 'error' && outcome.message === 'identity_mismatch') {
          // Misma recuperación que en la compra: re-configure + refetch.
          await load();
          break;
        }
        setModal({ title: t('paywall.errorTitle'), body: t('paywall.errorBody') });
    }
  };

  // Elegibilidad EFECTIVA para este render: el mapa se trata como VACÍO si el
  // `user.id` con que se pobló no coincide con el actual. Se resetea en el MISMO
  // render que el cambio de identidad (no en un passive effect posterior), así
  // el commit del cambio de contexto ya rinde precio directo (default seguro) y
  // un no-elegible NUNCA ve el framing de trial del usuario anterior, ni un frame.
  const effectiveEligibility =
    trialEligibility.userId === user?.id ? trialEligibility.map : {};

  // Timeline solo con trial que el usuario PUEDE canjear (producto con trial +
  // status 'ELIGIBLE'); `null` ⇒ precio directo. Los días salen derivados.
  const selectedTrialDays = eligibleTrialDays(selected, effectiveEligibility);

  // Día del primer cobro para el aviso post-compra (éxito/pending): derivado del
  // trial del package elegido (N+1), nunca hardcodeado a "día 8".
  const noticeChargeDay = useMemo(() => {
    const days = selected ? introPriceDurationDays(selected.product.introPrice) : null;
    return days === null ? null : days + 1;
  }, [selected]);

  // Terminar tras compra/restore efectivo: en onboarding completa el flujo; en
  // standalone cae a onClose (cerrar). La X de arriba, en las fases de outcome,
  // hace lo mismo — así un pagador nunca queda varado atrás en vez de completar.
  const done = onDone ?? onClose;
  const isOutcomePhase = phase === 'success' || phase === 'pending';
  const closeAction = isOutcomePhase ? done : onClose;

  return {
    phase,
    packages,
    selected,
    setSelected,
    busy,
    modal,
    setModal,
    trialReminderApplies,
    effectiveEligibility,
    selectedTrialDays,
    noticeChargeDay,
    onPurchase,
    onRestore,
    onCheckPending,
    load,
    done,
    closeAction,
  };
}
