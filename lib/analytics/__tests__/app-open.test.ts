/**
 * Tests de `lib/analytics/app-open.ts` — `days_since_install` para `app_opened`.
 *
 * Cubre:
 *  - `daysSinceInstall`: 0 el primer día, N tras N días, nunca negativo.
 *  - `readOrInitFirstOpen`: inicializa UNA vez (persiste `now`, devuelve 0 días),
 *    luego estable en el proceso; un cold start posterior con fichero existente
 *    reutiliza el timestamp persistido.
 *
 * Sin FS real: `expo-file-system/legacy` mockeado, mismo patrón que analytics.test.
 * El módulo se recarga fresco por test (`jest.isolateModules`) porque memoiza la
 * Promise del first-open a nivel de módulo.
 */

const mockStore: Record<string, string> = {};

const FIRST_OPEN_FILE = 'file:///doc/analytics_first_open';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  getInfoAsync: jest.fn(async (path: string) => ({ exists: mockStore[path] !== undefined })),
  readAsStringAsync: jest.fn(async (path: string) => {
    const v = mockStore[path];
    if (v === undefined) throw new Error('ENOENT');
    return v;
  }),
  writeAsStringAsync: jest.fn(async (path: string, value: string) => {
    mockStore[path] = value;
  }),
}));
jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type AppOpen = typeof import('../app-open');

function load(): AppOpen {
  let mod: AppOpen;
  jest.isolateModules(() => {
    mod = require('../app-open');
  });
  return mod!;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const DAY = 86_400_000;
const T0 = 1_700_000_000_000; // arbitrary fixed "install" epoch

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
});

describe('daysSinceInstall (pura)', () => {
  it('primer día → 0', () => {
    const { daysSinceInstall } = load();
    expect(daysSinceInstall(T0, T0)).toBe(0);
    expect(daysSinceInstall(T0, T0 + DAY - 1)).toBe(0); // <24h
  });

  it('N días después → N', () => {
    const { daysSinceInstall } = load();
    expect(daysSinceInstall(T0, T0 + DAY)).toBe(1);
    expect(daysSinceInstall(T0, T0 + 7 * DAY)).toBe(7);
    expect(daysSinceInstall(T0, T0 + 30 * DAY + 5000)).toBe(30);
  });

  it('nunca negativo (reloj hacia atrás)', () => {
    const { daysSinceInstall } = load();
    expect(daysSinceInstall(T0, T0 - 5 * DAY)).toBe(0);
  });
});

describe('readOrInitFirstOpen / getDaysSinceInstall', () => {
  it('primera apertura: inicializa el fichero con `now` y reporta 0 días', async () => {
    const mod = load();
    const days = await mod.getDaysSinceInstall(T0);
    expect(days).toBe(0);
    await flush();
    expect(mockStore[FIRST_OPEN_FILE]).toBe(String(T0));
  });

  it('estable en el proceso: una 2ª lectura con `now` posterior mide contra el mismo install', async () => {
    const mod = load();
    await mod.getDaysSinceInstall(T0); // init
    await flush();
    const daysLater = await mod.getDaysSinceInstall(T0 + 3 * DAY);
    expect(daysLater).toBe(3);
    // No se re-inicializa: el timestamp persistido sigue siendo el original.
    expect(mockStore[FIRST_OPEN_FILE]).toBe(String(T0));
  });

  it('cold start posterior: fichero existente → reutiliza el install persistido', async () => {
    mockStore[FIRST_OPEN_FILE] = String(T0); // instalado hace tiempo
    const mod = load(); // módulo fresco = "reinicio de la app"
    const days = await mod.getDaysSinceInstall(T0 + 10 * DAY);
    expect(days).toBe(10);
  });
});
