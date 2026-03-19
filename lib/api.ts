import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { logger } from './logger';

function getApiUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("CRITICAL: EXPO_PUBLIC_API_URL is missing. Check your .env file or EAS Build configuration.");
  }

  return apiUrl;
}

const API_URL = getApiUrl();

// ─── Token storage ───────────────────────────────────────
// Uses SecureStore on native (encrypted keychain) and localStorage on web.
// In-memory `accessToken` avoids async reads on every request.

let accessToken: string | null = null;
let tokenLoadPromise: Promise<void> | null = null;

const TOKEN_KEY = 'locallist_access_token';
const REFRESH_KEY = 'locallist_refresh_token';

async function loadTokens() {
  if (Platform.OS === 'web') {
    accessToken = localStorage.getItem(TOKEN_KEY);
  } else {
    accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
  }
}

export async function setTokens(access: string, refresh?: string) {
  accessToken = access;
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, access);
    if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  }
}

export async function clearTokens() {
  accessToken = null;
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }
}

export async function getAccessToken(): Promise<string | null> {
  // Ensure tokens are loaded before returning
  if (tokenLoadPromise) await tokenLoadPromise;
  return accessToken;
}

async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(REFRESH_KEY);
  }
  return SecureStore.getItemAsync(REFRESH_KEY);
}

// Init tokens on load — store the promise so callers can await it
tokenLoadPromise = loadTokens().finally(() => {
  tokenLoadPromise = null;
});

// ─── API client ──────────────────────────────────────────

/**
 * Error-as-value pattern: every API call returns `{ data, error, status }` instead of
 * throwing, so callers handle errors explicitly without try/catch boilerplate.
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
  options: { method?: string; body?: unknown; _retryCount?: number } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, _retryCount = 0 } = options;

  // Ensure token is loaded before first request
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

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

    // Auto-refresh on 401: if the access token expired, silently obtain a new
    // pair via the refresh token and retry the original request exactly once.
    if (res.status === 401 && token && _retryCount < 1) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return api<T>(path, { method, body, _retryCount: _retryCount + 1 });
      }
    }

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

// ─── Token refresh ──────────────────────────────────────

/** Singleton promise prevents concurrent refresh attempts (e.g., multiple 401s firing at once). */
let refreshInProgress: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await clearTokens();
        return false;
      }

      const data = await res.json();
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch (error) {
      logger.warn('Token refresh failed', error);
      return false;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}
