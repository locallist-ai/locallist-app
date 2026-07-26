/**
 * Tests de `lib/favorites-store` — cache module-level del Set de ids + hook
 * `useFavorites` con toggle optimista.
 *
 * Cubre:
 *  (a) toggle optimista + revert cuando la API falla.
 *  (b) invitado: NO llama a la API, presenta el gate de signup y guarda un
 *      pending intent que se aplica tras login (`applyPendingFavorite`).
 *  (c) 403 favorites_limit_reached: revert + `favorites_limit_hit` + upsell.
 *  (d) loadFavoriteIds hidrata el set; clearFavorites lo vacía (logout).
 *
 * `../auth` y `../useGateHandler` se mockean (evita el ciclo de import y el
 * wiring de router/native); `gate-errors` queda REAL (mapeo puro).
 */
import { renderHook, act } from '@testing-library/react-native';
import {
  useFavorites,
  loadFavoriteIds,
  clearFavorites,
  applyPendingFavorite,
  getPendingFavorite,
  isFavoriteSync,
} from '../favorites-store';
import { putFavorite, deleteFavorite, getFavoriteIds } from '../api';
import { track } from '../analytics';

const mockPresentGate = jest.fn();

jest.mock('../api', () => ({
  putFavorite: jest.fn(),
  deleteFavorite: jest.fn(),
  getFavoriteIds: jest.fn(),
}));
jest.mock('../analytics', () => ({ track: jest.fn() }));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockUseAuth = jest.fn();
jest.mock('../auth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../useGateHandler', () => ({
  useGateHandler: () => ({ presentGate: mockPresentGate, presentClamped: jest.fn() }),
}));

const mockPut = putFavorite as jest.Mock;
const mockDelete = deleteFavorite as jest.Mock;
const mockGetIds = getFavoriteIds as jest.Mock;
const mockTrack = track as jest.Mock;

type ApiRes = { data: null; error: string | null; errorBody: unknown; status: number };
const ok = (status = 200): ApiRes => ({ data: null, error: null, errorBody: null, status });
const fail = (status: number, errorBody: unknown = null): ApiRes => ({
  data: null,
  error: 'x',
  errorBody,
  status,
});

/** Deferred para controlar el momento de resolución de la API en el toggle. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearFavorites();
  mockUseAuth.mockReturnValue({ isAuthenticated: true });
});

describe('useFavorites.toggle (autenticado)', () => {
  it('(a) añade optimista y revierte cuando el PUT falla', async () => {
    const d = deferred<ApiRes>();
    mockPut.mockReturnValue(d.promise);

    const { result } = renderHook(() => useFavorites());

    let togglePromise: Promise<void>;
    act(() => {
      togglePromise = result.current.toggle('p1', 'card');
    });

    // Optimista: el corazón se pinta relleno antes de que responda la API.
    expect(result.current.ids.has('p1')).toBe(true);
    expect(mockPut).toHaveBeenCalledWith('p1');

    await act(async () => {
      d.resolve(fail(500));
      await togglePromise;
    });

    // Revert: sin persistencia, el id sale del set.
    expect(result.current.ids.has('p1')).toBe(false);
    // Un fallo genérico no emite evento de éxito.
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('añade con éxito: emite favorite_added y conserva el id', async () => {
    mockPut.mockResolvedValue(ok(200));
    const { result } = renderHook(() => useFavorites());

    await act(async () => { await result.current.toggle('p2', 'place_detail'); });

    expect(result.current.ids.has('p2')).toBe(true);
    expect(mockTrack).toHaveBeenCalledWith({ event: 'favorite_added', source: 'place_detail' });
  });

  it('quita con éxito (DELETE 204): emite favorite_removed y retira el id', async () => {
    // Semilla: el id ya está en el set.
    mockGetIds.mockResolvedValue({ data: { ids: ['p3'] }, error: null, status: 200 });
    await act(async () => { await loadFavoriteIds(); });

    mockDelete.mockResolvedValue(ok(204));
    const { result } = renderHook(() => useFavorites());
    expect(result.current.ids.has('p3')).toBe(true);

    await act(async () => { await result.current.toggle('p3', 'list'); });

    expect(mockDelete).toHaveBeenCalledWith('p3');
    expect(result.current.ids.has('p3')).toBe(false);
    expect(mockTrack).toHaveBeenCalledWith({ event: 'favorite_removed', source: 'list' });
  });

  it('(c) 403 favorites_limit_reached: revert + favorites_limit_hit + upsell', async () => {
    mockPut.mockResolvedValue(
      fail(403, { error: 'favorites_limit_reached', used: 50, limit: 50 }),
    );
    const { result } = renderHook(() => useFavorites());

    await act(async () => { await result.current.toggle('p4', 'card'); });

    // Revert (no se guardó).
    expect(result.current.ids.has('p4')).toBe(false);
    expect(mockTrack).toHaveBeenCalledWith({ event: 'favorites_limit_hit' });
    // El gate recibe la acción de upsell mapeada por gate-errors (real).
    expect(mockPresentGate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'upsell', code: 'favorites_limit_reached', limit: 50 }),
    );
  });
});

describe('useFavorites.toggle (invitado) + pending intent', () => {
  it('(b) NO llama a la API, presenta el gate de signup y guarda el pending; se aplica tras login', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    const { result } = renderHook(() => useFavorites());

    await act(async () => { await result.current.toggle('p5', 'place_detail'); });

    // Sin llamada a la API.
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    // Gate de signup presentado.
    expect(mockPresentGate).toHaveBeenCalledWith({ type: 'signup_required' });
    // Pending intent registrado (el último gana).
    expect(getPendingFavorite()).toBe('p5');

    // Tras login: se aplica el favorito pendiente vía PUT y se limpia.
    mockPut.mockResolvedValue(ok(200));
    await act(async () => { await applyPendingFavorite(); });

    expect(mockPut).toHaveBeenCalledWith('p5');
    expect(isFavoriteSync('p5')).toBe(true);
    expect(getPendingFavorite()).toBeNull();
  });

  it('applyPendingFavorite es no-op sin pending', async () => {
    await act(async () => { await applyPendingFavorite(); });
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('un fallo del pending se descarta en silencio (sin throw, sin id)', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    const { result } = renderHook(() => useFavorites());
    await act(async () => { await result.current.toggle('p6', 'card'); });

    mockPut.mockResolvedValue(fail(404));
    await act(async () => { await applyPendingFavorite(); });

    expect(isFavoriteSync('p6')).toBe(false);
    expect(getPendingFavorite()).toBeNull();
  });
});

describe('lifecycle', () => {
  it('(d) loadFavoriteIds hidrata el set; clearFavorites lo vacía', async () => {
    mockGetIds.mockResolvedValue({ data: { ids: ['a', 'b'] }, error: null, status: 200 });
    const { result } = renderHook(() => useFavorites());

    await act(async () => { await loadFavoriteIds(); });
    expect(result.current.ids.has('a')).toBe(true);
    expect(result.current.ids.has('b')).toBe(true);
    expect(result.current.loaded).toBe(true);

    act(() => { clearFavorites(); });
    expect(result.current.ids.size).toBe(0);
    expect(result.current.loaded).toBe(false);
  });
});
