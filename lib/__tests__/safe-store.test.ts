/**
 * Tests para `lib/safe-store.ts` — wrapper resiliente sobre expo-secure-store.
 *
 * Cubre los dos paths críticos:
 *  - SecureStore disponible: probe pasa, getItem/setItem/deleteItem proxean.
 *  - SecureStore lanza (keychain locked, missing entitlements): probe falla
 *    con timeout o exception, fallback a Map in-memory.
 *
 * Audit follow-up E1 (2026-04-27): este archivo existía como gap. Los tres
 * consumers (api.ts, i18n, hero-variant) cargan el módulo en cold start —
 * regression aquí desloggea a todos los users.
 */

const probeKey = '__safe_store_probe__';

type SecureStoreModule = {
  setItemAsync: jest.Mock;
  getItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const loadFreshModule = () => {
  let safeStore: typeof import('../safe-store');
  jest.isolateModules(() => {
    safeStore = require('../safe-store');
  });
  return safeStore!;
};

describe('safe-store — SecureStore available', () => {
  let storeBackend: Record<string, string>;
  let mock: SecureStoreModule;

  beforeEach(() => {
    storeBackend = {};
    mock = {
      setItemAsync: jest.fn(async (k: string, v: string) => {
        storeBackend[k] = v;
      }),
      getItemAsync: jest.fn(async (k: string) => storeBackend[k] ?? null),
      deleteItemAsync: jest.fn(async (k: string) => {
        delete storeBackend[k];
      }),
    };
    jest.doMock('expo-secure-store', () => mock);
  });

  afterEach(() => {
    jest.dontMock('expo-secure-store');
    jest.resetModules();
  });

  it('proxea getItemAsync/setItemAsync/deleteItemAsync a SecureStore', async () => {
    const safeStore = loadFreshModule();
    await safeStore.setItemAsync('token', 'abc');
    const got = await safeStore.getItemAsync('token');
    expect(got).toBe('abc');
    await safeStore.deleteItemAsync('token');
    const after = await safeStore.getItemAsync('token');
    expect(after).toBeNull();
  });

  it('memoiza el probe — concurrent callers reusan una sola Promise', async () => {
    const safeStore = loadFreshModule();
    // 5 concurrent callers en cold start.
    await Promise.all([
      safeStore.getItemAsync('a'),
      safeStore.getItemAsync('b'),
      safeStore.setItemAsync('c', '1'),
      safeStore.deleteItemAsync('d'),
      safeStore.getItemAsync('e'),
    ]);
    // Probe sólo debe haber escrito UNA vez la probe key.
    const probeWrites = mock.setItemAsync.mock.calls.filter(
      ([k]) => k === probeKey,
    );
    expect(probeWrites).toHaveLength(1);
  });
});

describe('safe-store — SecureStore unavailable (fallback)', () => {
  let throwingMock: SecureStoreModule;

  beforeEach(() => {
    throwingMock = {
      setItemAsync: jest.fn(async () => {
        throw new Error('errSecMissingEntitlement');
      }),
      getItemAsync: jest.fn(async () => {
        throw new Error('errSecMissingEntitlement');
      }),
      deleteItemAsync: jest.fn(async () => {
        throw new Error('errSecMissingEntitlement');
      }),
    };
    jest.doMock('expo-secure-store', () => throwingMock);
  });

  afterEach(() => {
    jest.dontMock('expo-secure-store');
    jest.resetModules();
  });

  it('cae al fallback in-memory cuando SecureStore lanza en probe', async () => {
    const safeStore = loadFreshModule();
    await safeStore.setItemAsync('token', 'fallback-value');
    const got = await safeStore.getItemAsync('token');
    expect(got).toBe('fallback-value');
  });

  it('round-trip set→get→delete funciona en fallback', async () => {
    const safeStore = loadFreshModule();
    await safeStore.setItemAsync('k', 'v');
    expect(await safeStore.getItemAsync('k')).toBe('v');
    await safeStore.deleteItemAsync('k');
    expect(await safeStore.getItemAsync('k')).toBeNull();
  });

  it('no lanza cuando SecureStore tira en getItem post-probe', async () => {
    const safeStore = loadFreshModule();
    // El probe falla → marca unavailable. getItem usa fallback puro,
    // no toca SecureStore.
    const result = await safeStore.getItemAsync('missing');
    expect(result).toBeNull();
  });
});
