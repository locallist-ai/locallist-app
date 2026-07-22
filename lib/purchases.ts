/**
 * RevenueCat (Apple IAP) — suscripción "LocalList Plus".
 *
 * Flujo: la compra se hace contra StoreKit vía RevenueCat; el backend recibe
 * el webhook de RevenueCat y flipea `tier` a 'pro'. La app NO decide el tier
 * por su cuenta: tras una compra/restore con entitlement activo, refresca
 * `GET /account` (con un poll corto) hasta ver el flip. La fuente de verdad
 * del gating sigue siendo `user.tier` del backend (`isPro` en lib/auth).
 *
 * Si el webhook se retrasa más que el poll, el cliente reconcilia solo: un
 * `addPlusActivationListener` a nivel de app refresca `/account` cuando el SDK
 * marca el entitlement activo, y la vuelta a foreground vuelve a reconciliar
 * (ver `usePurchaseReconciliation`). Así el flip llega en caliente, sin cold
 * start ni Restore manual.
 *
 * Sin API key configurada el módulo degrada a "not_configured" (nunca crash):
 * el paywall muestra un estado de no-disponible. Esto cubre dev/simulador y
 * el periodo previo a crear los productos en App Store Connect.
 */
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { logger } from './logger';

/** Entitlement configurado en el dashboard de RevenueCat. */
export const PLUS_ENTITLEMENT_ID = 'plus';

/** Poll de `GET /account` tras compra: 5 intentos x 2s = techo de ~10s. */
const TIER_POLL_ATTEMPTS = 5;
const TIER_POLL_DELAY_MS = 2000;

// TODO(pablo): config externa pendiente (checklist de lanzamiento IAP):
//  1. RevenueCat public API key (Apple): crear app iOS en el dashboard y exponer
//     la key como EXPO_PUBLIC_REVENUECAT_IOS_API_KEY (.env local + EAS Build env).
//     Es una key pública, no un secreto.
//  2. Webhook RevenueCat → backend verificado end-to-end: que el evento de compra
//     flipe `tier` a 'pro' de forma fiable (auth del webhook, reintentos, latencia).
//     El cliente ya reconcilia solo si el webhook se retrasa (listener + foreground),
//     pero el webhook sigue siendo la fuente de verdad y hay que confirmarlo en real.
function getApiKey(): string {
  return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
}

let configured = false;
/** appUserID con el que quedó asociado el SDK (para re-asociar si cambia el usuario). */
let currentAppUserID: string | null = null;
/**
 * Época de identidad: se incrementa en cada logout y en cada intento de logIn.
 * Un `logIn` en vuelo solo puede commitear su identidad si la época no cambió
 * durante el await — sin esto, un logIn tardío pisaría el estado de un logout
 * o de un logIn más reciente y dejaría identidad de un usuario anterior.
 */
let identityEpoch = 0;

export function isPurchasesConfigured(): boolean {
  return configured;
}

/**
 * Inicializa el SDK (idempotente). Devuelve false si no hay API key o la
 * plataforma no está soportada — el caller degrada a estado "no disponible".
 *
 * Ya configurado, si el `appUserID` cambia (login con otra cuenta en la misma
 * sesión de proceso) re-asocia vía `Purchases.logIn` para no dejar las compras
 * colgadas del usuario anterior. Si ese re-login falla, devuelve `false` SIN
 * adoptar la identidad nueva: el SDK seguiría asociado al usuario anterior y
 * una compra saldría bajo su cuenta (el webhook daría Plus al usuario
 * equivocado, en silencio). El caller degrada a "no disponible" con retry;
 * la siguiente llamada reintenta el logIn.
 */
export async function configurePurchases(appUserID?: string | null): Promise<boolean> {
  const uid = appUserID ?? null;

  if (configured) {
    // Sin uid no hay identidad que confirmar: solo es válido si tampoco queda
    // identidad previa asociada (nunca heredar la de otro usuario).
    if (!uid) return currentAppUserID === null;

    if (uid !== currentAppUserID) {
      const epoch = ++identityEpoch;
      try {
        await Purchases.logIn(uid);
        // Si durante el await hubo un logout u otro logIn más reciente, esta
        // identidad ya no representa la sesión actual: no se adopta.
        if (epoch !== identityEpoch) return false;
        currentAppUserID = uid;
      } catch (err) {
        logger.warn('RevenueCat: logIn on user change failed', err);
        return false;
      }
    }
    return true;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn('RevenueCat: no API key configured, purchases disabled');
    return false;
  }
  if (Platform.OS !== 'ios') {
    logger.warn('RevenueCat: platform not supported yet', { platform: Platform.OS });
    return false;
  }

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, appUserID: uid ?? undefined });
    configured = true;
    currentAppUserID = uid;
    return true;
  } catch (err) {
    logger.error('RevenueCat: configure failed', err);
    return false;
  }
}

/**
 * Desvincula la identidad de RevenueCat al cerrar sesión en la app. Sin esto,
 * el siguiente usuario que inicie sesión en el mismo proceso heredaría el
 * `appUserID` anterior si su `logIn` fallara, y su compra acreditaría Plus a
 * la cuenta equivocada.
 *
 * Síncrona y nunca lanza: el reset del estado interno (identidad + época, que
 * invalida cualquier `logIn` en vuelo) es inmediato, y la llamada de red
 * `Purchases.logOut` se dispara sin esperarla — un SDK sin red no debe
 * bloquear el logout de la app. El siguiente `configurePurchases` pasa sí o
 * sí por `logIn` (identidad confirmada o paywall no disponible).
 */
export function logOutPurchases(): void {
  identityEpoch += 1;
  const hadIdentity = currentAppUserID !== null;
  currentAppUserID = null;
  // Sin identidad asociada el SDK está en usuario anónimo y logOut lanzaría.
  if (!configured || !hadIdentity) return;
  Purchases.logOut().catch((err) => {
    logger.warn('RevenueCat: logOut failed', err);
  });
}

/** Solo para tests: resetea el estado del módulo. */
export function resetPurchasesForTesting() {
  configured = false;
  currentAppUserID = null;
  identityEpoch = 0;
}

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

// ─── Purchase / Restore ──────────────────────────────────

/** Callback que refresca `GET /account` y devuelve el tier actual (o null si falla). */
export type RefreshAccountTier = () => Promise<'free' | 'pro' | null>;

export type PurchaseOutcome =
  /** Entitlement activo y backend ya devuelve tier 'pro' — isPro flipea sin reiniciar. */
  | { status: 'success' }
  /** Entitlement activo en RevenueCat pero el backend aún no flipeó dentro del techo del poll. */
  | { status: 'pending_backend' }
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
 * Verificación de identidad en el punto de venta. La invariante "nunca comprar
 * bajo un appUserID distinto del usuario de sesión" se impone aquí, no solo en
 * la disciplina de los callers: aunque un caller llegue con estado corrupto
 * (carrera de logIn tardío, configure omitido), el mismatch corta antes de
 * tocar StoreKit. Comprueba el estado del módulo Y la identidad real del SDK
 * nativo (`getAppUserID`), porque pueden divergir si RC resolvió logIns
 * concurrentes fuera de orden.
 */
async function confirmSessionIdentity(expectedAppUserID: string): Promise<boolean> {
  if (!expectedAppUserID || currentAppUserID !== expectedAppUserID) return false;
  try {
    const sdkAppUserID = await Purchases.getAppUserID();
    return sdkAppUserID === expectedAppUserID;
  } catch (err) {
    logger.warn('RevenueCat: getAppUserID failed', err);
    return false;
  }
}

/**
 * Con el entitlement ya activo en RevenueCat, espera al flip del backend:
 * refresca /account con reintentos cortos hasta ver tier 'pro' o agotar el techo.
 */
async function settleTierWithBackend(
  refreshAccountTier: RefreshAccountTier,
  { pollAttempts = TIER_POLL_ATTEMPTS, pollDelayMs = TIER_POLL_DELAY_MS }: PollOptions,
): Promise<PurchaseOutcome> {
  for (let attempt = 0; attempt < pollAttempts; attempt++) {
    const tier = await refreshAccountTier();
    if (tier === 'pro') return { status: 'success' };
    if (attempt < pollAttempts - 1) await sleep(pollDelayMs);
  }
  // El webhook de RevenueCat aún no llegó al backend: la compra es válida,
  // el tier flipeará solo. El caller informa sin alarmar (no es un fallo).
  logger.warn('RevenueCat: entitlement active but backend tier not flipped yet');
  return { status: 'pending_backend' };
}

/**
 * Compra un package del offering. `expectedAppUserID` es el `user.id` de la
 * sesión actual: si la identidad asociada al SDK no coincide, la compra se
 * rechaza sin tocar StoreKit (`identity_mismatch`). La cancelación del usuario
 * devuelve `{ status: 'cancelled' }` (no es error y no se loguea como tal).
 */
export async function purchasePlusPackage(
  pkg: PurchasesPackage,
  expectedAppUserID: string,
  refreshAccountTier: RefreshAccountTier,
  pollOptions: PollOptions = {},
): Promise<PurchaseOutcome> {
  if (!configured) return { status: 'error', message: 'not_configured' };
  if (!(await confirmSessionIdentity(expectedAppUserID))) {
    logger.error('RevenueCat: purchase blocked, SDK identity does not match session user');
    return { status: 'error', message: 'identity_mismatch' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (!hasPlusEntitlement(customerInfo)) {
      logger.error('RevenueCat: purchase completed without plus entitlement (check dashboard mapping)');
      return { status: 'no_entitlement' };
    }
    return settleTierWithBackend(refreshAccountTier, pollOptions);
  } catch (err) {
    if (isUserCancelled(err)) return { status: 'cancelled' };
    logger.warn('RevenueCat: purchase failed', err);
    const message = err instanceof Error ? err.message : 'purchase_failed';
    return { status: 'error', message };
  }
}

/**
 * Restaura compras previas (reinstalación / nuevo dispositivo). Igual que la
 * compra, exige identidad confirmada del usuario de sesión (`identity_mismatch`
 * si no coincide). Sin entitlement activo devuelve `no_entitlement`.
 */
export async function restorePlusPurchases(
  expectedAppUserID: string,
  refreshAccountTier: RefreshAccountTier,
  pollOptions: PollOptions = {},
): Promise<PurchaseOutcome> {
  if (!configured) return { status: 'error', message: 'not_configured' };
  if (!(await confirmSessionIdentity(expectedAppUserID))) {
    logger.error('RevenueCat: restore blocked, SDK identity does not match session user');
    return { status: 'error', message: 'identity_mismatch' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    if (!hasPlusEntitlement(customerInfo)) {
      return { status: 'no_entitlement' };
    }
    return settleTierWithBackend(refreshAccountTier, pollOptions);
  } catch (err) {
    logger.warn('RevenueCat: restore failed', err);
    const message = err instanceof Error ? err.message : 'restore_failed';
    return { status: 'error', message };
  }
}
