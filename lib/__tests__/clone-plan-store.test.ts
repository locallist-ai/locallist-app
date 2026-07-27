/**
 * Clone-plan store — the "save this plan" onboarding hook.
 *
 * Covers the guest → signup → replay path that the orchestrator + login wire
 * together: the pending intent is last-wins and single-shot, the login replay
 * clones it and stages a landing id (fired as a `viaSignup:true` save), a failed
 * clone never strands the user, and a dismissed registration discards the intent.
 */
import {
  setPendingClonePlan,
  getPendingClonePlan,
  clearPendingClonePlan,
  setPendingCloneLanding,
  consumePendingCloneLanding,
  subscribeCloneLanding,
  applyPendingClonePlan,
  clearCloneState,
} from '../clone-plan-store';
import { clonePlan } from '../api';
import { track } from '../analytics';

jest.mock('../api', () => ({ clonePlan: jest.fn() }));
jest.mock('../analytics', () => ({ track: jest.fn() }));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockClone = clonePlan as jest.Mock;
const mockTrack = track as jest.Mock;

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

  it('clones the pending plan, stages the landing id, and reports viaSignup:true', async () => {
    mockClone.mockResolvedValueOnce({ data: { id: 'cloned-9' }, error: null, status: 200 });
    setPendingClonePlan('showcase-1');

    await applyPendingClonePlan();

    expect(mockClone).toHaveBeenCalledWith('showcase-1');
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_plan_saved', viaSignup: true });
    expect(consumePendingCloneLanding()).toBe('cloned-9');
    // Single replay: the pending id is consumed.
    expect(getPendingClonePlan()).toBeNull();
  });

  it('a network failure does not throw, stages no landing, and clears the pending', async () => {
    mockClone.mockResolvedValueOnce({ data: null, error: 'Network error', errorBody: null, status: 0 });
    setPendingClonePlan('showcase-1');

    await expect(applyPendingClonePlan()).resolves.toBeUndefined();

    expect(mockTrack).not.toHaveBeenCalled();
    expect(consumePendingCloneLanding()).toBeNull();
    // Even on failure the intent is dropped (no infinite retry loop on next login).
    expect(getPendingClonePlan()).toBeNull();
  });

  it('a 403 (saved_plans cap during replay) is swallowed — no landing, no crash', async () => {
    mockClone.mockResolvedValueOnce({
      data: null,
      error: 'saved_plans_limit_reached',
      errorBody: { error: 'saved_plans_limit_reached' },
      status: 403,
    });
    setPendingClonePlan('showcase-1');

    await expect(applyPendingClonePlan()).resolves.toBeUndefined();
    expect(mockTrack).not.toHaveBeenCalled();
    expect(consumePendingCloneLanding()).toBeNull();
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
