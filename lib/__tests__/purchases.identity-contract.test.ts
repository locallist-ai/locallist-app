/**
 * Contrato de identidad de lib/purchases.ts bajo carreras (RevenueCat mockeado).
 *
 * Origen: pase adversarial ciego 2026-07-22. Cada test afirma la invariante
 * "imposible por construcción comprar/restaurar con una identidad RC distinta
 * del usuario de sesión, en cualquier interleaving". Los interleavings aquí
 * son los que el pase demostró explotables:
 *
 *  - TOCTOU en la verificación de venta: logout o cambio de usuario DURANTE el
 *    await de getAppUserID debe bloquear la venta (re-validación por época).
 *  - Cola de identidad: la venta espera a los logIn/logOut pendientes y ninguna
 *    operación de identidad se interleava con el dispatch de StoreKit.
 *  - Coalescing: dos configure concurrentes del mismo uid comparten una única
 *    operación nativa y el mismo resultado (sin false espurio por época).
 *  - Logout: el logOut nativo se serializa detrás de un logIn en vuelo aunque
 *    este no hubiera commiteado en el módulo (identidad nativa nunca huérfana),
 *    y sin uid configure devuelve false (sin sesión no hay paywall).
 */
import Purchases from 'react-native-purchases';
import {
  configurePurchases,
  logOutPurchases,
  resetPurchasesForTesting,
  purchasePlusPackage,
  restorePlusPurchases,
} from '../purchases';
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    getAppUserID: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
}));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;
const PKG = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  product: { identifier: 'plus_annual', title: 'Plus Annual', priceString: '39,99 €' },
} as unknown as PurchasesPackage;

function customerInfoWith(entitlements: string[]): CustomerInfo {
  const active: Record<string, object> = {};
  for (const e of entitlements) active[e] = { isActive: true };
  return { entitlements: { active } } as unknown as CustomerInfo;
}

/** Da la vuelta al event loop: drena microtasks y la cola de identidad. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  jest.clearAllMocks();
  resetPurchasesForTesting();
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'appl_test_key';
  mockPurchases.logOut.mockResolvedValue(undefined as never);
  mockPurchases.getAppUserID.mockResolvedValue('user-1');
});

// ── TOCTOU en la verificación de identidad (punto de venta) ──────────────────
// El check del módulo se re-valida (identidad + época) DESPUÉS del await de
// getAppUserID: una respuesta "vieja" del nativo, despachada antes del cambio
// de sesión, no puede aprobar una venta bajo la sesión nueva.

it('CONTRATO: cambio de usuario durante la verificación de identidad bloquea la venta', async () => {
  await configurePurchases('user-1'); // configure inicial, identidad user-1

  let resolveGetAppUserID!: (v: string) => void;
  mockPurchases.getAppUserID.mockImplementationOnce(
    () => new Promise<string>((r) => { resolveGetAppUserID = r; }) as never,
  );
  mockPurchases.purchasePackage.mockResolvedValue({
    customerInfo: customerInfoWith(['plus']),
  } as never);
  const refresh = jest.fn().mockResolvedValue('pro');

  // user-1 pulsa comprar: la venta queda esperando la respuesta de getAppUserID
  const sale = purchasePlusPackage(PKG, 'user-1', refresh, { pollDelayMs: 0 });

  // Mientras tanto: user-1 cierra sesión y user-2 inicia sesión (commit completo)
  logOutPurchases();
  mockPurchases.logIn.mockResolvedValueOnce({} as never);
  expect(await configurePurchases('user-2')).toBe(true);

  // La respuesta de getAppUserID despachada ANTES del cambio llega ahora
  resolveGetAppUserID('user-1');
  const outcome = await sale;

  // CONTRATO: la sesión del módulo ya es user-2 ⇒ la venta debe rechazarse.
  expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  expect(outcome).toEqual({ status: 'error', message: 'identity_mismatch' });
});

it('CONTRATO: logout durante la verificación de identidad bloquea la venta', async () => {
  await configurePurchases('user-1');
  let resolveGetAppUserID!: (v: string) => void;
  mockPurchases.getAppUserID.mockImplementationOnce(
    () => new Promise<string>((r) => { resolveGetAppUserID = r; }) as never,
  );
  mockPurchases.purchasePackage.mockResolvedValue({
    customerInfo: customerInfoWith(['plus']),
  } as never);

  const sale = purchasePlusPackage(PKG, 'user-1', jest.fn().mockResolvedValue('pro'), { pollDelayMs: 0 });
  logOutPurchases(); // sesión cerrada; Purchases.logOut nativo encolado
  resolveGetAppUserID('user-1');

  const outcome = await sale;
  expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  expect(outcome).toEqual({ status: 'error', message: 'identity_mismatch' });
});

it('CONTRATO: cambio de usuario durante la verificación bloquea el restore', async () => {
  await configurePurchases('user-1');
  let resolveGetAppUserID!: (v: string) => void;
  mockPurchases.getAppUserID.mockImplementationOnce(
    () => new Promise<string>((r) => { resolveGetAppUserID = r; }) as never,
  );
  mockPurchases.restorePurchases.mockResolvedValue(customerInfoWith(['plus']) as never);

  const restore = restorePlusPurchases('user-1', jest.fn().mockResolvedValue('pro'), { pollDelayMs: 0 });
  logOutPurchases();
  mockPurchases.logIn.mockResolvedValueOnce({} as never);
  await configurePurchases('user-2');
  resolveGetAppUserID('user-1');

  const outcome = await restore;
  expect(mockPurchases.restorePurchases).not.toHaveBeenCalled();
  expect(outcome).toEqual({ status: 'error', message: 'identity_mismatch' });
});

// ── Cola de identidad: la venta nunca convive con operaciones pendientes ────

it('CONTRATO: la venta espera al logIn en vuelo (commit antes de verificar, luego vende bajo la identidad correcta)', async () => {
  await configurePurchases('user-1');
  let resolveLogIn!: (v: unknown) => void;
  mockPurchases.logIn.mockImplementationOnce(
    () => new Promise((r) => { resolveLogIn = r; }) as never,
  );
  const login = configurePurchases('user-2'); // logIn en vuelo
  mockPurchases.getAppUserID.mockResolvedValue('user-2');
  mockPurchases.purchasePackage.mockResolvedValue({
    customerInfo: customerInfoWith(['plus']),
  } as never);

  const sale = purchasePlusPackage(PKG, 'user-2', jest.fn().mockResolvedValue('pro'), { pollDelayMs: 0 });

  // Con el logIn pendiente, la venta no toca StoreKit.
  await flushAsync();
  expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();

  resolveLogIn({});
  expect(await login).toBe(true);
  expect(await sale).toEqual({ status: 'success', entitlementPeriodType: null }); // identidad user-2 ya commiteada
  expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
});

it('CONTRATO: un logout durante la venta no interleava el logOut nativo con purchasePackage', async () => {
  await configurePurchases('user-1');
  let resolvePurchase!: (v: unknown) => void;
  mockPurchases.purchasePackage.mockImplementationOnce(
    () => new Promise((r) => { resolvePurchase = r; }) as never,
  );

  const sale = purchasePlusPackage(PKG, 'user-1', jest.fn().mockResolvedValue(null), {
    pollAttempts: 1,
    pollDelayMs: 0,
  });
  await flushAsync(); // la venta ya despachó purchasePackage (identidad válida)
  expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);

  logOutPurchases(); // logout de la app con el sheet de Apple abierto
  await flushAsync();
  // El logOut nativo queda encolado DETRÁS de la venta: no corre en paralelo.
  expect(mockPurchases.logOut).not.toHaveBeenCalled();

  resolvePurchase({ customerInfo: customerInfoWith(['plus']) });
  await sale;
  await flushAsync();
  expect(mockPurchases.logOut).toHaveBeenCalledTimes(1);
});

// ── Coalescing de configures concurrentes del mismo uid ─────────────────────
// Antes (limitación "aceptada"): el primero en resolver recibía un false
// espurio por la guarda de época — con el interleaving real hook de
// reconciliación + load() del paywall tras un cambio de usuario. Ahora ambos
// comparten la MISMA operación nativa y el mismo resultado.

it('CONTRATO: dos configure concurrentes del mismo uid coalescen — un solo logIn y true para ambos', async () => {
  await configurePurchases('user-1');
  let resolveLogIn!: (v: unknown) => void;
  mockPurchases.logIn.mockImplementationOnce(
    () => new Promise((r) => { resolveLogIn = r; }) as never,
  );

  const hookConfigure = configurePurchases('user-2');    // hook de reconciliación (arranca 1º)
  const paywallConfigure = configurePurchases('user-2'); // paywall load()

  await flushAsync(); // el logIn encolado ya está en vuelo
  resolveLogIn({});
  expect(await hookConfigure).toBe(true);
  expect(await paywallConfigure).toBe(true);
  expect(mockPurchases.logIn).toHaveBeenCalledTimes(1);
});

// ── Logout: identidad nativa nunca huérfana, y sin sesión no hay paywall ────

it('CONTRATO: logout con logIn sin commitear en vuelo: el logOut nativo se serializa detrás y limpia el SDK', async () => {
  await configurePurchases('user-1');
  logOutPurchases(); // logOut nativo #1 (identidad user-1)

  let resolveLogIn!: (v: unknown) => void;
  mockPurchases.logIn.mockImplementationOnce(
    () => new Promise((r) => { resolveLogIn = r; }) as never,
  );
  const inFlight = configurePurchases('user-2'); // logIn en vuelo, aún sin commit en el módulo
  logOutPurchases(); // antes este logOut nativo se omitía (el módulo aún no veía identidad)

  await flushAsync(); // el logIn encolado ya está en vuelo
  resolveLogIn({});
  expect(await inFlight).toBe(false); // época cambiada: la identidad no se adopta

  // Drena la cola encolando otra operación detrás y esperándola.
  mockPurchases.logIn.mockResolvedValueOnce({} as never);
  expect(await configurePurchases('user-3')).toBe(true);

  // El SDK nativo pudo quedar logueado como user-2 pese al no-commit: el
  // logOut #2 corre igualmente, y siempre DESPUÉS del logIn en vuelo.
  expect(mockPurchases.logOut).toHaveBeenCalledTimes(2);
  expect(mockPurchases.logOut.mock.invocationCallOrder[1]).toBeGreaterThan(
    mockPurchases.logIn.mock.invocationCallOrder[0],
  );
});

it('CONTRATO: un configure rezagado tras logout nunca reutiliza identidad residual — siempre logIn fresco', async () => {
  // El módulo no tiene noción de sesión de app: la defensa contra el handler
  // de foreground rezagado vive en usePurchaseReconciliation (guarda de
  // sesión) y en el orden síncrono del logout de lib/auth. Aquí se afirma la
  // garantía del módulo: tras un logout, CUALQUIER re-adopción del mismo uid
  // pasa por un Purchases.logIn nativo fresco, nunca por estado residual.
  await configurePurchases('user-1');
  logOutPurchases();

  mockPurchases.logIn.mockResolvedValueOnce({} as never);
  expect(await configurePurchases('user-1')).toBe(true);
  expect(mockPurchases.logIn).toHaveBeenCalledWith('user-1');
});

it('CONTRATO: sin uid, configure devuelve false — el paywall no puede quedar ready sin sesión', async () => {
  // Nunca configurado: tampoco se configura en anónimo.
  expect(await configurePurchases(undefined)).toBe(false);
  expect(mockPurchases.configure).not.toHaveBeenCalled();

  // Tras un logout (antes devolvía true y el paywall podía llegar a 'ready'
  // deslogueado con ofertas compradas por nadie).
  await configurePurchases('user-1');
  logOutPurchases();
  expect(await configurePurchases(undefined)).toBe(false);
  expect(await configurePurchases(null)).toBe(false);
});
