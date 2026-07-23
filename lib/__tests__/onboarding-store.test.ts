/**
 * Contract tests for `lib/onboarding-store`:
 *
 *  - On import it eagerly hydrates the persisted flag/prefs from SafeStore: the
 *    hook starts in `loading` while the read is in flight and resolves to the
 *    stored values.
 *  - `completeOnboarding` persists `onboarding_completed='true'` under the stable
 *    key, flips the sync getter, and notifies mounted hooks.
 *  - `setOnboardingPrefs` merges + persists prefs as JSON without touching the flag.
 *
 * Like `trip-context-store`, the module keeps state at module scope and kicks off
 * the initial read ONCE at import, so tests run sequentially over the same
 * instance (resetting modules would duplicate React and break renderHook). The
 * initial read is gated on a deferred resolver exposed by the mock.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../safe-store', () => {
  const backing = new Map<string, string>();
  let openGate: () => void = () => {};
  const gate = new Promise<void>((res) => { openGate = res; });
  return {
    __resolveInitialRead: (completed: string | null, prefs: string | null) => {
      if (completed !== null) backing.set('onboarding_completed', completed);
      if (prefs !== null) backing.set('onboarding_prefs', prefs);
      openGate();
    },
    getItemAsync: jest.fn((key: string) => gate.then(() => backing.get(key) ?? null)),
    setItemAsync: jest.fn(async (key: string, value: string) => { backing.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { backing.delete(key); }),
  };
});

import * as store from '../onboarding-store';

const safeStore = jest.requireMock('../safe-store') as {
  __resolveInitialRead: (completed: string | null, prefs: string | null) => void;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const COMPLETED_KEY = 'onboarding_completed';
const PREFS_KEY = 'onboarding_prefs';

describe('onboarding-store (sequential: same module instance)', () => {
  it('starts loading while the initial read is in flight, then resolves to the persisted values (a fresh user)', async () => {
    const { result } = renderHook(() => store.useOnboarding());

    // Read still in flight → loading, not completed
    expect(result.current.loading).toBe(true);
    expect(result.current.completed).toBe(false);
    expect(store.getOnboardingCompletedSync()).toBe(false);
    expect(safeStore.getItemAsync).toHaveBeenCalledWith(COMPLETED_KEY);
    expect(safeStore.getItemAsync).toHaveBeenCalledWith(PREFS_KEY);

    // Fresh install: nothing persisted yet
    await act(async () => { safeStore.__resolveInitialRead(null, null); });

    expect(result.current.completed).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.prefs).toEqual({});
    expect(store.getOnboardingCompletedSync()).toBe(false);
  });

  it('completeOnboarding persists the flag under the stable key and notifies the mounted hook', async () => {
    const { result } = renderHook(() => store.useOnboarding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await store.completeOnboarding(); });

    expect(result.current.completed).toBe(true);
    expect(store.getOnboardingCompletedSync()).toBe(true);
    expect(safeStore.setItemAsync).toHaveBeenCalledWith(COMPLETED_KEY, 'true');
  });

  it('completeOnboarding can merge prefs, persisted as JSON', async () => {
    await act(async () => { await store.completeOnboarding({ pace: 'relaxed' }); });

    expect(store.getOnboardingPrefsSync()).toEqual({ pace: 'relaxed' });
    expect(safeStore.setItemAsync).toHaveBeenCalledWith(PREFS_KEY, JSON.stringify({ pace: 'relaxed' }));
  });

  it('setOnboardingPrefs merges into existing prefs without touching the flag', async () => {
    await act(async () => { await store.setOnboardingPrefs({ budget: 'mid' }); });

    expect(store.getOnboardingPrefsSync()).toEqual({ pace: 'relaxed', budget: 'mid' });
    expect(store.getOnboardingCompletedSync()).toBe(true);
    expect(safeStore.setItemAsync).toHaveBeenLastCalledWith(
      PREFS_KEY,
      JSON.stringify({ pace: 'relaxed', budget: 'mid' }),
    );
  });

  it('a hook mounted after hydration does not flash loading', async () => {
    const { result } = renderHook(() => store.useOnboarding());
    // State is already initialised — no loading flicker, flag already true
    expect(result.current.loading).toBe(false);
    expect(result.current.completed).toBe(true);
  });
});
