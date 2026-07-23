/**
 * Pure decision for the root entry gate (`app/_layout.tsx`).
 *
 * The app used to force login before any value. The guest-mode entry gate lets
 * a guest OR an authenticated user reach the app; onboarding shows only on the
 * very first run (never authenticated, never completed). Keeping the decision
 * pure makes it trivially testable without rendering the whole layout.
 */

export type EntryState = 'loading' | 'onboarding' | 'app';

export function resolveEntryState(p: {
  /** Auth still reading persisted tokens. */
  isLoading: boolean;
  /** Onboarding flag still hydrating from storage. */
  onboardingLoading: boolean;
  isAuthenticated: boolean;
  onboardingDone: boolean;
}): EntryState {
  if (p.isLoading || p.onboardingLoading) return 'loading';
  // Onboarding is first-run only: authenticated users always skip it (auto-login
  // resolves before this via the splash), and a guest who finished it goes to the
  // app, not back to onboarding.
  if (!p.isAuthenticated && !p.onboardingDone) return 'onboarding';
  return 'app';
}

/** A guest session = reached the app without an authenticated user. */
export function isGuestSession(p: { entry: EntryState; isAuthenticated: boolean }): boolean {
  return p.entry === 'app' && !p.isAuthenticated;
}
