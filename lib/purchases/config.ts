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
 * Invariante de identidad (por construcción, no por disciplina de callers):
 * NUNCA se vende ni restaura bajo un `appUserID` distinto del usuario de
 * sesión. Tres mecanismos la sostienen:
 *
 *  1. Cola de identidad: todas las operaciones nativas que mutan o dependen
 *     de la identidad del SDK (logIn, logOut, purchase, restore) se encadenan
 *     en una cola de promesas del módulo. Nunca hay dos en vuelo, y una venta
 *     jamás se despacha con operaciones de identidad pendientes.
 *  2. Época de identidad: se incrementa en cada logout y en cada intento de
 *     logIn. Cualquier verificación que cruce un `await` re-valida la época al
 *     volver — un cambio de usuario o logout DURANTE la verificación invalida
 *     la venta (cierre del TOCTOU).
 *  3. Verificación en el punto de venta: además del estado del módulo se
 *     confirma la identidad real del SDK nativo (`getAppUserID`), y la última
 *     re-validación corre síncrona dentro del slot de la cola, inmediatamente
 *     antes de tocar StoreKit.
 *
 * Sin API key configurada el módulo degrada a "not_configured" (nunca crash):
 * el paywall muestra un estado de no-disponible. Esto cubre dev/simulador y
 * el periodo previo a crear los productos en App Store Connect.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Este módulo (`config`) es el NÚCLEO de identidad/configuración: posee TODO
 * el estado mutable del subsistema (identidad, época, cola, caché de
 * storefront) y las operaciones que lo mutan (configure / logOut / la guarda
 * TOCTOU). `offerings.ts` consume este estado como bindings vivos de solo
 * lectura + las primitivas de cola — nunca reasigna estado del núcleo. El
 * barrel `index.ts` re-exporta la API pública sin ampliarla.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { logger } from '../logger';

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

export let configured = false;
/** appUserID con el que quedó asociado el SDK (para re-asociar si cambia el usuario). */
export let currentAppUserID: string | null = null;
/**
 * Época de identidad: se incrementa en cada logout y en cada intento de logIn.
 * Un `logIn` en vuelo solo puede commitear su identidad si la época no cambió
 * durante el await — sin esto, un logIn tardío pisaría el estado de un logout
 * o de un logIn más reciente y dejaría identidad de un usuario anterior. La
 * misma época re-valida las verificaciones de venta tras cada await (TOCTOU).
 */
export let identityEpoch = 0;
/**
 * Cola de identidad: cadena de promesas que serializa TODA operación nativa
 * que mute o dependa de la identidad del SDK (logIn / logOut / purchase /
 * restore). Garantiza que nunca hay dos operaciones de identidad en vuelo y
 * que una venta no se despacha con logIn/logOut pendientes.
 */
let identityQueue: Promise<void> = Promise.resolve();
/**
 * logIn en vuelo, para coalescer configures concurrentes del MISMO uid en una
 * única operación nativa (hook de reconciliación + load() del paywall llegan a
 * la vez tras un cambio de usuario). Sin esto, el primero en resolver recibía
 * un false espurio por la guarda de época.
 */
let pendingLogIn: { uid: string; promise: Promise<boolean> } | null = null;
/**
 * True si el SDK nativo puede tener una identidad no-anónima (configure con
 * uid, o un logIn ENCOLADO aunque aún no haya commiteado en el módulo). Decide
 * si un logout debe encolar el `Purchases.logOut` nativo: un logIn en vuelo
 * que el módulo descartó por época puede aún así dejar al SDK logueado, y sin
 * este flag ese logOut se omitía y la identidad nativa quedaba huérfana.
 */
let nativeIdentityDirty = false;
/** Operaciones de identidad encoladas y aún no terminadas. */
export let pendingIdentityOps = 0;

/** Encadena una operación en la cola de identidad. Los errores de una operación
 *  no envenenan la cola (el tail siempre resuelve). */
export function enqueueIdentityOp<T>(op: () => Promise<T>): Promise<T> {
  pendingIdentityOps += 1;
  const result = identityQueue.then(op);
  identityQueue = result.then(
    () => {
      pendingIdentityOps -= 1;
    },
    () => {
      pendingIdentityOps -= 1;
    },
  );
  return result;
}

/**
 * Espera a que la cola de identidad quede vacía (incluidas operaciones que se
 * encolen mientras se drena). Con la cola ya vacía no hay await alguno: el
 * caller continúa síncrono, sin ceder el event loop.
 */
export async function identityQueueDrained(): Promise<void> {
  while (pendingIdentityOps > 0) {
    await identityQueue;
  }
}

export function isPurchasesConfigured(): boolean {
  return configured;
}

// ─── Storefront (caché para analytics) ───────────────────
// País del storefront de Apple (p. ej. 'ESP'/'USA'), independiente de la
// identidad del usuario. Lo consume lib/analytics como prop global de eventos.

let cachedStorefront: string | null = null;
/** Fetch en vuelo: configures concurrentes comparten UNA llamada nativa. */
let storefrontFetch: Promise<void> | null = null;

/**
 * País del storefront cacheado tras un `configurePurchases` exitoso.
 * `null` hasta que el fetch resuelva (o si el SDK/StoreKit no lo expone).
 */
export function getCachedStorefront(): string | null {
  return cachedStorefront;
}

/** Fire-and-forget: rellena el caché de storefront si aún no lo está. */
function refreshStorefrontCache(): void {
  if (cachedStorefront !== null || storefrontFetch !== null) return;
  storefrontFetch = (async () => {
    // Guarda por si el SDK instalado no expone la API (v10.4+ sí la tiene).
    if (typeof Purchases.getStorefront !== 'function') return;
    const storefront = await Purchases.getStorefront();
    cachedStorefront = storefront?.countryCode ?? null;
  })()
    .catch((err) => logger.debug('RevenueCat: getStorefront failed', err))
    .finally(() => {
      storefrontFetch = null;
    });
}

/**
 * Inicializa el SDK (idempotente). Devuelve false si no hay uid, no hay API
 * key o la plataforma no está soportada — el caller degrada a "no disponible".
 *
 * Sin uid SIEMPRE es false y no se configura nada: las compras de LocalList
 * van atadas a un usuario con sesión (el webhook acredita Plus por appUserID);
 * un SDK anónimo solo podría vender a nadie o heredar identidades. Esto además
 * impide que un paywall llegue a 'ready' tras un logout.
 *
 * Ya configurado, si el `appUserID` cambia (login con otra cuenta en la misma
 * sesión de proceso) re-asocia vía `Purchases.logIn` — encolado en la cola de
 * identidad y con guarda de época: si durante el await hubo un logout u otro
 * logIn más reciente, esa identidad no se adopta y devuelve false. Configures
 * concurrentes del MISMO uid coalescen en la misma operación (una sola llamada
 * nativa, mismo resultado para todos los callers). Si el logIn falla, devuelve
 * `false` SIN adoptar la identidad nueva: el SDK seguiría asociado al usuario
 * anterior y una compra saldría bajo su cuenta (el webhook daría Plus al
 * usuario equivocado, en silencio). El caller degrada a "no disponible" con
 * retry; la siguiente llamada reintenta el logIn.
 */
export async function configurePurchases(appUserID?: string | null): Promise<boolean> {
  const uid = appUserID ?? null;
  if (!uid) return false;

  if (configured) {
    // Aditivo (analytics): reintenta el fetch de storefront si el primero falló.
    refreshStorefrontCache();
    if (uid === currentAppUserID) return true;

    // Coalescing: un logIn en vuelo para este mismo uid ya representa esta
    // misma transición de identidad — compartir su resultado.
    if (pendingLogIn?.uid === uid) return pendingLogIn.promise;

    const epoch = ++identityEpoch;
    nativeIdentityDirty = true;
    const promise = enqueueIdentityOp(async () => {
      try {
        await Purchases.logIn(uid);
      } catch (err) {
        logger.warn('RevenueCat: logIn on user change failed', err);
        return false;
      }
      // Si durante el await hubo un logout u otro logIn más reciente, esta
      // identidad ya no representa la sesión actual: no se adopta.
      if (epoch !== identityEpoch) return false;
      currentAppUserID = uid;
      return true;
    }).finally(() => {
      if (pendingLogIn?.promise === promise) pendingLogIn = null;
    });
    pendingLogIn = { uid, promise };
    return promise;
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
    Purchases.configure({ apiKey, appUserID: uid });
    configured = true;
    currentAppUserID = uid;
    nativeIdentityDirty = true;
    refreshStorefrontCache();
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
 * invalida cualquier `logIn` en vuelo y cualquier verificación de venta en
 * curso) es inmediato. El `Purchases.logOut` nativo se ENCOLA en la cola de
 * identidad sin esperarlo — el logout de la app no bloquea por red, pero el
 * logOut queda serializado DETRÁS de cualquier logIn en vuelo: aunque ese
 * logIn no llegara a commitear en el módulo, el SDK nativo sí pudo quedar
 * logueado y este logOut lo limpia igualmente. El siguiente
 * `configurePurchases` pasa sí o sí por `logIn` (identidad confirmada o
 * paywall no disponible).
 */
export function logOutPurchases(): void {
  identityEpoch += 1;
  // Un logIn en vuelo ya no representa ninguna sesión: los coalescidos reciben
  // false y un re-login posterior encola un logIn fresco (no se cuelga del
  // condenado).
  pendingLogIn = null;
  currentAppUserID = null;
  if (!configured || !nativeIdentityDirty) return;
  nativeIdentityDirty = false;
  enqueueIdentityOp(() => Purchases.logOut()).then(
    () => undefined,
    (err) => {
      logger.warn('RevenueCat: logOut failed', err);
    },
  );
}

/** Solo para tests: resetea el estado del módulo. */
export function resetPurchasesForTesting() {
  configured = false;
  currentAppUserID = null;
  identityEpoch = 0;
  identityQueue = Promise.resolve();
  pendingLogIn = null;
  nativeIdentityDirty = false;
  pendingIdentityOps = 0;
  cachedStorefront = null;
  storefrontFetch = null;
}

/**
 * Verificación de identidad en el punto de venta. La invariante "nunca comprar
 * bajo un appUserID distinto del usuario de sesión" se impone aquí, no solo en
 * la disciplina de los callers: aunque un caller llegue con estado corrupto
 * (carrera de logIn tardío, configure omitido), el mismatch corta antes de
 * tocar StoreKit. Comprueba el estado del módulo Y la identidad real del SDK
 * nativo (`getAppUserID`), porque pueden divergir si RC resolvió logIns
 * concurrentes fuera de orden.
 *
 * Cierre del TOCTOU: la época y el estado del módulo se re-validan DESPUÉS del
 * await de `getAppUserID`. Un logout o cambio de usuario que ocurra durante la
 * verificación (la respuesta "vieja" del nativo llegaría aprobando una sesión
 * que ya no existe) invalida la venta. Nota: este false por época NO invalida
 * la identidad del módulo — puede ser la identidad fresca de otro usuario
 * recién commiteada, y pisarla rompería SU sesión.
 */
export async function confirmSessionIdentity(expectedAppUserID: string): Promise<boolean> {
  if (!expectedAppUserID || currentAppUserID !== expectedAppUserID) return false;
  const epoch = identityEpoch;

  let sdkAppUserID: string;
  try {
    sdkAppUserID = await Purchases.getAppUserID();
  } catch (err) {
    // Fallo de verificación (p. ej. sin red): no es divergencia confirmada —
    // se rechaza la venta pero se conserva la identidad para reintentar.
    logger.warn('RevenueCat: getAppUserID failed', err);
    return false;
  }

  // Re-validación post-await: si la época cambió (logout / logIn más reciente)
  // o el módulo ya apunta a otro usuario, esta verificación quedó obsoleta.
  if (epoch !== identityEpoch || currentAppUserID !== expectedAppUserID) return false;

  if (sdkAppUserID !== expectedAppUserID) {
    // Divergencia módulo/nativo confirmada con época intacta (un logOut/logIn
    // nativo resuelto fuera de orden): sin esto el mismatch sería terminal
    // hasta cold start, porque el siguiente configure vería uid ===
    // currentAppUserID y devolvería true sin re-loguear. Invalidar la
    // identidad del módulo (y la época, por logIns en vuelo) fuerza el logIn
    // en el siguiente configure — el retry del paywall se cura solo.
    logger.warn('RevenueCat: native identity diverged from module state, invalidating');
    identityEpoch += 1;
    currentAppUserID = null;
    return false;
  }
  return true;
}
