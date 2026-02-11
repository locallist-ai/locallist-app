import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  MOCK_SHOWCASE_PLANS,
  MOCK_ALL_PLANS,
  getMockPlanDetail,
} from '../lib/mock-data';

const USE_MOCK = __DEV__;

/** Resolve mock data for a given API path */
function resolveMock(path: string): unknown | null {
  if (path === '/plans?showcase=true') return { plans: MOCK_SHOWCASE_PLANS };
  if (path === '/plans') return { plans: MOCK_ALL_PLANS };

  const planMatch = path.match(/^\/plans\/(.+)$/);
  if (planMatch) return getMockPlanDetail(planMatch[1]);

  return null;
}

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

    if (USE_MOCK) {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 400));
      const mock = resolveMock(path);
      setData((mock as T) ?? null);
      setError(mock ? null : 'Mock not found');
      setIsLoading(false);
      return;
    }

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
