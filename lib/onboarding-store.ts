import { useState, useEffect } from 'react';
import * as SafeStore from './safe-store';
import { logger } from './logger';

/**
 * First-run onboarding state (module-level + SafeStore persistence).
 *
 * Mirrors the `trip-context-store` pattern: eager hydration, a sync getter,
 * a subscribe/notify fan-out so mounted hooks re-render, and a `__resetForTests`.
 *
 * Persisted with `lib/safe-store` (SecureStore + in-memory fallback), NOT
 * Keychain-first semantics of a device id — like `analytics_anon_id`, the flag
 * MUST die with the app's uninstall so a reinstall re-shows onboarding. On dev
 * builds where SecureStore has no entitlement, SafeStore's Map fallback keeps it
 * for the process; in prod (EAS) SecureStore persists it across restarts and it
 * is wiped on uninstall — the intended lifetime.
 */

const COMPLETED_KEY = 'onboarding_completed';
const PREFS_KEY = 'onboarding_prefs';

/**
 * Preferences captured during the onboarding flow (W2). Persisted as JSON under
 * `onboarding_prefs`. While the user is a guest these pre-fill the wizard/chat
 * (city is also mirrored to `trip-context-store` for preselection); on the first
 * successful login they are pushed to `/me/profile` and cleared (see
 * `lib/onboarding-sync.ts`). All fields optional — the flow is skippable.
 */
export interface OnboardingPrefs {
  /** City picked on screen 2 (also mirrored to trip-context for preselection). */
  city?: string;
  /** Interest ids picked on screen 3 (e.g. 'food', 'outdoors'). */
  interests?: string[];
  /** Budget tier from screen 3 ('budget' | 'moderate' | 'premium'). */
  budget?: string;
  /** Pace preference — reserved for an alternate screen-3 control. */
  pace?: string;
  /** Dietary restriction ids — reserved. */
  dietary?: string[];
}

let _completed = false;
let _prefs: OnboardingPrefs = {};
let _initialized = false;
let _initPromise: Promise<void> | null = null;
const _subs = new Set<() => void>();

function _emit() {
  _subs.forEach((cb) => cb());
}

function _ensureInitialized(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const [completedRaw, prefsRaw] = await Promise.all([
      SafeStore.getItemAsync(COMPLETED_KEY),
      SafeStore.getItemAsync(PREFS_KEY),
    ]);
    _completed = completedRaw === 'true';
    if (prefsRaw) {
      try {
        const parsed = JSON.parse(prefsRaw);
        if (parsed && typeof parsed === 'object') _prefs = parsed as OnboardingPrefs;
      } catch (err) {
        logger.warn('onboarding: prefs parse failed, ignoring', err);
      }
    }
    _initialized = true;
    _emit();
  })();
  return _initPromise;
}

// Start loading eagerly so it's ready before the entry gate mounts.
_ensureInitialized().catch(() => {});

/**
 * Mark onboarding as done (first-run only). Optionally merges any preferences
 * collected during the flow. Persists both under stable keys and notifies hooks.
 */
export async function completeOnboarding(prefs?: OnboardingPrefs): Promise<void> {
  _completed = true;
  _initialized = true;
  if (prefs) _prefs = { ..._prefs, ...prefs };
  await SafeStore.setItemAsync(COMPLETED_KEY, 'true');
  if (prefs) await SafeStore.setItemAsync(PREFS_KEY, JSON.stringify(_prefs));
  _emit();
}

/** Merge partial onboarding preferences without touching the completion flag. */
export async function setOnboardingPrefs(prefs: OnboardingPrefs): Promise<void> {
  _prefs = { ..._prefs, ...prefs };
  await SafeStore.setItemAsync(PREFS_KEY, JSON.stringify(_prefs));
  _emit();
}

/**
 * Wipe the persisted onboarding preferences (leaves the completion flag intact).
 * Called after the deferred sync to `/me/profile` succeeds on first login, so a
 * signed-in user never keeps stale guest prefs around.
 */
export async function clearOnboardingPrefs(): Promise<void> {
  _prefs = {};
  await SafeStore.deleteItemAsync(PREFS_KEY);
  _emit();
}

export function getOnboardingCompletedSync(): boolean {
  return _completed;
}

export function getOnboardingPrefsSync(): OnboardingPrefs {
  return _prefs;
}

function subscribe(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

export function useOnboarding(): {
  completed: boolean;
  prefs: OnboardingPrefs;
  loading: boolean;
} {
  const [completed, setCompleted] = useState(_completed);
  const [prefs, setPrefs] = useState(_prefs);
  const [loading, setLoading] = useState(!_initialized);

  useEffect(() => {
    let mounted = true;

    _ensureInitialized()
      .then(() => {
        if (mounted) {
          setCompleted(_completed);
          setPrefs(_prefs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const unsub = subscribe(() => {
      if (mounted) {
        setCompleted(_completed);
        setPrefs(_prefs);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { completed, prefs, loading };
}

// Solo para tests — restablece el estado a nivel de módulo.
// NO llamar fuera de tests.
export const __resetForTests = (): void => {
  _completed = false;
  _prefs = {};
  _initialized = false;
  _initPromise = null;
  _subs.clear();
};
