import { getAuth } from '@react-native-firebase/auth';
import { logger } from './logger';

function getApiUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("CRITICAL: EXPO_PUBLIC_API_URL is missing. Check your .env file or EAS Build configuration.");
  }

  return apiUrl;
}

const API_URL = getApiUrl();

// ─── API client ──────────────────────────────────────────

/**
 * Error-as-value pattern: every API call returns `{ data, error, status }` instead of
 * throwing, so callers handle errors explicitly without try/catch boilerplate.
 *
 * Firebase handles token refresh automatically — `getIdToken()` returns a fresh token
 * every time (cached if not expired, refreshed if needed).
 */
const REQUEST_TIMEOUT_MS = 15_000;

interface ApiResult<T> {
  data: T | null;
  error: string | null;
  errorBody: unknown;
  status: number;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Get fresh Firebase token (auto-refreshes if expired)
  const currentUser = getAuth().currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        data: null,
        error: json?.error ?? `HTTP ${res.status}`,
        errorBody: json,
        status: res.status,
      };
    }

    return { data: json as T, error: null, errorBody: null, status: res.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    logger.error('API request failed', err);
    return {
      data: null,
      error: isTimeout ? 'Request timed out' : message,
      errorBody: null,
      status: 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}
