/**
 * Tests for the pure entry-gate decision (`lib/entry-state`). This is the core
 * of guest mode: a guest OR an authenticated user reaches the app; onboarding
 * shows only on the very first run.
 */

import { resolveEntryState, isGuestSession } from '../entry-state';

describe('resolveEntryState', () => {
  const base = { isLoading: false, onboardingLoading: false, isAuthenticated: false, onboardingDone: false };

  it('is loading while auth tokens are still being read', () => {
    expect(resolveEntryState({ ...base, isLoading: true })).toBe('loading');
  });

  it('is loading while the onboarding flag is still hydrating', () => {
    expect(resolveEntryState({ ...base, onboardingLoading: true })).toBe('loading');
  });

  it('shows onboarding on the first run (guest, never completed)', () => {
    expect(resolveEntryState(base)).toBe('onboarding');
  });

  it('lets a guest who finished onboarding into the app', () => {
    expect(resolveEntryState({ ...base, onboardingDone: true })).toBe('app');
  });

  it('never shows onboarding to an authenticated user, even if the flag is unset', () => {
    expect(resolveEntryState({ ...base, isAuthenticated: true, onboardingDone: false })).toBe('app');
  });

  it('lets an authenticated user who also completed onboarding into the app', () => {
    expect(resolveEntryState({ ...base, isAuthenticated: true, onboardingDone: true })).toBe('app');
  });
});

describe('isGuestSession', () => {
  it('is a guest session when the app is reached without authentication', () => {
    expect(isGuestSession({ entry: 'app', isAuthenticated: false })).toBe(true);
  });

  it('is not a guest session when authenticated', () => {
    expect(isGuestSession({ entry: 'app', isAuthenticated: false })).toBe(true);
    expect(isGuestSession({ entry: 'app', isAuthenticated: true })).toBe(false);
  });

  it('is not a guest session while loading or onboarding', () => {
    expect(isGuestSession({ entry: 'loading', isAuthenticated: false })).toBe(false);
    expect(isGuestSession({ entry: 'onboarding', isAuthenticated: false })).toBe(false);
  });
});
