/**
 * Tests de comportamiento de lib/purchases.ts (RevenueCat mockeado).
 *
 * Cubre:
 *  - configure: sin API key degrada (no crash), con key configura el SDK.
 *  - contrato de identidad: si `logIn` falla al cambiar de usuario, configure
 *    devuelve false y NO adopta la identidad nueva (nunca ofrecer compra con
 *    el appUserID de otro usuario); el siguiente configure reintenta el logIn.
 *  - carreras de identidad (guarda de época): un logIn tardío que resuelve
 *    tras un logout o tras un logIn más reciente no commitea su identidad.
 *  - logOutPurchases: desvincula la identidad al cerrar sesión; el siguiente
 *    configure re-asocia vía logIn aunque el logOut del SDK falle.
 *  - punto de venta: purchase/restore exigen identidad confirmada del usuario
 *    de sesión (módulo Y SDK nativo) — identity_mismatch sin tocar StoreKit.
 *  - getPlusOfferings: not_configured / packages / no_offerings / network.
 *  - purchase ok + entitlement activo + backend flipeado → success y se
 *    refresca /account (vía callback refreshAccountTier).
 *  - cancelación del usuario → 'cancelled', NO es error y NO refresca account.
 *  - entitlement activo pero backend sin flipear → retry con techo →
 *    'pending_backend'; y flip en un intento intermedio → 'success'.
 *  - restore: con entitlement → success; sin él → 'no_entitlement'; fallo → error.
 */
import Purchases from 'react-native-purchases';
import {
  configurePurchases,
  isPurchasesConfigured,
  logOutPurchases,
  resetPurchasesForTesting,
  getPlusOfferings,
  purchasePlusPackage,
  restorePlusPurchases,
  addPlusActivationListener,
  PLUS_ENTITLEMENT_ID,
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

const API_KEY_ENV = 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY';

/** Configura el módulo con una key de prueba (estado limpio en cada test vía beforeEach). */
async function configureWithKey(): Promise<boolean> {
  process.env[API_KEY_ENV] = 'appl_test_key';
  return configurePurchases('user-1');
}

beforeEach(() => {
  jest.clearAllMocks();
  resetPurchasesForTesting();
  delete process.env[API_KEY_ENV];
  // Identidad nativa del SDK alineada con configureWithKey() por defecto; los
  // tests de mismatch la sobreescriben.
  mockPurchases.logOut.mockResolvedValue(undefined as never);
  mockPurchases.getAppUserID.mockResolvedValue('user-1');
});

describe('configurePurchases', () => {
  it('sin API key: devuelve false y no crashea ni llama al SDK', async () => {
    const ok = await configurePurchases('user-1');
    expect(ok).toBe(false);
    expect(isPurchasesConfigured()).toBe(false);
    expect(mockPurchases.configure).not.toHaveBeenCalled();
  });

  it('con API key: configura el SDK con el appUserID y es idempotente', async () => {
    const ok = await configureWithKey();
    expect(ok).toBe(true);
    expect(isPurchasesConfigured()).toBe(true);
    expect(mockPurchases.configure).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'appl_test_key', appUserID: 'user-1' }),
    );

    await configurePurchases('user-1');
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
  });

  it('ya configurado y cambia el appUserID: re-asocia vía logIn sin reconfigurar', async () => {
    await configureWithKey(); // appUserID user-1
    const ok = await configurePurchases('user-2');

    expect(ok).toBe(true);
    expect(mockPurchases.logIn).toHaveBeenCalledWith('user-2');
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
  });

  it('ya configurado con el mismo appUserID: no re-loguea', async () => {
    await configureWithKey(); // appUserID user-1
    await configurePurchases('user-1');

    expect(mockPurchases.logIn).not.toHaveBeenCalled();
  });

  // Contrato de identidad: con logIn fallido el SDK seguiría asociado al usuario
  // ANTERIOR — devolver true dejaría al nuevo usuario comprar bajo la cuenta
  // equivocada (el webhook daría Plus al otro, en silencio). Configure debe
  // devolver false para que el paywall degrade a "no disponible".
  it('logIn falla en el cambio de usuario: devuelve false (warn, sin invalidar el SDK)', async () => {
    await configureWithKey(); // appUserID user-1
    mockPurchases.logIn.mockRejectedValueOnce(new Error('offline'));

    const ok = await configurePurchases('user-2');

    expect(ok).toBe(false);
    const { logger } = jest.requireMock('../logger');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('tras un logIn fallido no se adoptó la identidad: el siguiente configure reintenta el logIn', async () => {
    await configureWithKey(); // appUserID user-1
    mockPurchases.logIn.mockRejectedValueOnce(new Error('offline'));
    await configurePurchases('user-2'); // false — identidad sigue en user-1

    const retry = await configurePurchases('user-2');

    expect(retry).toBe(true);
    expect(mockPurchases.logIn).toHaveBeenCalledTimes(2);
    expect(mockPurchases.logIn).toHaveBeenLastCalledWith('user-2');
  });

  it('ya configurado y sin uid: true solo si tampoco hay identidad previa (nunca heredarla)', async () => {
    process.env[API_KEY_ENV] = 'appl_test_key';
    await configurePurchases(); // anónimo desde el arranque
    expect(await configurePurchases()).toBe(true);

    resetPurchasesForTesting();
    await configureWithKey(); // appUserID user-1
    expect(await configurePurchases()).toBe(false);
  });

  // Carreras de identidad (guarda de época). Orden de resolución: primero el
  // request VIEJO — es el orden que ejercita el bug (un logIn tardío pisando
  // el estado más reciente); el orden inverso pasa incluso sin la guarda.
  it('logout con logIn en vuelo: el logIn tardío no resucita la identidad desvinculada', async () => {
    await configureWithKey(); // appUserID user-1
    let resolveLogIn!: (v: unknown) => void;
    mockPurchases.logIn.mockImplementationOnce(
      () => new Promise((resolve) => { resolveLogIn = resolve; }) as never,
    );

    const inFlight = configurePurchases('user-2'); // logIn de user-2 en vuelo
    logOutPurchases(); // el usuario cierra sesión antes de que resuelva
    resolveLogIn({});

    expect(await inFlight).toBe(false); // identidad no confirmada para esa sesión

    // El módulo no adoptó user-2: un nuevo configure debe volver a pasar por logIn.
    mockPurchases.logIn.mockResolvedValueOnce({} as never);
    await configurePurchases('user-2');
    expect(mockPurchases.logIn).toHaveBeenCalledTimes(2);
    expect(mockPurchases.logIn).toHaveBeenLastCalledWith('user-2');
  });

  it('dos logIn concurrentes: el que resuelve tarde no pisa la identidad más reciente', async () => {
    await configureWithKey(); // appUserID user-1
    let resolveOld!: (v: unknown) => void;
    mockPurchases.logIn
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }) as never)
      .mockResolvedValueOnce({} as never);

    const oldLogin = configurePurchases('user-2'); // en vuelo, resolverá tarde
    const newLogin = configurePurchases('user-3'); // gana: resuelve primero

    expect(await newLogin).toBe(true);
    resolveOld({}); // el logIn viejo llega tarde
    expect(await oldLogin).toBe(false);

    // La identidad vigente sigue siendo user-3: no re-loguea para user-3.
    mockPurchases.logIn.mockClear();
    expect(await configurePurchases('user-3')).toBe(true);
    expect(mockPurchases.logIn).not.toHaveBeenCalled();
  });
});

describe('logOutPurchases', () => {
  it('desvincula la identidad: el siguiente configure con otro uid pasa por logIn', async () => {
    await configureWithKey(); // appUserID user-1
    logOutPurchases();

    expect(mockPurchases.logOut).toHaveBeenCalled();

    const ok = await configurePurchases('user-2');
    expect(ok).toBe(true);
    expect(mockPurchases.logIn).toHaveBeenCalledWith('user-2');
  });

  it('mismo usuario tras logout: re-asocia vía logIn, no reutiliza la identidad previa', async () => {
    await configureWithKey(); // appUserID user-1
    logOutPurchases();

    await configurePurchases('user-1');

    expect(mockPurchases.logIn).toHaveBeenCalledWith('user-1');
  });

  it('logOut del SDK falla: no lanza (fire-and-forget) y fuerza el logIn en el siguiente configure', async () => {
    await configureWithKey(); // appUserID user-1
    mockPurchases.logOut.mockRejectedValueOnce(new Error('offline'));

    expect(() => logOutPurchases()).not.toThrow();

    await configurePurchases('user-1');
    expect(mockPurchases.logIn).toHaveBeenCalledWith('user-1');
  });

  it('sin SDK configurado: no-op, no llama a logOut', () => {
    logOutPurchases();
    expect(mockPurchases.logOut).not.toHaveBeenCalled();
  });

  it('configurado sin appUserID (anónimo): no llama a logOut (lanzaría en el SDK)', async () => {
    process.env[API_KEY_ENV] = 'appl_test_key';
    await configurePurchases();

    logOutPurchases();

    expect(mockPurchases.logOut).not.toHaveBeenCalled();
  });
});

describe('addPlusActivationListener', () => {
  it('sin configurar: no registra listener y el cleanup no crashea (no-op)', () => {
    const cb = jest.fn();
    const cleanup = addPlusActivationListener(cb);

    expect(mockPurchases.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });

  it('el entitlement plus pasa a activo: dispara el callback una sola vez en la transición', async () => {
    await configureWithKey();
    const cb = jest.fn();
    addPlusActivationListener(cb);
    const listener = mockPurchases.addCustomerInfoUpdateListener.mock.calls[0][0];

    // Primera actualización con plus activo: transición inactivo→activo.
    listener(customerInfoWith([PLUS_ENTITLEMENT_ID]));
    expect(cb).toHaveBeenCalledTimes(1);

    // Sigue activo en la siguiente actualización: no re-dispara.
    listener(customerInfoWith([PLUS_ENTITLEMENT_ID]));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('actualización sin entitlement plus: no dispara el callback', async () => {
    await configureWithKey();
    const cb = jest.fn();
    addPlusActivationListener(cb);
    const listener = mockPurchases.addCustomerInfoUpdateListener.mock.calls[0][0];

    listener(customerInfoWith([]));
    expect(cb).not.toHaveBeenCalled();
  });

  it('cleanup quita el listener registrado en el SDK', async () => {
    await configureWithKey();
    const cleanup = addPlusActivationListener(jest.fn());
    const listener = mockPurchases.addCustomerInfoUpdateListener.mock.calls[0][0];

    cleanup();
    expect(mockPurchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
  });
});

describe('getPlusOfferings', () => {
  it('sin configurar: error not_configured (paywall degrada, no crash)', async () => {
    const res = await getPlusOfferings();
    expect(res).toEqual({ packages: [], error: 'not_configured' });
    expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
  });

  it('offering con packages: los devuelve sin error', async () => {
    await configureWithKey();
    mockPurchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [PKG] },
    } as never);

    const res = await getPlusOfferings();
    expect(res.error).toBeNull();
    expect(res.packages).toEqual([PKG]);
  });

  it('offering vacío (productos ASC aún no creados): error no_offerings', async () => {
    await configureWithKey();
    mockPurchases.getOfferings.mockResolvedValue({ current: null } as never);

    const res = await getPlusOfferings();
    expect(res).toEqual({ packages: [], error: 'no_offerings' });
  });

  it('fallo de red del SDK: error network, sin throw', async () => {
    await configureWithKey();
    mockPurchases.getOfferings.mockRejectedValue(new Error('offline'));

    const res = await getPlusOfferings();
    expect(res).toEqual({ packages: [], error: 'network' });
  });
});

describe('purchasePlusPackage', () => {
  it('compra ok + entitlement plus + backend flipeado: success y refresca account', async () => {
    await configureWithKey();
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: customerInfoWith([PLUS_ENTITLEMENT_ID]),
    } as never);
    const refresh = jest.fn().mockResolvedValue('pro');

    const outcome = await purchasePlusPackage(PKG, 'user-1', refresh, { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'success' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('cancelación del usuario: status cancelled, no es error y NO refresca account', async () => {
    await configureWithKey();
    mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: true, message: 'cancelled' });
    const refresh = jest.fn();

    const outcome = await purchasePlusPackage(PKG, 'user-1', refresh, { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'cancelled' });
    expect(refresh).not.toHaveBeenCalled();
    const { logger } = jest.requireMock('../logger');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('entitlement activo pero backend sin flipear: reintenta con techo → pending_backend', async () => {
    await configureWithKey();
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: customerInfoWith([PLUS_ENTITLEMENT_ID]),
    } as never);
    const refresh = jest.fn().mockResolvedValue('free');

    const outcome = await purchasePlusPackage(PKG, 'user-1', refresh, { pollAttempts: 3, pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'pending_backend' });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('backend flipea en un intento intermedio del poll: success sin agotar el techo', async () => {
    await configureWithKey();
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: customerInfoWith([PLUS_ENTITLEMENT_ID]),
    } as never);
    const refresh = jest.fn()
      .mockResolvedValueOnce('free')
      .mockResolvedValueOnce('free')
      .mockResolvedValueOnce('pro');

    const outcome = await purchasePlusPackage(PKG, 'user-1', refresh, { pollAttempts: 5, pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'success' });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('compra completada sin entitlement plus (misconfig dashboard): no_entitlement', async () => {
    await configureWithKey();
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: customerInfoWith([]),
    } as never);
    const refresh = jest.fn();

    const outcome = await purchasePlusPackage(PKG, 'user-1', refresh, { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'no_entitlement' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('fallo de red/StoreKit no cancelado: status error con mensaje', async () => {
    await configureWithKey();
    mockPurchases.purchasePackage.mockRejectedValue(new Error('network down'));

    const outcome = await purchasePlusPackage(PKG, 'user-1', jest.fn(), { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'error', message: 'network down' });
  });

  it('sin configurar: status error sin llamar al SDK', async () => {
    const outcome = await purchasePlusPackage(PKG, 'user-1', jest.fn(), { pollDelayMs: 0 });
    expect(outcome).toEqual({ status: 'error', message: 'not_configured' });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  // Punto de venta: la invariante "nunca comprar bajo otro appUserID" vive
  // aquí, no solo en la disciplina de los callers.
  it('identidad del módulo distinta del usuario de sesión: identity_mismatch sin tocar StoreKit', async () => {
    await configureWithKey(); // identidad user-1

    const outcome = await purchasePlusPackage(PKG, 'user-2', jest.fn(), { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'error', message: 'identity_mismatch' });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('el SDK nativo reporta otra identidad (divergencia por carrera): identity_mismatch', async () => {
    await configureWithKey(); // el módulo cree user-1...
    mockPurchases.getAppUserID.mockResolvedValue('user-2'); // ...pero el nativo quedó en otro

    const outcome = await purchasePlusPackage(PKG, 'user-1', jest.fn(), { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'error', message: 'identity_mismatch' });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('getAppUserID falla: se rechaza la compra (identidad no verificable ⇒ no vender)', async () => {
    await configureWithKey();
    mockPurchases.getAppUserID.mockRejectedValue(new Error('offline'));

    const outcome = await purchasePlusPackage(PKG, 'user-1', jest.fn(), { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'error', message: 'identity_mismatch' });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });
});

describe('restorePlusPurchases', () => {
  it('restore con entitlement plus + backend pro: success', async () => {
    await configureWithKey();
    mockPurchases.restorePurchases.mockResolvedValue(customerInfoWith([PLUS_ENTITLEMENT_ID]) as never);
    const refresh = jest.fn().mockResolvedValue('pro');

    const outcome = await restorePlusPurchases('user-1', refresh, { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'success' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('restore sin compras previas: no_entitlement (no es error)', async () => {
    await configureWithKey();
    mockPurchases.restorePurchases.mockResolvedValue(customerInfoWith([]) as never);
    const refresh = jest.fn();

    const outcome = await restorePlusPurchases('user-1', refresh, { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'no_entitlement' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('restore con fallo de red: status error', async () => {
    await configureWithKey();
    mockPurchases.restorePurchases.mockRejectedValue(new Error('offline'));

    const outcome = await restorePlusPurchases('user-1', jest.fn(), { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'error', message: 'offline' });
  });

  it('identidad distinta del usuario de sesión: identity_mismatch sin llamar al SDK', async () => {
    await configureWithKey(); // identidad user-1

    const outcome = await restorePlusPurchases('user-2', jest.fn(), { pollDelayMs: 0 });

    expect(outcome).toEqual({ status: 'error', message: 'identity_mismatch' });
    expect(mockPurchases.restorePurchases).not.toHaveBeenCalled();
  });
});
