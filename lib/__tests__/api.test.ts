/**
 * Tests de `lib/api.ts`: auto-login y flujo 401 → refresh → retry.
 *
 * Auto-login:
 *  1. Al importar el módulo, `loadTokens()` se dispara y lee el
 *     `accessToken` persistido en `SecureStore`.
 *  2. Una llamada a `api('/account')` incluye la cabecera
 *     `Authorization: Bearer <token>` y devuelve los datos del usuario
 *     cuando el backend responde 200.
 *  3. `getAccessToken()` expone el token cargado.
 *
 * Refresh:
 *  - 401 con token → refresh OK → retry exacto de la request original
 *    UNA sola vez con el token nuevo.
 *  - Refresh inválido → error-as-value sin retry y tokens limpiados.
 *  - Singleton: dos 401 concurrentes comparten UNA llamada a /auth/refresh.
 *  - _retryCount: un segundo 401 tras el retry no vuelve a reintentar.
 *
 * El módulo cachea el accessToken a nivel de módulo, así que cada test
 * hace `require('../api')` fresco tras el `jest.resetModules()` del
 * afterEach (que también regenera el store del mock de SecureStore).
 */

// Aseguramos la variable de entorno antes de importar el módulo bajo prueba,
// porque `lib/api.ts` lanza en carga si `EXPO_PUBLIC_API_URL` no está definida.
process.env.EXPO_PUBLIC_API_URL = 'https://api.test.local';

// Mock de expo-secure-store: devuelve tokens "válidos" al restaurar.
jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {
    locallist_access_token: 'valid',
    locallist_refresh_token: 'refresh',
  };
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

// `lib/api.ts` usa `Platform.OS` para decidir SecureStore vs localStorage.
// Forzamos 'ios' para recorrer la rama nativa (SecureStore).
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Silenciamos el logger para no ensuciar la salida del test.
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('lib/api auto-login', () => {
  const mockUser = {
    id: 'u1',
    email: 'pablo@locallist.ai',
    tier: 'free' as const,
    name: 'Pablo',
  };

  beforeEach(() => {
    // Mock de `fetch` global: GET /account → 200 con el usuario.
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser }),
    }));
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('restaura el accessToken desde SecureStore al cargar', async () => {
    // Carga el módulo tras configurar los mocks (usamos require para
    // evitar `--experimental-vm-modules` con `import()` dinámico).
    const { getAccessToken } = require('../api') as typeof import('../api');

    const token = await getAccessToken();

    expect(token).toBe('valid');
  });

  it('adjunta el Bearer token y devuelve el usuario en GET /account', async () => {
    const { api } = require('../api') as typeof import('../api');

    const res = await api<{ user: typeof mockUser }>('/account');

    expect(res.status).toBe(200);
    expect(res.error).toBeNull();
    expect(res.data?.user).toEqual(mockUser);

    const fetchMock = (global as unknown as { fetch: jest.Mock }).fetch;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test.local/account');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer valid');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('lib/api 401 → refresh → retry', () => {
  type FetchHandler = (url: string, init: RequestInit) => {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  } | Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

  const jsonRes = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  const installFetch = (handler: FetchHandler) => {
    const fetchMock = jest.fn(handler);
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    return fetchMock;
  };

  const callsTo = (fetchMock: jest.Mock, path: string) =>
    fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(path));

  const authHeader = (init: RequestInit) =>
    (init.headers as Record<string, string>)['Authorization'];

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('tras un 401, refresca y reintenta la request original exactamente una vez con el token nuevo', async () => {
    let dataCalls = 0;
    const fetchMock = installFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) {
        return jsonRes(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      dataCalls += 1;
      // Primera llamada: token caducado → 401. Retry con el token nuevo → 200.
      if (dataCalls === 1) return jsonRes(401, { error: 'expired' });
      expect(authHeader(init)).toBe('Bearer new-access');
      return jsonRes(200, { items: [1, 2, 3] });
    });

    const { api } = require('../api') as typeof import('../api');
    const SecureStore = require('expo-secure-store');

    const res = await api<{ items: number[] }>('/plans', {
      method: 'POST',
      body: { city: 'Madrid' },
    });

    // Respuesta buena tras el retry, sin rastro del 401 intermedio
    expect(res).toEqual({ data: { items: [1, 2, 3] }, error: null, errorBody: null, status: 200 });

    // Exactamente: original (401) + refresh + retry = 3 fetches
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callsTo(fetchMock, '/plans')).toHaveLength(2);
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1);

    // El refresh envía el refresh token persistido
    const [, refreshInit] = callsTo(fetchMock, '/auth/refresh')[0] as [string, RequestInit];
    expect(JSON.parse(refreshInit.body as string)).toEqual({ refreshToken: 'refresh' });

    // El retry es exacto: mismo método y mismo body que la original
    const [origCall, retryCall] = callsTo(fetchMock, '/plans') as [string, RequestInit][];
    expect((retryCall[1] as RequestInit).method).toBe('POST');
    expect((retryCall[1] as RequestInit).body).toBe((origCall[1] as RequestInit).body);
    expect(authHeader(origCall[1] as RequestInit)).toBe('Bearer valid');
    expect(authHeader(retryCall[1] as RequestInit)).toBe('Bearer new-access');

    // El par nuevo se persiste en SecureStore
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('locallist_access_token', 'new-access');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('locallist_refresh_token', 'new-refresh');
  });

  it('si el refresh falla (refresh token inválido) no reintenta, devuelve error-as-value y limpia los tokens', async () => {
    const fetchMock = installFetch((url) => {
      if (url.endsWith('/auth/refresh')) return jsonRes(401, { error: 'invalid refresh token' });
      return jsonRes(401, { error: 'expired' });
    });

    const { api, getAccessToken } = require('../api') as typeof import('../api');
    const SecureStore = require('expo-secure-store');

    const res = await api<unknown>('/plans');

    // Error-as-value con el 401 original, sin lanzar
    expect(res.data).toBeNull();
    expect(res.status).toBe(401);
    expect(res.error).toBe('expired');

    // Sin retry: una sola request a /plans y un solo intento de refresh
    expect(callsTo(fetchMock, '/plans')).toHaveLength(1);
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Contrato actual: refresh con respuesta no-ok limpia ambos tokens
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('locallist_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('locallist_refresh_token');
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it('si el refresh falla por red, el error sale como valor y no hay retry infinito', async () => {
    const fetchMock = installFetch((url) => {
      if (url.endsWith('/auth/refresh')) return Promise.reject(new Error('Network request failed'));
      return jsonRes(401, { error: 'expired' });
    });

    const { api } = require('../api') as typeof import('../api');

    const res = await api<unknown>('/plans');

    expect(res).toEqual({ data: null, error: 'expired', errorBody: { error: 'expired' }, status: 401 });
    expect(callsTo(fetchMock, '/plans')).toHaveLength(1);
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1);
  });

  it('singleton de refresh: dos 401 concurrentes comparten UNA sola llamada a /auth/refresh', async () => {
    // Refresh deliberadamente en vuelo: dejamos que AMBOS 401 lleguen antes
    // de resolverlo, que es el orden que ejercita el singleton de verdad.
    let resolveRefresh!: (v: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    const pendingRefresh = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>(
      (res) => { resolveRefresh = res; },
    );

    const fetchMock = installFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) return pendingRefresh;
      // Con el token viejo → 401; con el refrescado → 200
      if (authHeader(init) === 'Bearer valid') return jsonRes(401, { error: 'expired' });
      return jsonRes(200, { ok: true });
    });

    const { api } = require('../api') as typeof import('../api');

    const inFlight = Promise.all([api<unknown>('/plans'), api<unknown>('/me/profile')]);

    // Drena microtasks/macrotasks hasta que ambos 401 hayan disparado el refresh
    await new Promise((r) => setTimeout(r, 0));
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1);

    resolveRefresh(jsonRes(200, { accessToken: 'new-access', refreshToken: 'new-refresh' }));
    const [r1, r2] = await inFlight;

    // Ambas requests acaban bien tras UN único refresh compartido
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1);
    expect(callsTo(fetchMock, '/plans')).toHaveLength(2);
    expect(callsTo(fetchMock, '/me/profile')).toHaveLength(2);
  });

  it('_retryCount: un segundo 401 tras el retry NO dispara otro ciclo de refresh', async () => {
    // El backend devuelve 401 siempre, incluso con el token refrescado.
    const fetchMock = installFetch((url) => {
      if (url.endsWith('/auth/refresh')) {
        return jsonRes(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      }
      return jsonRes(401, { error: 'still unauthorized' });
    });

    const { api } = require('../api') as typeof import('../api');

    const res = await api<unknown>('/plans');

    // El segundo 401 sale como error-as-value, sin bucle
    expect(res.data).toBeNull();
    expect(res.status).toBe(401);
    expect(res.error).toBe('still unauthorized');

    // original (401) + refresh + retry (401) y se acabó: ni segundo refresh ni tercer intento
    expect(callsTo(fetchMock, '/plans')).toHaveLength(2);
    expect(callsTo(fetchMock, '/auth/refresh')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('lib/api abort externo (unmount del caller)', () => {
  // Mock de fetch que nunca resuelve por sí solo: sólo rechaza con AbortError
  // cuando el signal interno de `api()` se aborta (timeout o signal externo).
  const hangingFetch = () =>
    jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const fail = () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          };
          if (init?.signal?.aborted) fail();
          else init?.signal?.addEventListener('abort', fail);
        }),
    );

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('cancela la petición en vuelo al abortar el signal externo', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = hangingFetch();
    const { api } = require('../api') as typeof import('../api');

    const controller = new AbortController();
    const pending = api('/follow/start', {
      method: 'POST',
      body: { planId: 'p1' },
      signal: controller.signal,
    });
    controller.abort();

    const res = await pending;
    expect(res.data).toBeNull();
    expect(res.error).toBe('Request aborted');
    expect(res.status).toBe(0);
  });

  it('no llega a esperar la respuesta si el signal ya estaba abortado', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = hangingFetch();
    const { api } = require('../api') as typeof import('../api');

    const controller = new AbortController();
    controller.abort();

    const res = await api('/follow/start', {
      method: 'POST',
      body: { planId: 'p1' },
      signal: controller.signal,
    });
    expect(res.data).toBeNull();
    expect(res.error).toBe('Request aborted');
  });

  it('no loguea como error un abort externo', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = hangingFetch();
    const { api } = require('../api') as typeof import('../api');
    const { logger } = require('../logger') as typeof import('../logger');

    const controller = new AbortController();
    const pending = api('/account', { signal: controller.signal });
    controller.abort();
    await pending;

    expect(logger.error).not.toHaveBeenCalled();
  });
});
