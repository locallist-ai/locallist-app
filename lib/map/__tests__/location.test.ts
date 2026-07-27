import { acquireLocation, type Coordinate, type LocationModuleLike } from '../location';

describe('acquireLocation (degradación por permiso)', () => {
  it('módulo nulo (binario sin expo-location) -> unavailable, sin watch', async () => {
    const onCoordinate = jest.fn();
    const result = await acquireLocation(null, onCoordinate);
    expect(result.status).toBe('unavailable');
    expect(result.subscription).toBeNull();
    expect(onCoordinate).not.toHaveBeenCalled();
  });

  it('permiso DENEGADO -> denied y el watcher NUNCA arranca', async () => {
    const watchPositionAsync = jest.fn();
    const module: LocationModuleLike = {
      requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
      watchPositionAsync,
    };

    const result = await acquireLocation(module, jest.fn());

    expect(result.status).toBe('denied');
    expect(result.subscription).toBeNull();
    // Clave: sin permiso NO se pide ubicación (mutación: quitar el guard lo rompe).
    expect(watchPositionAsync).not.toHaveBeenCalled();
  });

  it('permiso CONCEDIDO -> granted, arranca el watcher y propaga coordenadas', async () => {
    const remove = jest.fn();
    let emitted: ((loc: { coords: Coordinate }) => void) | undefined;
    const watchPositionAsync = jest.fn(
      async (_opts: unknown, cb: (loc: { coords: Coordinate }) => void) => {
        emitted = cb;
        return { remove };
      },
    );
    const module: LocationModuleLike = {
      requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      watchPositionAsync,
      Accuracy: { Balanced: 3 },
    };
    const onCoordinate = jest.fn();

    const result = await acquireLocation(module, onCoordinate);

    expect(result.status).toBe('granted');
    expect(result.subscription).toEqual({ remove });
    expect(watchPositionAsync).toHaveBeenCalledTimes(1);
    // Usa la precisión Balanced del módulo.
    expect(watchPositionAsync.mock.calls[0][0]).toMatchObject({ accuracy: 3 });

    // Una actualización de posición llega al callback.
    emitted?.({ coords: { latitude: 1, longitude: 2 } });
    expect(onCoordinate).toHaveBeenCalledWith({ latitude: 1, longitude: 2 });
  });
});
