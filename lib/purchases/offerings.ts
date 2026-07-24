/**
 * RevenueCat — offerings, elegibilidad de trial y compra/restore.
 *
 * Consume el núcleo de identidad de `./config` (estado como bindings vivos de
 * solo lectura + primitivas de cola/época): NUNCA reasigna estado del núcleo,
 * solo lo LEE y encola operaciones a través de sus primitivas. La maquinaria de
 * identidad blindada (cola, época, guarda TOCTOU) vive en `./config` y aquí se
 * usa tal cual — la invariante "nunca vender bajo un appUserID ajeno" se impone
 * en el punto de venta con esas mismas primitivas.
 */
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  type CustomerInfo,
  type IntroEligibility,
  type PurchasesPackage,
} from 'react-native-purchases';
import { logger } from '../logger';
import {
  configured,
  currentAppUserID,
  identityEpoch,
  pendingIdentityOps,
  confirmSessionIdentity,
  enqueueIdentityOp,
  identityQueueDrained,
} from './config';

/** Entitlement configurado en el dashboard de RevenueCat. */
export const PLUS_ENTITLEMENT_ID = 'plus';

/** Poll de `GET /account` tras compra: 5 intentos x 2s = techo de ~10s. */
const TIER_POLL_ATTEMPTS = 5;
const TIER_POLL_DELAY_MS = 2000;

// ─── Offerings ───────────────────────────────────────────

export type OfferingsError = 'not_configured' | 'no_offerings' | 'network';

export interface OfferingsResult {
  packages: PurchasesPackage[];
  error: OfferingsError | null;
}

/**
 * Packages del offering actual (precios ya localizados por StoreKit).
 * Error-as-value, mismo espíritu que lib/api.
 */
export async function getPlusOfferings(): Promise<OfferingsResult> {
  if (!configured) return { packages: [], error: 'not_configured' };

  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    if (packages.length === 0) {
      // Productos aún no creados/aprobados en App Store Connect, u offering vacío.
      logger.warn('RevenueCat: current offering has no packages');
      return { packages: [], error: 'no_offerings' };
    }
    return { packages, error: null };
  } catch (err) {
    logger.warn('RevenueCat: getOfferings failed', err);
    return { packages: [], error: 'network' };
  }
}

// ─── Elegibilidad de trial (READ-ONLY) ──────────────────
//
// Apple/RevenueCat NO filtran el `introPrice` del producto por el historial de
// canje del usuario: un producto que OFRECE trial expone `introPrice` a todos,
// incluso a quien ya lo consumió (a ese Apple le cobra el día 0). Para no
// prometer un trial que no aplica, el paywall consulta la elegibilidad REAL con
// esta llamada. Es una query pura del SDK: NO toca la cola de identidad, ni la
// época, ni StoreKit — no muta nada, así que vive fuera de la maquinaria de
// compra/identidad blindada.

/**
 * Estado de elegibilidad de trial normalizado a un union estable (el SDK usa un
 * enum numérico). `ELIGIBLE` es el ÚNICO estado que permite pintar el framing
 * de trial; `UNKNOWN`/`INELIGIBLE`/`NO_INTRO_OFFER` → precio directo.
 */
export type TrialEligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN' | 'NO_INTRO_OFFER';

function mapEligibilityStatus(status: INTRO_ELIGIBILITY_STATUS | undefined): TrialEligibilityStatus {
  switch (status) {
    case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE:
      return 'ELIGIBLE';
    case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE:
      return 'INELIGIBLE';
    case INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS:
      return 'NO_INTRO_OFFER';
    // INTRO_ELIGIBILITY_STATUS_UNKNOWN y cualquier valor inesperado → UNKNOWN.
    default:
      return 'UNKNOWN';
  }
}

/**
 * Elegibilidad de trial por productId. Guía literal del SDK: si no está
 * configurado, la lista está vacía o la consulta falla, se devuelve `UNKNOWN`
 * para todos — nunca se asume elegibilidad. El caller (paywall) trata cualquier
 * cosa que no sea `ELIGIBLE` como "sin trial" y muestra el precio directo, así
 * que el fallo degrada al lado seguro (jamás un trial engañoso). READ-ONLY.
 */
export async function checkTrialEligibility(
  productIds: string[],
): Promise<Record<string, TrialEligibilityStatus>> {
  const unknownAll = (): Record<string, TrialEligibilityStatus> =>
    Object.fromEntries(productIds.map((id) => [id, 'UNKNOWN' as const]));

  if (!configured || productIds.length === 0) return unknownAll();

  try {
    const raw = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
    const out: Record<string, TrialEligibilityStatus> = {};
    for (const id of productIds) {
      out[id] = mapEligibilityStatus((raw as Record<string, IntroEligibility>)[id]?.status);
    }
    return out;
  } catch (err) {
    logger.warn('RevenueCat: checkTrialOrIntroductoryPriceEligibility failed', err);
    return unknownAll();
  }
}

// ─── Purchase / Restore ──────────────────────────────────

/** Callback que refresca `GET /account` y devuelve el tier actual (o null si falla). */
export type RefreshAccountTier = () => Promise<'free' | 'pro' | null>;

/**
 * Tipo de periodo del entitlement "plus" según RevenueCat (`periodType` del
 * `EntitlementInfo`). Es la ELEGIBILIDAD REAL del usuario, no la del producto:
 * un `introPrice` gratuito en el product dice que el plan OFRECE trial, pero a
 * quien ya lo consumió Apple le cobra ya y su entitlement llega como 'NORMAL'.
 * Lo consume el trial reminder: solo se programa aviso con 'TRIAL'.
 */
export type PlusEntitlementPeriodType = 'NORMAL' | 'INTRO' | 'TRIAL' | 'PREPAID';

function getPlusEntitlementPeriodType(customerInfo: CustomerInfo): PlusEntitlementPeriodType | null {
  const periodType = customerInfo.entitlements.active?.[PLUS_ENTITLEMENT_ID]?.periodType;
  return periodType === 'NORMAL' || periodType === 'INTRO' || periodType === 'TRIAL' || periodType === 'PREPAID'
    ? periodType
    : null;
}

export type PurchaseOutcome =
  /**
   * Entitlement activo y backend ya devuelve tier 'pro' — isPro flipea sin
   * reiniciar. `entitlementPeriodType` = periodo real del entitlement "plus"
   * del customerInfo de la operación (null si el SDK no lo expone).
   */
  | { status: 'success'; entitlementPeriodType: PlusEntitlementPeriodType | null }
  /** Entitlement activo en RevenueCat pero el backend aún no flipeó dentro del techo del poll. */
  | { status: 'pending_backend'; entitlementPeriodType: PlusEntitlementPeriodType | null }
  /** El usuario canceló el flujo de compra de Apple. NO es un error. */
  | { status: 'cancelled' }
  /** Compra/restore sin el entitlement "plus" activo (nada que restaurar o misconfig). */
  | { status: 'no_entitlement' }
  | { status: 'error'; message: string };

interface PollOptions {
  pollAttempts?: number;
  pollDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasPlusEntitlement(customerInfo: CustomerInfo): boolean {
  return PLUS_ENTITLEMENT_ID in (customerInfo.entitlements.active ?? {});
}

/**
 * Reconciliación en caliente: registra un listener del SDK que dispara
 * `onPlusActivated` cuando el entitlement "plus" pasa a activo (transición
 * inactivo→activo). El SDK emite estas actualizaciones también cuando el webhook
 * de RevenueCat confirma la compra en su backend, así que aunque el webhook de
 * nuestro backend se retrase, el cliente puede refrescar `/account` sin esperar
 * a un cold start ni a un Restore manual.
 *
 * Devuelve una función de limpieza que quita el listener. Sin SDK configurado es
 * un no-op (devuelve un cleanup vacío) para no requerir configure previo.
 */
export function addPlusActivationListener(onPlusActivated: () => void): () => void {
  if (!configured) return () => {};

  let wasActive = false;
  const listener = (customerInfo: CustomerInfo) => {
    const active = hasPlusEntitlement(customerInfo);
    if (active && !wasActive) onPlusActivated();
    wasActive = active;
  };

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

function isUserCancelled(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { userCancelled?: boolean }).userCancelled === true;
}

/**
 * Con el entitlement ya activo en RevenueCat, espera al flip del backend:
 * refresca /account con reintentos cortos hasta ver tier 'pro' o agotar el techo.
 */
async function settleTierWithBackend(
  refreshAccountTier: RefreshAccountTier,
  { pollAttempts = TIER_POLL_ATTEMPTS, pollDelayMs = TIER_POLL_DELAY_MS }: PollOptions,
  entitlementPeriodType: PlusEntitlementPeriodType | null,
): Promise<PurchaseOutcome> {
  for (let attempt = 0; attempt < pollAttempts; attempt++) {
    const tier = await refreshAccountTier();
    if (tier === 'pro') return { status: 'success', entitlementPeriodType };
    if (attempt < pollAttempts - 1) await sleep(pollDelayMs);
  }
  // El webhook de RevenueCat aún no llegó al backend: la compra es válida,
  // el tier flipeará solo. El caller informa sin alarmar (no es un fallo).
  logger.warn('RevenueCat: entitlement active but backend tier not flipped yet');
  return { status: 'pending_backend', entitlementPeriodType };
}

/**
 * Compra un package del offering. `expectedAppUserID` es el `user.id` de la
 * sesión actual: si la identidad asociada al SDK no coincide, la compra se
 * rechaza sin tocar StoreKit (`identity_mismatch`). La venta espera a que la
 * cola de identidad drene (nunca se vende con logIn/logOut pendientes), y el
 * dispatch entra él mismo en la cola con una re-validación final síncrona en
 * el slot — ninguna operación de identidad puede interleavarse con la venta.
 * La cancelación del usuario devuelve `{ status: 'cancelled' }` (no es error y
 * no se loguea como tal).
 */
export async function purchasePlusPackage(
  pkg: PurchasesPackage,
  expectedAppUserID: string,
  refreshAccountTier: RefreshAccountTier,
  pollOptions: PollOptions = {},
): Promise<PurchaseOutcome> {
  if (!configured) return { status: 'error', message: 'not_configured' };

  // Nunca vender con operaciones de identidad pendientes: los logIn/logOut en
  // vuelo commitean (o fallan) ANTES de verificar. Operaciones encoladas más
  // tarde bumpean la época y las cazan las re-validaciones de abajo. El check
  // síncrono evita ceder el event loop cuando la cola ya está vacía (la
  // verificación arranca en el mismo tick que la pulsación de compra).
  if (pendingIdentityOps > 0) await identityQueueDrained();
  const entryEpoch = identityEpoch;

  if (!(await confirmSessionIdentity(expectedAppUserID))) {
    logger.error('RevenueCat: purchase blocked, SDK identity does not match session user');
    return { status: 'error', message: 'identity_mismatch' };
  }

  let purchase: { customerInfo: CustomerInfo } | null;
  try {
    purchase = await enqueueIdentityOp<{ customerInfo: CustomerInfo } | null>(async () => {
      // Última línea de defensa, síncrona e inmediatamente antes de StoreKit,
      // dentro del slot de la cola: si la identidad cambió entre la
      // verificación y este instante (cualquier microtask pudo commitear un
      // logIn o procesar un logout), la venta no se despacha.
      if (identityEpoch !== entryEpoch || currentAppUserID !== expectedAppUserID) return null;
      return Purchases.purchasePackage(pkg);
    });
  } catch (err) {
    if (isUserCancelled(err)) return { status: 'cancelled' };
    logger.warn('RevenueCat: purchase failed', err);
    const message = err instanceof Error ? err.message : 'purchase_failed';
    return { status: 'error', message };
  }

  if (purchase === null) {
    logger.error('RevenueCat: purchase blocked, session identity changed during verification');
    return { status: 'error', message: 'identity_mismatch' };
  }
  if (!hasPlusEntitlement(purchase.customerInfo)) {
    logger.error('RevenueCat: purchase completed without plus entitlement (check dashboard mapping)');
    return { status: 'no_entitlement' };
  }
  return settleTierWithBackend(
    refreshAccountTier,
    pollOptions,
    getPlusEntitlementPeriodType(purchase.customerInfo),
  );
}

/**
 * Restaura compras previas (reinstalación / nuevo dispositivo). Igual que la
 * compra, exige identidad confirmada del usuario de sesión (`identity_mismatch`
 * si no coincide), espera la cola de identidad y re-valida dentro del slot.
 * Sin entitlement activo devuelve `no_entitlement`.
 */
export async function restorePlusPurchases(
  expectedAppUserID: string,
  refreshAccountTier: RefreshAccountTier,
  pollOptions: PollOptions = {},
): Promise<PurchaseOutcome> {
  if (!configured) return { status: 'error', message: 'not_configured' };

  if (pendingIdentityOps > 0) await identityQueueDrained();
  const entryEpoch = identityEpoch;

  if (!(await confirmSessionIdentity(expectedAppUserID))) {
    logger.error('RevenueCat: restore blocked, SDK identity does not match session user');
    return { status: 'error', message: 'identity_mismatch' };
  }

  let customerInfo: CustomerInfo | null;
  try {
    customerInfo = await enqueueIdentityOp<CustomerInfo | null>(async () => {
      if (identityEpoch !== entryEpoch || currentAppUserID !== expectedAppUserID) return null;
      return Purchases.restorePurchases();
    });
  } catch (err) {
    logger.warn('RevenueCat: restore failed', err);
    const message = err instanceof Error ? err.message : 'restore_failed';
    return { status: 'error', message };
  }

  if (customerInfo === null) {
    logger.error('RevenueCat: restore blocked, session identity changed during verification');
    return { status: 'error', message: 'identity_mismatch' };
  }
  if (!hasPlusEntitlement(customerInfo)) {
    return { status: 'no_entitlement' };
  }
  return settleTierWithBackend(
    refreshAccountTier,
    pollOptions,
    getPlusEntitlementPeriodType(customerInfo),
  );
}
