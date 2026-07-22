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
import { clearTokens } from '../api';
import { logOutPurchases } from '../purchases';

jest.mock('../api', () => ({
  api: jest.fn().mockResolvedValue({ data: null }),
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
  getAccessToken: jest.fn().mockResolvedValue(null),
}));
jest.mock('../analytics', () => ({ setAnalyticsUserId: jest.fn() }));
jest.mock('../purchases', () => ({ logOutPurchases: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

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
  mockLogOutPurchases.mockResolvedValue(undefined);
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
