/**
 * Tests de `lib/analytics.ts` — PostHog REST, fire-and-forget.
 *
 * Cubre:
 *  - anon distinct_id: UUID generado UNA vez, persistido en fichero local de la
 *    app (muere con la desinstalación — semántica elegida a propósito, ver
 *    lib/analytics.ts) y reutilizado entre cargas del módulo (cold starts).
 *  - storage caído: el evento sale igualmente con un id efímero de proceso y el
 *    rechazo NO se memoiza (el siguiente track reintenta el storage).
 *  - `$identify` en la transición anon→user con `$anon_distinct_id`; sin
 *    re-identify en user→user; sin rotación del anonId en logout.
 *  - Enriquecimiento global: `country` (locale) y `storefront` (caché de
 *    lib/purchases) en todos los eventos; la prop se OMITE sin valor (nunca
 *    `undefined`/`null` serializado).
 *  - Sin `EXPO_PUBLIC_POSTHOG_KEY` el módulo es no-op (ni fetch ni identify).
 *  - `trackPlanLimitIfGate403`: emite `plan_limit_hit` solo para 403 con código
 *    de gate del backend (familia RequirePro/PlanGate).
 *
 * Sin red real: `fetch` global mockeado. El módulo se carga fresco por test
 * (`jest.isolateModules`) porque cachea key, anonId y country a nivel de módulo.
 */

const mockStore: Record<string, string> = {};
const mockState = { uuid: 0, failReads: 0 };
const mockGetLocales = jest.fn(() => [{ regionCode: 'ES', languageCode: 'es' }]);
const mockGetCachedStorefront = jest.fn((): string | null => null);

// Fichero del anonId dentro del sandbox de la app (muere con la desinstalación).
const ANON_FILE = 'file:///doc/analytics_anon_id';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  getInfoAsync: jest.fn(async (path: string) => {
    if (mockState.failReads > 0) {
      mockState.failReads -= 1;
      throw new Error('disk unavailable');
    }
    return { exists: mockStore[path] !== undefined };
  }),
  readAsStringAsync: jest.fn(async (path: string) => {
    const value = mockStore[path];
    if (value === undefined) throw new Error('ENOENT');
    return value;
  }),
  writeAsStringAsync: jest.fn(async (path: string, value: string) => {
    mockStore[path] = value;
  }),
  deleteAsync: jest.fn(async (path: string) => {
    delete mockStore[path];
  }),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => `uuid-${++mockState.uuid}`),
}));
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}));
jest.mock('../purchases', () => ({
  getCachedStorefront: () => mockGetCachedStorefront(),
}));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type Analytics = typeof import('../analytics');

const KEY_ENV = 'EXPO_PUBLIC_POSTHOG_KEY';

/** Carga el módulo fresco con (o sin) API key de PostHog. */
function loadAnalytics(key: string | null = 'phc_test'): Analytics {
  if (key) process.env[KEY_ENV] = key;
  else delete process.env[KEY_ENV];
  let mod: Analytics;
  jest.isolateModules(() => {
    mod = require('../analytics');
  });
  return mod!;
}

/** Drena micro/macrotasks: track() resuelve el anonId de forma asíncrona. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let fetchMock: jest.Mock;

const sentBodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockState.uuid = 0;
  mockState.failReads = 0;
  mockGetLocales.mockReturnValue([{ regionCode: 'ES', languageCode: 'es' }]);
  mockGetCachedStorefront.mockReturnValue(null);
  fetchMock = jest.fn(async () => ({ ok: true }));
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

afterAll(() => {
  delete process.env[KEY_ENV];
});

describe('anon distinct_id persistente', () => {
  it('genera el UUID una sola vez, lo persiste y lo reutiliza en todos los eventos', async () => {
    const analytics = loadAnalytics();

    analytics.track({ event: 'profile_reset' });
    analytics.track({ event: 'wizard_started', city: 'Madrid' });
    await flush();

    const bodies = sentBodies();
    expect(bodies).toHaveLength(2);
    expect(bodies[0].distinct_id).toBe('uuid-1');
    expect(bodies[1].distinct_id).toBe('uuid-1');
    // Una sola generación y persistida en el fichero del contrato.
    // (contador compartido del mock: isolateModules regenera la instancia)
    expect(mockState.uuid).toBe(1);
    await flush();
    expect(mockStore[ANON_FILE]).toBe('uuid-1');
  });

  it('persiste entre cargas del módulo: un cold start posterior reutiliza el id guardado', async () => {
    const first = loadAnalytics();
    first.track({ event: 'profile_reset' });
    await flush();
    expect(mockStore[ANON_FILE]).toBe('uuid-1');

    // "Reinicio de la app": módulo fresco, mismo storage.
    const second = loadAnalytics();
    second.track({ event: 'profile_reset' });
    await flush();

    const bodies = sentBodies();
    expect(bodies[1].distinct_id).toBe('uuid-1');
    expect(mockState.uuid).toBe(1); // no re-genera en el segundo cold start
  });
});

describe('transición anon→user ($identify) y logout', () => {
  it('setAnalyticsUserId en transición anon→user emite $identify con $anon_distinct_id', async () => {
    const analytics = loadAnalytics();

    analytics.setAnalyticsUserId('user-1');
    await flush();

    const [identify] = sentBodies();
    expect(identify.event).toBe('$identify');
    expect(identify.distinct_id).toBe('user-1');
    expect(identify.properties.$anon_distinct_id).toBe('uuid-1');
  });

  it('con usuario fijado, track usa el userId como distinct_id', async () => {
    const analytics = loadAnalytics();
    analytics.setAnalyticsUserId('user-1');
    await flush();
    fetchMock.mockClear();

    analytics.track({ event: 'profile_reset' });
    await flush();

    expect(sentBodies()[0].distinct_id).toBe('user-1');
  });

  it('user→user (cambio de cuenta sin pasar por anon) NO re-emite $identify', async () => {
    const analytics = loadAnalytics();
    analytics.setAnalyticsUserId('user-1');
    await flush();
    fetchMock.mockClear();

    analytics.setAnalyticsUserId('user-2');
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logout NO rota el anonId: los eventos anónimos posteriores llevan el mismo id', async () => {
    const analytics = loadAnalytics();
    analytics.track({ event: 'profile_reset' });
    await flush();
    analytics.setAnalyticsUserId('user-1');
    await flush();

    analytics.setAnalyticsUserId(null); // logout
    fetchMock.mockClear();
    analytics.track({ event: 'profile_reset' });
    await flush();

    expect(sentBodies()[0].distinct_id).toBe('uuid-1');
    expect(mockStore[ANON_FILE]).toBe('uuid-1'); // el fichero no se toca
  });
});

describe('storage caído (MINOR-4: rechazo no memoizado + id efímero)', () => {
  it('si el storage falla, el evento sale igualmente con un id efímero de proceso', async () => {
    mockState.failReads = 1;
    const analytics = loadAnalytics();

    analytics.track({ event: 'profile_reset' });
    await flush();

    const [body] = sentBodies();
    expect(body.distinct_id).toBe('uuid-1'); // efímero, pero el evento NO se pierde
    expect(mockStore[ANON_FILE]).toBeUndefined(); // nada persistido aún
  });

  it('el rechazo NO se memoiza: el siguiente track reintenta el storage y promociona el id efímero', async () => {
    mockState.failReads = 1;
    const analytics = loadAnalytics();

    analytics.track({ event: 'profile_reset' }); // storage caído → efímero uuid-1
    await flush();

    analytics.track({ event: 'profile_reset' }); // storage recuperado → reintenta
    await flush();

    const bodies = sentBodies();
    expect(bodies[0].distinct_id).toBe('uuid-1');
    // Mismo id en todo el proceso (el efímero se promociona a persistente,
    // no se genera uno nuevo) y ahora sí queda en disco.
    expect(bodies[1].distinct_id).toBe('uuid-1');
    await flush();
    expect(mockStore[ANON_FILE]).toBe('uuid-1');
    expect(mockState.uuid).toBe(1);
  });

  it('storage caído de forma persistente: todos los eventos del proceso comparten el id efímero', async () => {
    mockState.failReads = 99;
    const analytics = loadAnalytics();

    analytics.track({ event: 'profile_reset' });
    await flush();
    analytics.track({ event: 'wizard_started', city: 'Madrid' });
    await flush();

    const bodies = sentBodies();
    expect(bodies).toHaveLength(2);
    expect(bodies[0].distinct_id).toBe('uuid-1');
    expect(bodies[1].distinct_id).toBe('uuid-1');
  });
});

describe('enriquecimiento global (country / storefront)', () => {
  it('todo evento sale con country y storefront cuando hay valor', async () => {
    mockGetCachedStorefront.mockReturnValue('ESP');
    const analytics = loadAnalytics();

    analytics.track({ event: 'profile_reset' });
    analytics.track({ event: 'paywall_viewed', source: 'account_upsell', offeringId: 'default' });
    await flush();

    for (const body of sentBodies()) {
      expect(body.properties.country).toBe('ES');
      expect(body.properties.storefront).toBe('ESP');
    }
  });

  it('sin valores, las props se omiten del payload (no undefined/null serializado)', async () => {
    mockGetLocales.mockReturnValue([]);
    mockGetCachedStorefront.mockReturnValue(null);
    const analytics = loadAnalytics();

    analytics.track({ event: 'profile_reset' });
    await flush();

    const [body] = sentBodies();
    expect('country' in body.properties).toBe(false);
    expect('storefront' in body.properties).toBe(false);
  });

  it('el $identify de la transición anon→user también va enriquecido', async () => {
    mockGetCachedStorefront.mockReturnValue('USA');
    mockGetLocales.mockReturnValue([{ regionCode: 'US', languageCode: 'en' }]);
    const analytics = loadAnalytics();

    analytics.setAnalyticsUserId('user-1');
    await flush();

    const [identify] = sentBodies();
    expect(identify.properties.country).toBe('US');
    expect(identify.properties.storefront).toBe('USA');
  });
});

describe('sin POSTHOG key: no-op', () => {
  it('track y setAnalyticsUserId no tocan la red ni el storage de anonId', async () => {
    const analytics = loadAnalytics(null);

    analytics.track({ event: 'profile_reset' });
    analytics.setAnalyticsUserId('user-1');
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockStore[ANON_FILE]).toBeUndefined();
  });
});

describe('trackPlanLimitIfGate403 (403 estructurado de gates Plus)', () => {
  it.each([
    'pro_required',
    'plan_limit_reached',
    'duration_requires_plus',
    'multicity_requires_plus',
    'saved_plans_limit_reached',
  ])('emite plan_limit_hit con gate=%s', async (code) => {
    const analytics = loadAnalytics();

    analytics.trackPlanLimitIfGate403(403, { error: code, used: 3, limit: 3 });
    await flush();

    const [body] = sentBodies();
    expect(body.event).toBe('plan_limit_hit');
    expect(body.properties.gate).toBe(code);
  });

  it('ignora 403 sin body estructurado o con código fuera de la familia de gates', async () => {
    const analytics = loadAnalytics();

    analytics.trackPlanLimitIfGate403(403, null);
    analytics.trackPlanLimitIfGate403(403, { error: 'Forbidden' });
    analytics.trackPlanLimitIfGate403(403, { message: 'nope' });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignora estados que no son 403 (429 daily_cap_reached de Plus incluido)', async () => {
    const analytics = loadAnalytics();

    analytics.trackPlanLimitIfGate403(429, { error: 'daily_cap_reached', used: 50, limit: 50 });
    analytics.trackPlanLimitIfGate403(401, { error: 'pro_required' });
    analytics.trackPlanLimitIfGate403(400, { error: 'duration_invalid' });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
