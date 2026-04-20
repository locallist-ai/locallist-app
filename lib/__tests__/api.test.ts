/**
 * Test de humo de `lib/api.ts`: verifica el flujo de auto-login.
 *
 * Escenario bajo prueba:
 *  1. Al importar el módulo, `loadTokens()` se dispara y lee el
 *     `accessToken` persistido en `SecureStore`.
 *  2. Una llamada a `api('/account')` incluye la cabecera
 *     `Authorization: Bearer <token>` y devuelve los datos del usuario
 *     cuando el backend responde 200.
 *  3. `getAccessToken()` expone el token cargado.
 *
 * Sólo cubrimos el "happy path". El refresh y los 401 quedan para
 * tests posteriores.
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
