import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getDeviceId } from './device';

function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // Android emulator uses 10.0.2.2 to reach host machine's localhost
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

const API_URL = getApiUrl();

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  errorBody: Record<string, unknown> | null;
  status: number;
}

async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('ll_access_token')
      : null;
  }
  return SecureStore.getItemAsync('ll_access_token');
}

async function setTokens(access: string, refresh: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem('ll_access_token', access);
    localStorage.setItem('ll_refresh_token', refresh);
    return;
  }
  await SecureStore.setItemAsync('ll_access_token', access);
  await SecureStore.setItemAsync('ll_refresh_token', refresh);
}

async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem('ll_access_token');
    localStorage.removeItem('ll_refresh_token');
    return;
  }
  await SecureStore.deleteItemAsync('ll_access_token');
  await SecureStore.deleteItemAsync('ll_refresh_token');
}

async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('ll_refresh_token')
      : null;
  }
  return SecureStore.getItemAsync('ll_refresh_token');
}

/** Try to refresh the access token using the stored refresh token */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
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
  }
}

/** Typed API fetch wrapper with automatic token refresh */
export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Always send device ID for anonymous rate limiting
  const deviceId = await getDeviceId();
  headers['X-Device-Id'] = deviceId;

  if (auth) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const fetchOptions: RequestInit = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    let res = await fetch(`${API_URL}${path}`, fetchOptions);

    // If 401 and we have a refresh token, try to refresh
    if (res.status === 401 && auth) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        const newToken = await getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
        }
      }
    }

    const json = await res.json().catch(() => null);
    const data = res.ok ? json : null;
    const errorBody = res.ok ? null : json;
    const error = res.ok ? null : json?.error ?? 'Request failed';

    return { data, error, errorBody, status: res.status };
  } catch {
    // Network error (no connection, DNS failure, etc.)
    return { data: null, error: 'Unable to connect to server', errorBody: null, status: 0 };
  }
}

export { setTokens, clearTokens, getAccessToken, API_URL };
