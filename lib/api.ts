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
  Plan, PlanDetailResponse,
  FavoritesResponse, FavoriteIdsResponse,
  ImportVideoResponse, ImportPlanRequest,
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

/**
 * Señal de demanda de una ciudad no cubierta ("pide tu ciudad"). El endpoint es
 * `[AllowAnonymous]` (adjunta el JWT si hay sesión → atribuye al usuario, si no
 * anónimo). 201 creado / 200 dedup idempotente (ambos `{ message }`); errores
 * 400 estructurados `{ error: 'city_required' | 'city_too_long' | 'city_invalid' }`;
 * 429 si supera el rate limit (5/min/IP). El caller valida en cliente antes.
 */
export async function requestCity(city: string) {
  return api<{ message: string }>('/cities/request', { method: 'POST', body: { city } });
}

// ─── Plans API ───────────────────────────────────────────────────────────────

/**
 * Showcase (curated) plans, optionally narrowed to a city. Anonymous-friendly
 * (`showcase=true` is public), used by the onboarding value-preview screen and
 * the Plans tab. Returns the list only — fetch `/plans/:id` for stops.
 */
export async function getShowcasePlans(city?: string, signal?: AbortSignal) {
  const q = city ? `&city=${encodeURIComponent(city)}` : '';
  return api<{ plans: Plan[] }>(`/plans?showcase=true${q}`, { signal });
}

/** Full plan detail (days + stops + places). Anonymous-friendly for showcase plans. */
export async function getPlanDetail(id: string, signal?: AbortSignal) {
  return api<PlanDetailResponse>(`/plans/${id}`, { signal });
}

// ─── Plan clone ("save this plan", onboarding hook) ────────────────────────────
// Contract (backend feat/clone-plan, in review):
//   POST /plans/{id}/clone  [Authorize App]
//     → 200 PlanDetailResponse of a PRIVATE copy owned by the caller (source=cloned)
//     · 401 for an anonymous caller
//     · 403 { error:'saved_plans_limit_reached', ... } when a free user is at the cap
//   Idempotent: cloning the SAME source twice returns the SAME plan (no duplicate).
// LAUNCH LIMITATION (documented, not resolved): the showcase plans are all Miami,
// so the clone is always a Miami plan. Acceptable for the Miami-only launch.
export async function clonePlan(planId: string) {
  return api<PlanDetailResponse>(`/plans/${planId}/clone`, { method: 'POST' });
}

// ─── Plan sharing (Social S1) ──────────────────────────────────────────────────
// Contract (backend en despliegue):
//   POST   /plans/{id}/share  → 200 { shareToken, visibility } · OWNER-only, idempotente
//                               (private→unlisted; segunda llamada devuelve el mismo token) · 404 si no owner
//   DELETE /plans/{id}/share  → revoca (unlisted→private); el enlace deja de resolver · 404 si no owner
// El enlace canónico compartible: https://locallist.ai/p/{shareToken} (universal
// links de Apple vendrán después; hoy el enlace es el artefacto compartible).

export interface SharePlanResponse {
  shareToken: string;
  visibility: string;
}

export async function sharePlan(planId: string) {
  return api<SharePlanResponse>(`/plans/${planId}/share`, { method: 'POST' });
}

export async function unsharePlan(planId: string) {
  return api<void>(`/plans/${planId}/share`, { method: 'DELETE' });
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

// ─── Favorites API ─────────────────────────────────────────────────────────────
// Contract (backend already on main):
//   PUT    /favorites/{placeId}  → 200 · 401 (guest) · 403 { error:'favorites_limit_reached', used, limit } · 404 (place not published)
//   DELETE /favorites/{placeId}  → 204 (idempotent)
//   GET    /favorites?limit&offset → { places: PlaceDto[] (proxy photos), total } (created_at DESC)
//   GET    /favorites/ids        → { ids: string[] } to paint hearts
// The guest (401) case never reaches the network — callers gate signup first.

export async function putFavorite(placeId: string) {
  return api<void>(`/favorites/${placeId}`, { method: 'PUT' });
}

export async function deleteFavorite(placeId: string) {
  return api<void>(`/favorites/${placeId}`, { method: 'DELETE' });
}

export async function getFavorites(limit: number, offset: number, signal?: AbortSignal) {
  return api<FavoritesResponse>(`/favorites?limit=${limit}&offset=${offset}`, { signal });
}

export async function getFavoriteIds(signal?: AbortSignal) {
  return api<FavoriteIdsResponse>('/favorites/ids', { signal });
}

// ─── Import from video ─────────────────────────────────────────────────────────
// The multipart upload can't ride the JSON `api()` helper, but it MUST reuse its
// auth: `getAccessToken` (in-memory token) + a single silent refresh on 401 via
// `tryRefreshToken`. We use XMLHttpRequest (not fetch) purely to surface upload
// progress — RN's fetch has no progress events. `/import/plan` is plain JSON and
// goes through `api()` unchanged.

/**
 * One budget for upload + server-side extraction. 240s: a 150 MB video on a
 * slow mobile uplink can easily spend >120s in transfer alone before the
 * backend even starts analysing.
 */
const UPLOAD_TIMEOUT_MS = 240_000;

export interface ImportVideoUpload {
  fileUri: string;
  fileName: string;
  mimeType: string;
  /** Always 'self' from the app (v1 = own content only). */
  platform?: string;
  creatorHandle?: string;
  /** Upload progress as a 0..1 fraction. */
  onProgress?: (fraction: number) => void;
  /**
   * Caller-side cancellation (e.g. the screen unmounting mid-upload): aborting
   * kills the XHR so a 150 MB transfer never keeps burning data for a screen
   * nobody is looking at. Resolves `{ status: 0, error: 'Request aborted' }`.
   */
  signal?: AbortSignal;
  _retryCount?: number;
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Upload a video for place extraction. Returns the same `{ data, error,
 * errorBody, status }` shape as `api()` so callers can run the response through
 * `mapGateError` exactly like every other gated endpoint.
 */
export async function importVideo(opts: ImportVideoUpload): Promise<ApiResult<ImportVideoResponse>> {
  const {
    fileUri, fileName, mimeType,
    platform = 'self', creatorHandle,
    onProgress, signal, _retryCount = 0,
  } = opts;

  const token = await getAccessToken();

  // Aborted while we awaited the token: never open the XHR at all.
  if (signal?.aborted) {
    return { data: null, error: 'Request aborted', errorBody: null, status: 0 };
  }

  let query = `platform=${encodeURIComponent(platform)}`;
  if (creatorHandle) query += `&creatorHandle=${encodeURIComponent(creatorHandle)}`;

  const form = new FormData();
  // RN's FormData accepts a { uri, name, type } file part; the type cast keeps
  // TypeScript happy (the DOM FormData typings don't model the RN file shape).
  form.append('file', { uri: fileUri, name: fileName, type: mimeType } as unknown as Blob);

  const result = await new Promise<ApiResult<ImportVideoResponse>>((resolve) => {
    const xhr = new XMLHttpRequest();

    // Settle exactly once: after an abort, any late onload/onerror/ontimeout
    // from the dying request must be ignored, and the signal listener removed.
    let settled = false;
    const onExternalAbort = () => xhr.abort();
    const finish = (r: ApiResult<ImportVideoResponse>) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onExternalAbort);
      resolve(r);
    };

    xhr.open('POST', `${API_URL}/import/video?${query}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept-Language', i18n.language || 'en');
    // Deliberately NO Content-Type: RN sets the multipart boundary itself.
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (settled) return;
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      const json = parseJsonSafe(xhr.responseText);
      if (xhr.status < 200 || xhr.status >= 300) {
        trackPlanLimitIfGate403(xhr.status, json);
        finish({
          data: null,
          error: (json as { error?: string } | null)?.error ?? `HTTP ${xhr.status}`,
          errorBody: json,
          status: xhr.status,
        });
      } else {
        finish({ data: json as ImportVideoResponse, error: null, errorBody: null, status: xhr.status });
      }
    };
    xhr.onabort = () => finish({ data: null, error: 'Request aborted', errorBody: null, status: 0 });
    xhr.onerror = () => finish({ data: null, error: 'Network error', errorBody: null, status: 0 });
    xhr.ontimeout = () => finish({ data: null, error: 'Request timed out', errorBody: null, status: 0 });

    signal?.addEventListener('abort', onExternalAbort);
    xhr.send(form);
  });

  // Auto-refresh on 401 once, mirroring `api()`: an expired access token gets a
  // fresh pair via the refresh token and the upload retries exactly once. Never
  // retry an aborted upload.
  if (result.status === 401 && token && _retryCount < 1 && !signal?.aborted) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return importVideo({ ...opts, _retryCount: _retryCount + 1 });
  }

  return result;
}

/** Create a private plan from the selected matched places (JSON, gated). */
export async function createImportPlan(req: ImportPlanRequest) {
  return api<PlanDetailResponse>('/import/plan', { method: 'POST', body: req });
}
