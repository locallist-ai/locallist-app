import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useApiState, type ApiStateResult } from '../use-api-state';

const ok = <T,>(data: T): ApiStateResult<T> => ({ data, error: null });
const fail = (error: string): ApiStateResult<never> => ({ data: null, error });

describe('useApiState', () => {
  it('fetch inicial con éxito: loading → data', async () => {
    const fetcher = jest.fn(async () => ok({ name: 'Madrid' }));
    const { result } = renderHook(() => useApiState(fetcher));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ name: 'Madrid' });
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fallo sin data previa expone el error del client', async () => {
    const fetcher = jest.fn(async () => fail('HTTP 500'));
    const { result } = renderHook(() => useApiState(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('HTTP 500');
  });

  it('initialData evita el spinner y se revalida en background', async () => {
    const fetcher = jest.fn(async () => ok(['fresh']));
    const { result } = renderHook(() =>
      useApiState(fetcher, { initialData: ['cached'] }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(['cached']);

    await waitFor(() => expect(result.current.data).toEqual(['fresh']));
    expect(result.current.error).toBeNull();
  });

  it('fallo con data previa conserva la data y no setea error (SWR silencioso)', async () => {
    const fetcher = jest.fn(async () => fail('Network error'));
    const { result } = renderHook(() =>
      useApiState(fetcher, { initialData: ['cached'] }),
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(['cached']);
    expect(result.current.error).toBeNull();
  });

  it('skip no dispara el fetch automático pero refresh() sí funciona', async () => {
    const fetcher = jest.fn(async () => ok('value'));
    const { result } = renderHook(() => useApiState(fetcher, { skip: true }));

    expect(result.current.loading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('value');
  });

  it('refresh() expone refreshing mientras el fetch está in-flight', async () => {
    let resolveFetch: (value: ApiStateResult<string>) => void;
    const pending = new Promise<ApiStateResult<string>>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = jest.fn(() => pending);
    const { result } = renderHook(() => useApiState<string>(fetcher, { skip: true }));

    let refreshPromise: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      resolveFetch!(ok('done'));
      await refreshPromise!;
    });
    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toBe('done');
  });

  it('un cambio de deps re-dispara el fetch', async () => {
    const fetcher = jest.fn(async (id: string) => ok(`place-${id}`));
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useApiState(() => fetcher(id), { deps: [id] }),
      { initialProps: { id: '1' } },
    );

    await waitFor(() => expect(result.current.data).toBe('place-1'));

    rerender({ id: '2' });
    await waitFor(() => expect(result.current.data).toBe('place-2'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('al cambiar deps resetea data y muestra el error del nuevo fetch, no la entidad anterior', async () => {
    const fetcher = jest
      .fn<Promise<ApiStateResult<string>>, []>()
      .mockResolvedValueOnce(ok('place-1'))
      .mockResolvedValueOnce(fail('HTTP 404'));
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useApiState(fetcher, { deps: [id] }),
      { initialProps: { id: '1' } },
    );

    await waitFor(() => expect(result.current.data).toBe('place-1'));

    rerender({ id: '2' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.error).toBe('HTTP 404'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('descarta respuestas out-of-order de deps anteriores', async () => {
    const resolvers: Record<string, (r: ApiStateResult<string>) => void> = {};
    const fetcher = (id: string) =>
      new Promise<ApiStateResult<string>>((resolve) => {
        resolvers[id] = resolve;
      });
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useApiState(() => fetcher(id), { deps: [id] }),
      { initialProps: { id: '1' } },
    );

    // El fetch de id=1 sigue en vuelo cuando cambian las deps.
    rerender({ id: '2' });

    await act(async () => {
      resolvers['2'](ok('place-2'));
    });
    await waitFor(() => expect(result.current.data).toBe('place-2'));

    // La respuesta de id=1 llega tarde: se descarta.
    await act(async () => {
      resolvers['1'](ok('place-1'));
    });
    expect(result.current.data).toBe('place-2');
    expect(result.current.error).toBeNull();
  });

  it('refresh concurrente: se aplica el último lanzado, el anterior se descarta', async () => {
    const resolvers: ((r: ApiStateResult<string>) => void)[] = [];
    const fetcher = jest.fn(
      () =>
        new Promise<ApiStateResult<string>>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { result } = renderHook(() => useApiState<string>(fetcher, { skip: true }));

    let first: Promise<void>;
    let second: Promise<void>;
    act(() => {
      first = result.current.refresh();
    });
    act(() => {
      second = result.current.refresh();
    });

    // El segundo refresh resuelve primero y se aplica.
    await act(async () => {
      resolvers[1](ok('second'));
      await second!;
    });
    expect(result.current.data).toBe('second');

    // El primero llega tarde: no pisa al más nuevo.
    await act(async () => {
      resolvers[0](ok('first'));
      await first!;
    });
    expect(result.current.data).toBe('second');
    expect(result.current.refreshing).toBe(false);
  });

  it('unmount con fetch en vuelo no aplica estado ni rompe', async () => {
    let resolveFetch: (r: ApiStateResult<string>) => void;
    const fetcher = jest.fn(
      () =>
        new Promise<ApiStateResult<string>>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useApiState<string>(fetcher));

    expect(result.current.loading).toBe(true);
    unmount();

    await act(async () => {
      resolveFetch!(ok('late'));
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('un refresh() con éxito tras un fallo limpia el error', async () => {
    const fetcher = jest
      .fn<Promise<ApiStateResult<string>>, []>()
      .mockResolvedValueOnce(fail('HTTP 503'))
      .mockResolvedValueOnce(ok('recovered'));
    const { result } = renderHook(() => useApiState(fetcher));

    await waitFor(() => expect(result.current.error).toBe('HTTP 503'));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('recovered');
  });
});
