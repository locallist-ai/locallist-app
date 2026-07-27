/**
 * Máquina de estados del hook de pack offline. Se mockean `offline-packs` y
 * `tiles` para dirigir cada rama sin device. Cada test falla contra el pre-fix
 * (no-op cuando deshabilitado, downloading→ready por progreso, degradación a
 * idle sin infra/módulo, error + retry).
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOfflinePack } from '../useOfflinePack';
import {
  computeBounds,
  deletePack,
  ensurePack,
  evictLRU,
  getPackStatus,
  unsubscribePack,
  type PackProgressListener,
  type PackErrorListener,
} from '../../../lib/map/offline-packs';
import { tilesEnabled } from '../../../lib/map/tiles';

jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../lib/map/tiles', () => ({ tilesEnabled: jest.fn(() => true) }));
jest.mock('../../../lib/map/offline-packs', () => ({
  computeBounds: jest.fn(),
  ensurePack: jest.fn(),
  getPackStatus: jest.fn(),
  evictLRU: jest.fn(),
  deletePack: jest.fn(),
  unsubscribePack: jest.fn(),
}));

const mockTilesEnabled = tilesEnabled as jest.Mock;
const mockComputeBounds = computeBounds as jest.Mock;
const mockEnsurePack = ensurePack as jest.Mock;
const mockGetPackStatus = getPackStatus as jest.Mock;
const mockEvictLRU = evictLRU as jest.Mock;
const mockDeletePack = deletePack as jest.Mock;
const mockUnsubscribe = unsubscribePack as jest.Mock;

const STOPS = [{ latitude: 25.8, longitude: -80.2 }];
const BOUNDS = { ne: [-80.1, 25.9], sw: [-80.3, 25.7] };

let listeners: { onProgress: PackProgressListener; onError: PackErrorListener } | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitProgress = (percentage: number) => listeners!.onProgress({} as any, { percentage } as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitError = () => listeners!.onError({} as any, { name: 'e', message: 'boom' });

beforeEach(() => {
  jest.clearAllMocks();
  listeners = null;
  mockTilesEnabled.mockReturnValue(true);
  mockComputeBounds.mockReturnValue(BOUNDS);
  mockGetPackStatus.mockResolvedValue({ percentage: 100 });
  mockEvictLRU.mockResolvedValue([]);
  mockDeletePack.mockResolvedValue(undefined);
  mockEnsurePack.mockImplementation(async (_id, _b, l) => {
    listeners = l;
    return 'created';
  });
});

it('sin contexto de follow (enabled=false): idle y NO asegura pack', () => {
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, false));
  expect(result.current.status).toBe('idle');
  expect(mockEnsurePack).not.toHaveBeenCalled();
});

it('sin infra de tiles: idle y NO asegura pack (degrada a online)', () => {
  mockTilesEnabled.mockReturnValue(false);
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, true));
  expect(result.current.status).toBe('idle');
  expect(mockEnsurePack).not.toHaveBeenCalled();
});

it('sin planId: no-op idle', () => {
  const { result } = renderHook(() => useOfflinePack(undefined, STOPS, true));
  expect(result.current.status).toBe('idle');
  expect(mockEnsurePack).not.toHaveBeenCalled();
});

it('created → downloading; el progreso lleva a ready al 100%', async () => {
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, true));
  await waitFor(() => expect(mockEnsurePack).toHaveBeenCalledTimes(1));
  expect(result.current.status).toBe('downloading');

  await act(async () => {
    emitProgress(40);
  });
  expect(result.current.status).toBe('downloading');
  expect(result.current.percentage).toBe(40);

  await act(async () => {
    emitProgress(100);
  });
  expect(result.current.status).toBe('ready');
  expect(result.current.percentage).toBe(100);

  // LRU se dispara tras asegurar.
  await waitFor(() => expect(mockEvictLRU).toHaveBeenCalled());
});

it('exists + pack ya completo → ready sin esperar progreso', async () => {
  mockEnsurePack.mockResolvedValue('exists');
  mockGetPackStatus.mockResolvedValue({ percentage: 100 });
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, true));
  await waitFor(() => expect(result.current.status).toBe('ready'));
});

it('exists + descarga parcial → downloading con su porcentaje', async () => {
  mockEnsurePack.mockResolvedValue('exists');
  mockGetPackStatus.mockResolvedValue({ percentage: 55 });
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, true));
  await waitFor(() => expect(result.current.percentage).toBe(55));
  expect(result.current.status).toBe('downloading');
});

it('unavailable (sin módulo nativo) → idle (degrada a online)', async () => {
  mockEnsurePack.mockResolvedValue('unavailable');
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, true));
  await waitFor(() => expect(mockEnsurePack).toHaveBeenCalled());
  await waitFor(() => expect(result.current.status).toBe('idle'));
});

it('resultado "error" → status error', async () => {
  mockEnsurePack.mockResolvedValue('error');
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, true));
  await waitFor(() => expect(result.current.status).toBe('error'));
});

it('el errorListener marca error; retry borra el pack roto y reasegura', async () => {
  const { result } = renderHook(() => useOfflinePack('p1', STOPS, true));
  await waitFor(() => expect(mockEnsurePack).toHaveBeenCalledTimes(1));

  await act(async () => {
    emitError();
  });
  expect(result.current.status).toBe('error');

  await act(async () => {
    result.current.retry();
  });
  await waitFor(() => expect(mockEnsurePack).toHaveBeenCalledTimes(2));
  expect(mockDeletePack).toHaveBeenCalledWith('p1');
});

it('al desmontar cancela la suscripción del pack', async () => {
  const { unmount } = renderHook(() => useOfflinePack('p1', STOPS, true));
  await waitFor(() => expect(mockEnsurePack).toHaveBeenCalled());
  unmount();
  expect(mockUnsubscribe).toHaveBeenCalledWith('p1');
});
