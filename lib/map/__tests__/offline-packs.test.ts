/**
 * Wrapper de packs offline. Se mockea el módulo nativo maplibre (getter para
 * poder simular su ausencia) y `EXPO_PUBLIC_TILES_URL`. Cada test de regresión
 * falla contra el pre-fix (padding del bbox, orden LRU, tileCountLimit ANTES de
 * createPack, opciones del pack, degradación sin módulo).
 */
import {
  computeBounds,
  DEFAULT_MAX_PACKS,
  deletePack,
  ensurePack,
  evictLRU,
  getOfflineManager,
  getPackStatus,
  listPacks,
  packName,
  PACK_MAX_ZOOM,
  PACK_MIN_ZOOM,
  resetOfflineManagerForTesting,
  TILE_COUNT_LIMIT,
  toCreatePackBounds,
} from '../offline-packs';

jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockManager = {
  createPack: jest.fn().mockResolvedValue(undefined),
  getPacks: jest.fn().mockResolvedValue([]),
  getPack: jest.fn().mockResolvedValue(undefined),
  deletePack: jest.fn().mockResolvedValue(undefined),
  setTileCountLimit: jest.fn(),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockCurrentManager: any = mockManager;

jest.mock('@maplibre/maplibre-react-native', () => ({
  get OfflineManager() {
    return mockCurrentManager;
  },
}));

const ENV_KEY = 'EXPO_PUBLIC_TILES_URL';
const ORIGINAL_ENV = process.env[ENV_KEY];

const fakePack = (planId: string, createdAt: number, percentage = 100) => ({
  name: packName(planId),
  metadata: { planId, createdAt },
  status: jest.fn().mockResolvedValue({
    name: packName(planId),
    state: 2,
    percentage,
    completedResourceCount: 1,
    requiredResourceCount: 1,
  }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentManager = mockManager;
  resetOfflineManagerForTesting();
  process.env[ENV_KEY] = 'https://tiles.test';
  mockManager.getPack.mockResolvedValue(undefined);
  mockManager.getPacks.mockResolvedValue([]);
});

afterAll(() => {
  if (ORIGINAL_ENV === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = ORIGINAL_ENV;
});

describe('computeBounds', () => {
  it('sin stops → null', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('aplica padding en latitud alrededor de un único stop (falla si se quita el padding)', () => {
    const b = computeBounds([{ latitude: 25.8, longitude: -80.2 }], 2)!;
    // 2 km / 111.32 km-por-grado ≈ 0.01797° de padding en latitud.
    const latPad = 2 / 111.32;
    expect(b.ne[1]).toBeCloseTo(25.8 + latPad, 5);
    expect(b.sw[1]).toBeCloseTo(25.8 - latPad, 5);
    // ne debe quedar ESTRICTAMENTE al norte del stop: sin padding serían iguales.
    expect(b.ne[1]).toBeGreaterThan(25.8);
    expect(b.sw[1]).toBeLessThan(25.8);
  });

  it('el padding en longitud se ensancha por la latitud (cos)', () => {
    const b = computeBounds([{ latitude: 60, longitude: 10 }], 2)!;
    const latPad = 2 / 111.32;
    const lngPad = 2 / (111.32 * Math.cos((60 * Math.PI) / 180));
    expect(b.ne[0]).toBeCloseTo(10 + lngPad, 4);
    // A lat 60°, el padding en longitud casi duplica al de latitud.
    expect(lngPad).toBeGreaterThan(latPad * 1.5);
  });

  it('cubre el bbox de todos los stops', () => {
    const b = computeBounds(
      [
        { latitude: 25.7, longitude: -80.3 },
        { latitude: 25.9, longitude: -80.1 },
      ],
      0,
    )!;
    expect(b.sw).toEqual([-80.3, 25.7]);
    expect(b.ne).toEqual([-80.1, 25.9]);
  });

  it('recorta a la latitud máxima de web-mercator (±85°)', () => {
    const b = computeBounds([{ latitude: 84.99, longitude: 0 }], 50)!;
    expect(b.ne[1]).toBeLessThanOrEqual(85);
  });
});

describe('toCreatePackBounds', () => {
  it('ne/sw → [[neLng,neLat],[swLng,swLat]]', () => {
    expect(toCreatePackBounds({ ne: [-80.1, 25.9], sw: [-80.3, 25.7] })).toEqual([
      [-80.1, 25.9],
      [-80.3, 25.7],
    ]);
  });
});

describe('ensurePack', () => {
  const bounds = { ne: [-80.1, 25.9] as [number, number], sw: [-80.3, 25.7] as [number, number] };

  it('crea el pack con tileCountLimit ANTES de createPack y opciones z0-15 correctas', async () => {
    const result = await ensurePack('plan42', bounds);
    expect(result).toBe('created');

    expect(mockManager.setTileCountLimit).toHaveBeenCalledWith(TILE_COUNT_LIMIT);
    expect(mockManager.createPack).toHaveBeenCalledTimes(1);

    // Orden: setTileCountLimit se invoca ANTES que createPack.
    const limitOrder = mockManager.setTileCountLimit.mock.invocationCallOrder[0];
    const createOrder = mockManager.createPack.mock.invocationCallOrder[0];
    expect(limitOrder).toBeLessThan(createOrder);

    const [options] = mockManager.createPack.mock.calls[0];
    expect(options).toMatchObject({
      name: 'plan-plan42',
      styleURL: 'https://tiles.test/styles/miami-light.json',
      bounds: [
        [-80.1, 25.9],
        [-80.3, 25.7],
      ],
      minZoom: PACK_MIN_ZOOM,
      maxZoom: PACK_MAX_ZOOM,
    });
    expect(options.metadata.planId).toBe('plan42');
    expect(typeof options.metadata.createdAt).toBe('number');
  });

  it('idempotente: si el pack ya existe NO llama createPack y re-suscribe', async () => {
    mockManager.getPack.mockResolvedValue(fakePack('plan42', 1000));
    const result = await ensurePack('plan42', bounds);
    expect(result).toBe('exists');
    expect(mockManager.createPack).not.toHaveBeenCalled();
    expect(mockManager.subscribe).toHaveBeenCalledWith('plan-plan42', expect.any(Function), expect.any(Function));
  });

  it('sin EXPO_PUBLIC_TILES_URL → "disabled", sin tocar el manager', async () => {
    delete process.env[ENV_KEY];
    const result = await ensurePack('plan42', bounds);
    expect(result).toBe('disabled');
    expect(mockManager.createPack).not.toHaveBeenCalled();
    expect(mockManager.setTileCountLimit).not.toHaveBeenCalled();
  });

  it('sin módulo nativo → "unavailable", degrada sin lanzar', async () => {
    mockCurrentManager = undefined;
    resetOfflineManagerForTesting();
    expect(getOfflineManager()).toBeNull();
    await expect(ensurePack('plan42', bounds)).resolves.toBe('unavailable');
  });

  it('createPack que lanza → "error" contenido (fallback a online)', async () => {
    mockManager.createPack.mockRejectedValueOnce(new Error('tile limit'));
    await expect(ensurePack('plan42', bounds)).resolves.toBe('error');
  });
});

describe('listPacks', () => {
  it('solo devuelve nuestros packs (plan-*) con planId/createdAt de metadata', async () => {
    mockManager.getPacks.mockResolvedValue([
      fakePack('a', 100),
      fakePack('b', 200),
      { name: 'someone-elses-pack', metadata: null, status: jest.fn() },
    ]);
    const packs = await listPacks();
    expect(packs).toHaveLength(2);
    expect(packs.map((p) => p.planId)).toEqual(['a', 'b']);
    expect(packs[0].createdAt).toBe(100);
  });

  it('sin módulo → []', async () => {
    mockCurrentManager = undefined;
    resetOfflineManagerForTesting();
    expect(await listPacks()).toEqual([]);
  });
});

describe('deletePack', () => {
  it('borra por nombre canónico plan-<id>', async () => {
    await deletePack('xyz');
    expect(mockManager.deletePack).toHaveBeenCalledWith('plan-xyz');
  });
});

describe('getPackStatus', () => {
  it('devuelve el status del pack existente', async () => {
    mockManager.getPack.mockResolvedValue(fakePack('a', 100, 42));
    const st = await getPackStatus('a');
    expect(st?.percentage).toBe(42);
  });

  it('null si el pack no existe', async () => {
    mockManager.getPack.mockResolvedValue(undefined);
    expect(await getPackStatus('a')).toBeNull();
  });
});

describe('evictLRU', () => {
  it('conserva los N más nuevos y borra los más viejos por createdAt (falla si se invierte el orden)', async () => {
    // Desordenados a propósito; el más viejo es createdAt=100 (plan "old").
    mockManager.getPacks.mockResolvedValue([
      fakePack('mid', 200),
      fakePack('new', 300),
      fakePack('old', 100),
      fakePack('newest', 400),
    ]);
    const deleted = await evictLRU(DEFAULT_MAX_PACKS); // cap 3 → borra 1 (el más viejo)
    expect(deleted).toEqual(['plan-old']);
    expect(mockManager.deletePack).toHaveBeenCalledTimes(1);
    expect(mockManager.deletePack).toHaveBeenCalledWith('plan-old');
  });

  it('NUNCA borra el pack del plan activo aunque sea el más viejo (keepPlanId)', async () => {
    // El plan activo ("active") es el más viejo por createdAt. Sin la
    // protección, con cap 3 y 4 packs, evictLRU borraría justo el que se acaba
    // de abrir. Con keepPlanId debe evicar el siguiente más viejo (plan-b).
    mockManager.getPacks.mockResolvedValue([
      fakePack('active', 1),
      fakePack('b', 2),
      fakePack('c', 3),
      fakePack('d', 4),
    ]);
    const deleted = await evictLRU(DEFAULT_MAX_PACKS, 'active');
    expect(deleted).toEqual(['plan-b']);
    expect(deleted).not.toContain('plan-active');
    expect(mockManager.deletePack).not.toHaveBeenCalledWith('plan-active');
    expect(mockManager.deletePack).toHaveBeenCalledWith('plan-b');
  });

  it('no borra nada si hay <= maxPacks', async () => {
    mockManager.getPacks.mockResolvedValue([fakePack('a', 1), fakePack('b', 2)]);
    expect(await evictLRU(3)).toEqual([]);
    expect(mockManager.deletePack).not.toHaveBeenCalled();
  });

  it('borra los 2 más viejos cuando sobran 2', async () => {
    mockManager.getPacks.mockResolvedValue([
      fakePack('a', 10),
      fakePack('b', 20),
      fakePack('c', 30),
      fakePack('d', 40),
      fakePack('e', 50),
    ]);
    const deleted = await evictLRU(3);
    expect(deleted).toEqual(['plan-a', 'plan-b']);
  });
});
