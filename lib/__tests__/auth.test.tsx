/**
 * Tests de lib/auth (AuthProvider), deps mockeadas.
 *
 * Cubre el contrato IAP del logout: cerrar sesión desvincula la identidad de
 * RevenueCat (logOutPurchases) además de limpiar tokens y estado — sin esto,
 * el siguiente usuario del mismo proceso podría comprar bajo el appUserID del
 * anterior. También cubre que un fallo del SDK no bloquea el logout.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../auth';
import { api, clearTokens } from '../api';
import { logOutPurchases } from '../purchases';

jest.mock('../api', () => ({
  api: jest.fn().mockResolvedValue({ data: null }),
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
  getAccessToken: jest.fn().mockResolvedValue(null),
}));
jest.mock('../analytics', () => ({ setAnalyticsUserId: jest.fn() }));
jest.mock('../purchases', () => ({ logOutPurchases: jest.fn() }));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockApi = api as jest.Mock;
const mockLogOutPurchases = logOutPurchases as jest.Mock;
const mockClearTokens = clearTokens as jest.Mock;

const USER = { id: 'user-1', email: 'ana@example.com', name: 'Ana', tier: 'free' as const };

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

async function renderAuthedSession() {
  const utils = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(utils.result.current.isLoading).toBe(false));
  await act(async () => {
    await utils.result.current.login(USER, 'access-token', 'refresh-token');
  });
  expect(utils.result.current.isAuthenticated).toBe(true);
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto /account no expone cuota; los tests de g3 la sobreescriben.
  mockApi.mockResolvedValue({ data: null });
});

// g3: el login interactivo puebla aiPlansMonth (antes solo lo hacía el
// auto-login de arranque, así que un free recién registrado nunca veía su cuota).
it('login puebla aiPlansMonth desde GET /account', async () => {
  mockApi.mockResolvedValue({
    data: { user: USER, aiPlansMonth: { used: 1, limit: 3, resetsAt: '2026-08-01T00:00:00Z' } },
  });
  const { result } = await renderAuthedSession();

  expect(mockApi).toHaveBeenCalledWith('/account');
  expect(result.current.aiPlansMonth).toEqual({ used: 1, limit: 3, resetsAt: '2026-08-01T00:00:00Z' });
});

// refreshAiPlansQuota es best-effort: un fallo de /account no rompe la sesión.
it('refreshAiPlansQuota traga errores de /account (best-effort)', async () => {
  const { result } = await renderAuthedSession();
  mockApi.mockRejectedValueOnce(new Error('network blip'));

  await act(async () => {
    await result.current.refreshAiPlansQuota();
  });

  expect(result.current.isAuthenticated).toBe(true);
});

it('logout desvincula la identidad de RevenueCat además de limpiar tokens y usuario', async () => {
  const { result } = await renderAuthedSession();

  await act(async () => {
    await result.current.logout();
  });

  expect(mockLogOutPurchases).toHaveBeenCalledTimes(1);
  expect(mockClearTokens).toHaveBeenCalledTimes(1);
  expect(result.current.user).toBeNull();
  expect(result.current.isAuthenticated).toBe(false);
});

// Orden del logout: la sesión muere y RC se desvincula en el MISMO bloque
// síncrono, antes de cualquier await. Si hubiera un await en medio, un handler
// de foreground (usePurchaseReconciliation) podría colarse con la sesión aún
// "viva" y re-adoptar la identidad RC recién desvinculada.
it('logout mata la sesión y desvincula RC antes de cualquier await (sin ventana para handlers)', async () => {
  const { result } = await renderAuthedSession();
  let releaseClearTokens!: () => void;
  mockClearTokens.mockImplementationOnce(
    () => new Promise<void>((resolve) => { releaseClearTokens = resolve; }),
  );

  let logoutPromise!: Promise<void>;
  act(() => {
    logoutPromise = result.current.logout();
  });

  // clearTokens sigue colgado: la sesión ya murió y RC ya está desvinculado.
  expect(result.current.user).toBeNull();
  expect(result.current.isAuthenticated).toBe(false);
  expect(mockLogOutPurchases).toHaveBeenCalledTimes(1);

  releaseClearTokens();
  await act(async () => {
    await logoutPromise;
  });
});

it('si logOutPurchases lanzara (rotura de su contrato), el logout completa la limpieza igual', async () => {
  const { result } = await renderAuthedSession();
  mockLogOutPurchases.mockImplementation(() => {
    throw new Error('sdk broke its no-throw contract');
  });

  await act(async () => {
    await result.current.logout();
  });

  expect(mockClearTokens).toHaveBeenCalled();
  expect(result.current.user).toBeNull();
  expect(result.current.isAuthenticated).toBe(false);
});
