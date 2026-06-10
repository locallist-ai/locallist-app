import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

/**
 * Resultado mínimo que necesita el hook. `ApiResult<T>` de lib/api.ts es
 * estructuralmente compatible, así que un fetcher puede ser directamente
 * `() => api<T>(path)`.
 */
export type ApiStateResult<T> = { data: T | null; error: string | null };
export type ApiStateFetcher<T> = () => Promise<ApiStateResult<T>>;

type UseApiStateOptions<T> = {
  /** Dependencias que re-disparan el fetch automático (ej. el id de la ruta). */
  deps?: DependencyList;
  /** Data inicial (ej. cache stale-while-revalidate). Evita el spinner inicial. */
  initialData?: T;
  /**
   * Salta el fetch automático inicial (ej. cache fresca). Se captura al montar:
   * un skip que cambia entre renders no dispara ni cancela refetches, y los
   * cambios de deps siempre refetchean. `refresh()` sigue funcionando.
   */
  skip?: boolean;
};

export type UseApiState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Estado de una llamada API sobre el client error-as-value de lib/api.ts.
 *
 * Semántica:
 * - `loading` cubre el fetch automático mientras no hay data que mostrar.
 * - En fallo con data previa de la MISMA key (initialData o fetch anterior) se
 *   conserva la data y `error` no se setea: stale-while-revalidate silencioso.
 * - Un cambio de deps es un cambio de key: resetea data/error, vuelve a
 *   `loading` y nunca muestra la entidad anterior si el nuevo fetch falla.
 * - En fallo sin data, `error` recibe el mensaje del client.
 * - `refresh()` re-ejecuta el fetcher y expone `refreshing` (pull-to-refresh).
 * - Fetch automático y refresh() comparten secuencia: solo se aplica el
 *   resultado del último lanzado; respuestas out-of-order, de deps anteriores
 *   o posteriores al unmount se descartan.
 */
export function useApiState<T>(
  fetcher: ApiStateFetcher<T>,
  options: UseApiStateOptions<T> = {},
): UseApiState<T> {
  const { deps = [], initialData, skip = false } = options;

  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(!skip && initialData == null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // latest-ref: el refetch lo gobierna `deps`, no la identidad del fetcher
  // (que suele ser una arrow function nueva en cada render).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // skip e initialData solo aplican al primer fetch; capturados al montar.
  const skipRef = useRef(skip);
  const dataRef = useRef<T | null>(initialData ?? null);
  const firstRunRef = useRef(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Secuencia compartida entre el fetch automático y refresh().
  const generationRef = useRef(0);

  const applyResult = useCallback((res: ApiStateResult<T>) => {
    setLoading(false);
    if (res.data !== null) {
      dataRef.current = res.data;
      setData(res.data);
      setError(null);
    } else if (dataRef.current === null) {
      setError(res.error);
    }
  }, []);

  /** Ejecuta el fetcher; devuelve null si el resultado quedó obsoleto. */
  const runFetch = useCallback(async (): Promise<ApiStateResult<T> | null> => {
    const generation = ++generationRef.current;
    const res = await fetcherRef.current();
    if (!mountedRef.current || generation !== generationRef.current) return null;
    return res;
  }, []);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      if (skipRef.current) {
        setLoading(false);
        return;
      }
    } else {
      // Cambio de deps: la data anterior pertenece a otra key (otro id) y no
      // puede quedarse como fallback silencioso si el nuevo fetch falla.
      dataRef.current = null;
      setData(null);
      setError(null);
    }
    setLoading(dataRef.current === null);
    (async () => {
      const res = await runFetch();
      if (res) applyResult(res);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await runFetch();
      if (res) applyResult(res);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [runFetch, applyResult]);

  return { data, loading, refreshing, error, refresh };
}
