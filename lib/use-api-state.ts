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
  /** Salta el fetch automático (ej. cache fresca). `refresh()` sigue funcionando. */
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
 * - En fallo con data previa (cache o fetch anterior) se conserva la data y
 *   `error` no se setea: stale-while-revalidate silencioso.
 * - En fallo sin data, `error` recibe el mensaje del client.
 * - `refresh()` re-ejecuta el fetcher y expone `refreshing` (pull-to-refresh).
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

  const dataRef = useRef<T | null>(initialData ?? null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyResult = useCallback((res: ApiStateResult<T>) => {
    if (!mountedRef.current) return;
    if (res.data !== null) {
      dataRef.current = res.data;
      setData(res.data);
      setError(null);
    } else if (dataRef.current === null) {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(dataRef.current === null);
    (async () => {
      const res = await fetcherRef.current();
      if (stale) return;
      applyResult(res);
      if (mountedRef.current) setLoading(false);
    })();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, applyResult, ...deps]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetcherRef.current();
      applyResult(res);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [applyResult]);

  return { data, loading, refreshing, error, refresh };
}
