/**
 * Clone-plan store — the "save this plan" onboarding hook.
 *
 * Covers the guest → signup → replay path that the orchestrator + login wire
 * together: the pending intent is last-wins and single-shot, the login replay
 * clones it and stages a landing id (fired as a `viaSignup:true` save), a failed
 * clone never strands the user, and a dismissed registration discards the intent.
 */
import { renderHook, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import {
  setPendingClonePlan,
  getPendingClonePlan,
  clearPendingClonePlan,
  setPendingCloneLanding,
  consumePendingCloneLanding,
  subscribeCloneLanding,
  applyPendingClonePlan,
  usePendingCloneLanding,
  clearCloneState,
} from '../clone-plan-store';
import { clonePlan } from '../api';
import { track } from '../analytics';

jest.mock('../api', () => ({ clonePlan: jest.fn() }));
jest.mock('../analytics', () => ({ track: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockClone = clonePlan as jest.Mock;
const mockTrack = track as jest.Mock;
const mockPush = router.push as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearCloneState();
});

describe('pending clone intent', () => {
  it('stores and reads the pending id (last-wins)', () => {
    setPendingClonePlan('a');
    expect(getPendingClonePlan()).toBe('a');
    // A second tap replaces the first — last-wins, a single intent.
    setPendingClonePlan('b');
    expect(getPendingClonePlan()).toBe('b');
  });

  it('clears the pending id (discard on dismissed registration)', () => {
    setPendingClonePlan('a');
    clearPendingClonePlan();
    expect(getPendingClonePlan()).toBeNull();
  });
});

describe('landing id', () => {
  it('consume reads AND clears (single navigation)', () => {
    setPendingCloneLanding('plan-1');
    expect(consumePendingCloneLanding()).toBe('plan-1');
    expect(consumePendingCloneLanding()).toBeNull();
  });

  it('notifies subscribers when a landing id is staged', () => {
    const cb = jest.fn();
    const unsub = subscribeCloneLanding(cb);
    setPendingCloneLanding('plan-1');
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    setPendingCloneLanding('plan-2');
    expect(cb).toHaveBeenCalledTimes(1); // no longer subscribed
  });
});

describe('applyPendingClonePlan (login replay)', () => {
  it('no pending → no clone, no analytics', async () => {
    await applyPendingClonePlan();
    expect(mockClone).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('clones the pending plan, stages the landing id, and reports both funnel events', async () => {
    mockClone.mockResolvedValueOnce({ data: { id: 'cloned-9' }, error: null, status: 200 });
    setPendingClonePlan('showcase-1');

    await applyPendingClonePlan();

    expect(mockClone).toHaveBeenCalledWith('showcase-1');
    // The converting cohort counts in the funnel: completion + the save itself.
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_completed', skippedPaywall: true });
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_plan_saved', viaSignup: true });
    expect(consumePendingCloneLanding()).toBe('cloned-9');
    // Single replay: the pending id is consumed.
    expect(getPendingClonePlan()).toBeNull();
  });

  it('a network failure does not throw, stages no landing, but still completes onboarding', async () => {
    mockClone.mockResolvedValueOnce({ data: null, error: 'Network error', errorBody: null, status: 0 });
    setPendingClonePlan('showcase-1');

    await expect(applyPendingClonePlan()).resolves.toBeUndefined();

    // The user completed onboarding by registering, even though the clone failed.
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_completed', skippedPaywall: true });
    expect(mockTrack).not.toHaveBeenCalledWith({ event: 'onboarding_plan_saved', viaSignup: true });
    expect(consumePendingCloneLanding()).toBeNull();
    // Even on failure the intent is dropped (no infinite retry loop on next login).
    expect(getPendingClonePlan()).toBeNull();
  });

  it('a 403 (saved_plans cap during replay) is swallowed — completes, no landing, no crash', async () => {
    mockClone.mockResolvedValueOnce({
      data: null,
      error: 'saved_plans_limit_reached',
      errorBody: { error: 'saved_plans_limit_reached' },
      status: 403,
    });
    setPendingClonePlan('showcase-1');

    await expect(applyPendingClonePlan()).resolves.toBeUndefined();
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_completed', skippedPaywall: true });
    expect(mockTrack).not.toHaveBeenCalledWith({ event: 'onboarding_plan_saved', viaSignup: true });
    expect(consumePendingCloneLanding()).toBeNull();
  });
});

describe('usePendingCloneLanding (the app-shell navigation, sole production payoff link)', () => {
  it('(a) landing staged BEFORE mount → navigates on mount', () => {
    setPendingCloneLanding('plan-1');

    renderHook(() => usePendingCloneLanding());

    expect(mockPush).toHaveBeenCalledWith('/plan/plan-1');
    // Consumed: it does not re-navigate.
    expect(consumePendingCloneLanding()).toBeNull();
  });

  it('(b) landing staged AFTER mount → the subscription drives the navigation', () => {
    renderHook(() => usePendingCloneLanding());
    // Nothing staged at mount → no navigation yet (the post-login replay is async).
    expect(mockPush).not.toHaveBeenCalled();

    act(() => setPendingCloneLanding('plan-2'));

    expect(mockPush).toHaveBeenCalledWith('/plan/plan-2');
  });

  it('unsubscribes on unmount (no navigation after the shell is gone)', () => {
    const { unmount } = renderHook(() => usePendingCloneLanding());
    unmount();

    act(() => setPendingCloneLanding('plan-3'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('clearCloneState (logout)', () => {
  it('drops both the pending intent and any staged landing', () => {
    setPendingClonePlan('a');
    setPendingCloneLanding('b');
    clearCloneState();
    expect(getPendingClonePlan()).toBeNull();
    expect(consumePendingCloneLanding()).toBeNull();
  });
});
