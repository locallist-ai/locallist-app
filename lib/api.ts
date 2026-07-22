import * as SecureStore from './safe-store';
import { Platform } from 'react-native';
import { logger } from './logger';
import { trackPlanLimitIfGate403 } from './analytics';
import i18n from './i18n';
import type {
  ChatTurnRequest, ChatTurnResponse,
  ChatGenerateRequest, BuilderResponse,
  UserProfile, UpsertProfileRequest,
  LiveCity,
} from './types';

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
  options: { method?: string; body?: unknown; signal?: AbortSignal; _retryCount?: number } = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, signal, _retryCount = 0 } = options;

  // Ensure token is loaded before first request
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': i18n.language || 'en',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // El controller interno gestiona el timeout; un `signal` externo del caller
  // (p. ej. cleanup de un useEffect) también lo aborta.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', onExternalAbort);

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
        return api<T>(path, { method, body, signal, _retryCount: _retryCount + 1 });
      }
    }

    if (!res.ok) {
      // Funnel de upsell: un 403 estructurado de un gate Plus emite plan_limit_hit.
      trackPlanLimitIfGate403(res.status, json);
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
    const isAbort = err instanceof Error && err.name === 'AbortError';
    // Un abort externo (caller desmontado) no es un fallo: no lo logueamos como error.
    if (signal?.aborted) {
      return { data: null, error: 'Request aborted', errorBody: null, status: 0 };
    }
    logger.error('API request failed', err);
    return {
      data: null,
      error: isAbort ? 'Request timed out' : message,
      errorBody: null,
      status: 0,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
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

// ─── Chat API ─────────────────────────────────────────────────────────────────

export async function chatTurn(req: ChatTurnRequest) {
  return api<ChatTurnResponse>('/chat/turn', { method: 'POST', body: req });
}

export async function chatGenerate(req: ChatGenerateRequest) {
  return api<BuilderResponse>('/chat/generate', { method: 'POST', body: req });
}

export async function deleteChatSession(sessionId: string) {
  return api<void>(`/chat/session/${sessionId}`, { method: 'DELETE' });
}

// ─── Cities API ──────────────────────────────────────────────────────────────

/**
 * Ciudades LIVE (allowlist de cobertura del backend). La app pinta el selector
 * solo con estas; no usar `/cities/search` (registry completo) para el gate.
 */
export async function getLiveCities(signal?: AbortSignal) {
  return api<{ cities: LiveCity[] }>('/cities/live', { signal });
}

// ─── Profile API ─────────────────────────────────────────────────────────────

export async function getProfile() {
  return api<UserProfile>('/me/profile');
}

export async function upsertProfile(req: UpsertProfileRequest) {
  return api<UserProfile>('/me/profile', { method: 'PUT', body: req });
}

export async function deleteProfile() {
  return api<void>('/me/profile', { method: 'DELETE' });
}
