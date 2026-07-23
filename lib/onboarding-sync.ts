/**
 * Deferred sync of guest onboarding preferences → the user profile.
 *
 * A guest fills preferences during the W2 onboarding flow (city, interests,
 * budget) while unauthenticated; they are persisted locally by
 * `onboarding-store`. On the FIRST successful login/registration (`lib/auth`
 * `login()`), the profile-relevant subset is pushed to `PUT /me/profile` and the
 * local prefs are cleared. Interests have no profile field, so they stay local
 * for wizard/chat pre-fill and are simply dropped once a profile write happens.
 *
 * Best-effort by contract: a failed write leaves the prefs in place so the next
 * login retries; it never throws into the auth flow.
 */
import { upsertProfile } from './api';
import {
  getOnboardingPrefsSync,
  clearOnboardingPrefs,
  type OnboardingPrefs,
} from './onboarding-store';
import type { UpsertProfileRequest } from './types';
import { logger } from './logger';

/**
 * Pure mapping of onboarding prefs → the profile upsert shape. Returns `null`
 * when nothing maps to a profile field (so callers can skip the network round
 * trip entirely). Keeping it pure makes the mapping trivially unit-testable.
 */
export function mapPrefsToProfile(prefs: OnboardingPrefs): UpsertProfileRequest | null {
  const req: UpsertProfileRequest = {};
  if (prefs.budget) req.defaultBudgetTier = prefs.budget;
  if (prefs.pace) req.pacePreference = prefs.pace;
  if (prefs.dietary && prefs.dietary.length > 0) req.dietaryRestrictions = prefs.dietary;
  if (prefs.city) req.favoriteCity = prefs.city;
  return Object.keys(req).length > 0 ? req : null;
}

/**
 * Push the current onboarding prefs to the profile, then clear them. Safe to
 * call unconditionally after login — a no-op when there is nothing to sync.
 */
export async function syncOnboardingPrefsToProfile(): Promise<void> {
  const req = mapPrefsToProfile(getOnboardingPrefsSync());
  if (!req) return;
  const res = await upsertProfile(req);
  // Treat a 2xx (data present or 204) as success; only a real error keeps prefs
  // around for a retry on the next login.
  if (res.error) {
    logger.warn('onboarding prefs sync failed, keeping prefs for retry', res.error);
    return;
  }
  await clearOnboardingPrefs();
}
