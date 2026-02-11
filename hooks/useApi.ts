import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/** SWR-like data fetching hook */
export function useApi<T>(path: string, options?: { auth?: boolean }): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await api<T>(path, { auth: options?.auth });
    setData(result.data);
    setError(result.error);
    setIsLoading(false);
  }, [path, options?.auth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, isLoading, refetch: fetchData };
}
