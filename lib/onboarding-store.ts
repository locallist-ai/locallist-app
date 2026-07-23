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

/** Preferences captured during onboarding (filled in by the W2 flow). */
export type OnboardingPrefs = Record<string, unknown>;

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
