/**
 * W1 root-fix integration: the marketing onboarding is retired the moment a
 * user authenticates on this device, so the guest-mode entry gate is NEVER
 * re-derived from `onboarding_completed` after that point.
 *
 * Wires the REAL `AuthProvider` + REAL `onboarding-store` + REAL pure
 * `resolveEntryState`, with only leaf deps (api/safe-store/analytics/purchases/
 * trial-reminder/logger) mocked. These are the two MAJORs from the adversarial
 * review, each inverted to green:
 *
 *  - MAJOR 1: a user who logged in once, then a later cold-start whose
 *    `/account` auto-login throws transiently → gate resolves to `app`
 *    (degraded guest, recoverable), NOT the marketing onboarding.
 *  - MAJOR 2: logout drops auth but the flag stays set → gate resolves to `app`
 *    (guest), NOT the marketing onboarding.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../auth';
import { resolveEntryState, type EntryState } from '../entry-state';
import * as onboarding from '../onboarding-store';
import { api, getAccessToken } from '../api';

jest.mock('../safe-store', () => {
  const backing = new Map<string, string>();
  return {
    __backing: backing,
    getItemAsync: jest.fn((key: string) => Promise.resolve(backing.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      backing.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      backing.delete(key);
      return Promise.resolve();
    }),
  };
});
jest.mock('../api', () => ({
  api: jest.fn().mockResolvedValue({ data: null }),
  setTokens: jest.fn(),
  clearTokens: jest.fn(),
  getAccessToken: jest.fn().mockResolvedValue(null),
}));
jest.mock('../analytics', () => ({ setAnalyticsUserId: jest.fn() }));
jest.mock('../purchases', () => ({ logOutPurchases: jest.fn() }));
jest.mock('../trial-reminder', () => ({ cancelTrialReminder: jest.fn() }));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockApi = api as jest.Mock;
const mockGetAccessToken = getAccessToken as jest.Mock;
const safeStore = jest.requireMock('../safe-store') as { __backing: Map<string, string> };

const USER = { id: 'user-1', email: 'ana@example.com', name: 'Ana', tier: 'free' as const };

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// The exact decision the root layout's EntryGate makes, fed the live auth +
// onboarding signals. Both async reads have settled by the time we call this.
function gate(isAuthenticated: boolean): EntryState {
  return resolveEntryState({
    isLoading: false,
    onboardingLoading: false,
    isAuthenticated,
    onboardingDone: onboarding.getOnboardingCompletedSync(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  safeStore.__backing.clear();
  onboarding.__resetForTests();
  mockApi.mockResolvedValue({ data: null });
  mockGetAccessToken.mockResolvedValue(null);
});

// login marca la flag (requisito del brief) + MAJOR 2 (logout).
it('login retires the onboarding flag; after logout the gate stays on the guest app, never onboarding', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));

  // First run: guest, onboarding not yet completed → marketing onboarding.
  expect(onboarding.getOnboardingCompletedSync()).toBe(false);
  expect(gate(result.current.isAuthenticated)).toBe('onboarding');

  await act(async () => {
    await result.current.login(USER, 'access-token', 'refresh-token');
  });

  // login flips the flag for good.
  expect(result.current.isAuthenticated).toBe(true);
  expect(onboarding.getOnboardingCompletedSync()).toBe(true);
  expect(gate(result.current.isAuthenticated)).toBe('app');

  await act(async () => {
    await result.current.logout();
  });

  // MAJOR 2 inverted: logged out ⇒ guest app, NOT the marketing onboarding.
  expect(result.current.isAuthenticated).toBe(false);
  expect(onboarding.getOnboardingCompletedSync()).toBe(true);
  expect(gate(result.current.isAuthenticated)).toBe('app');
});

// MAJOR 1: prior successful session set the flag; a later auto-login throws.
it('a transient auto-login failure resolves the gate to the guest app, not onboarding (flag survives)', async () => {
  // A previous session on this device already retired onboarding.
  await act(async () => {
    await onboarding.completeOnboarding();
  });
  expect(onboarding.getOnboardingCompletedSync()).toBe(true);

  // Cold start: token present, but /account is transiently down.
  mockGetAccessToken.mockResolvedValue('stale-token');
  mockApi.mockRejectedValue(new Error('account temporarily unavailable'));

  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));

  // Auto-login failed → unauthenticated, but the flag from the prior session
  // stands, so the gate degrades to the app (recoverable), never onboarding.
  expect(result.current.isAuthenticated).toBe(false);
  expect(onboarding.getOnboardingCompletedSync()).toBe(true);
  expect(gate(result.current.isAuthenticated)).toBe('app');
});

// Defence in depth: a *successful* auto-login also retires onboarding, so the
// very next failed cold start (MAJOR 1) already has the flag set.
it('a successful auto-login retires the onboarding flag', async () => {
  expect(onboarding.getOnboardingCompletedSync()).toBe(false);
  mockGetAccessToken.mockResolvedValue('good-token');
  mockApi.mockResolvedValue({ data: { user: USER } });

  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));

  expect(result.current.isAuthenticated).toBe(true);
  expect(onboarding.getOnboardingCompletedSync()).toBe(true);
});
