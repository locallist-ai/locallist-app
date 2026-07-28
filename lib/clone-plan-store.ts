/**
 * Clone-plan store — the "save this plan" onboarding hook.
 *
 * On the showcase preview (onboarding step 3) a guest can tap "Save this plan".
 * Saving REQUIRES registration, so — mirroring the guest favorite pattern in
 * `favorites-store` — the guest's intent is staged as a module-level pending id
 * and REPLAYED once, after a successful login, from `lib/auth` `login()`.
 *
 * Two pieces of module state:
 *  - `_pendingClonePlanId`: the showcase id a guest wanted to save (last-wins,
 *    non-persistent). Replayed once at login, then dropped. Cleared if the guest
 *    dismisses the registration without logging in (no phantom save later).
 *  - `_pendingLandingId`: the id of the freshly cloned plan the app should land
 *    on. Set by the replay (or by the already-authenticated save path) and
 *    consumed by the app shell once it mounts, so navigation survives the entry
 *    gate flipping onboarding → app. A subscribe channel covers the race where
 *    the landing is set AFTER the shell has already mounted (login sets `user`
 *    before the replay finishes).
 *
 * Both are in-memory only; the backend is the source of truth for the plan.
 *
 * LAUNCH LIMITATION (documented, not resolved): the showcase plans are all Miami,
 * so a cloned plan is always a Miami plan. Fine for the Miami-only launch.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { clonePlan } from './api';
import { track } from './analytics';
import { logger } from './logger';

// ─── Module state ────────────────────────────────────────

let _pendingClonePlanId: string | null = null;
let _pendingLandingId: string | null = null;
const _landingSubs = new Set<() => void>();

// ─── Pending intent (guest → signup) ─────────────────────

export function setPendingClonePlan(planId: string): void {
  _pendingClonePlanId = planId;
}

export function getPendingClonePlan(): string | null {
  return _pendingClonePlanId;
}

export function clearPendingClonePlan(): void {
  _pendingClonePlanId = null;
}

// ─── Landing (navigate to the cloned plan) ───────────────

function _notifyLanding(): void {
  _landingSubs.forEach((cb) => cb());
}

/** Subscribe to landing-id changes. Returns an unsubscribe fn. */
export function subscribeCloneLanding(cb: () => void): () => void {
  _landingSubs.add(cb);
  return () => {
    _landingSubs.delete(cb);
  };
}

/** Stage the cloned plan id the app should land on, then notify subscribers. */
export function setPendingCloneLanding(planId: string): void {
  _pendingLandingId = planId;
  _notifyLanding();
}

/** Read AND clear the pending landing id (single navigation). */
export function consumePendingCloneLanding(): string | null {
  const id = _pendingLandingId;
  _pendingLandingId = null;
  return id;
}

/**
 * Land on a freshly cloned plan once the app shell is mounted. This is the sole
 * production hook-point of the "save this plan" payoff, wired once from the app
 * stack (`app/_layout` `AppStack`).
 *
 * The entry gate flips onboarding → app the instant `login()` sets `user` — which
 * happens BEFORE the async clone replay finishes — so we BOTH consume any landing
 * id already staged at mount AND subscribe for one staged just after. Consuming
 * and subscribing in the same effect closes the tiny window between the two.
 *
 * TODO polish: the guest→signup path briefly shows the home before pushing the
 * plan (~1-2s: mount → app home → clone resolves → push), a visible flash. A
 * later polish could hold a splash/skeleton while a pending clone is in flight.
 */
export function usePendingCloneLanding(): void {
  useEffect(() => {
    const landIfPending = () => {
      const id = consumePendingCloneLanding();
      // Cloned from a shared showcase plan → attribute its `plan_viewed` as `shared`.
      if (id) router.push(`/plan/${id}?source=shared`);
    };
    landIfPending();
    return subscribeCloneLanding(landIfPending);
  }, []);
}

// ─── Auth-wired replay ───────────────────────────────────

/**
 * Replay a guest's staged "save this plan" intent after a successful login.
 * Clones the pending showcase into the caller's private copy, stages the new
 * plan id for the app to land on, and reports the save (`viaSignup:true`).
 *
 * Having a pending intent here IS the save-hook conversion: the guest onboarded,
 * tapped save, and just registered. `login()` completes onboarding for this path
 * (the orchestrator's `completeFlow` never runs), so we emit the terminal
 * `onboarding_completed` here too — otherwise this converting cohort would be
 * missing from the funnel's completion count. Fired regardless of the clone
 * outcome: the user has completed onboarding by registering either way.
 *
 * Best-effort by contract: any failure (network, 4xx) is logged and the user
 * simply lands on the home rather than being stranded. Single replay, last-wins:
 * the pending id is cleared whether or not the clone succeeds.
 *
 * A 403 `saved_plans_limit_reached` here is swallowed silently (log only): it is
 * UNREACHABLE for a fresh signup (0 saved plans, cap not met). It could only
 * surface for a returning free user at their cap who somehow re-runs onboarding —
 * an accepted edge; the app is authenticated and functional, just without the
 * clone. The reachable upsell path is the authenticated save in the preview.
 */
export async function applyPendingClonePlan(): Promise<void> {
  const planId = _pendingClonePlanId;
  if (!planId) return;
  _pendingClonePlanId = null;
  track({ event: 'onboarding_completed', skippedPaywall: true });
  try {
    const res = await clonePlan(planId);
    if (res.data?.id) {
      track({ event: 'onboarding_plan_saved', viaSignup: true });
      setPendingCloneLanding(res.data.id);
    } else {
      logger.warn('applyPendingClonePlan: clone rejected', { status: res.status });
    }
  } catch (error) {
    logger.warn('applyPendingClonePlan failed', error);
  }
}

/** Reset all clone-plan state. Wired from `lib/auth` logout. */
export function clearCloneState(): void {
  _pendingClonePlanId = null;
  _pendingLandingId = null;
}
