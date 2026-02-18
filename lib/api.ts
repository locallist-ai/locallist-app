import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  return 'https://locallist-api-production.up.railway.app';
}

const API_URL = getApiUrl();

// ─── Token storage ───────────────────────────────────────

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

interface ApiResult<T> {
  data: T | null;
  error: string | null;
  errorBody: any;
  status: number;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: any } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body } = options;

  // Ensure token is loaded before first request
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => null);

    // Auto-refresh on 401
    if (res.status === 401 && token) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Retry the original request with new token
        return api<T>(path, options);
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
  } catch (err: any) {
    return {
      data: null,
      error: err.message ?? 'Network error',
      errorBody: null,
      status: 0,
    };
  }
}

// ─── Token refresh ──────────────────────────────────────

let refreshInProgress: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  // Prevent concurrent refresh attempts
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
    } catch {
      return false;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}
