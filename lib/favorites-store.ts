/**
 * Favorites store — module-level cache of the favorited place ids (a `Set`),
 * following the same module-level + subscribe pattern as `trip-context-store`
 * and `onboarding-store`.
 *
 * Ownership of concerns:
 *  - The plain functions (`loadFavoriteIds` / `clearFavorites` /
 *    `applyPendingFavorite`) are wired from `lib/auth`: the id set is fetched
 *    when a session becomes authenticated (login + auto-login) and cleared on
 *    logout, alongside the rest of the auth-owned state.
 *  - `useFavorites()` is the UI hook: it exposes the id set, a `loading`/`loaded`
 *    flag, and an OPTIMISTIC `toggle(placeId, source)` that reverts if the API
 *    fails, with a per-place in-flight guard (a double-tap never races PUT vs
 *    DELETE). It owns the guest/gate policy (a guest never calls the API — the
 *    heart records a single pending intent and presents the signup gate; the
 *    intent is replayed by `applyPendingFavorite` after login, and DISCARDED if
 *    the guest dismisses the gate without going to login).
 *
 * The id set is in-memory only (never persisted): it is re-fetched on every
 * authenticated start, mirroring how the backend is the source of truth.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { useGateHandler } from './useGateHandler';
import { mapGateError } from './gate-errors';
import { putFavorite, deleteFavorite, getFavoriteIds } from './api';
import { track, type FavoriteSource } from './analytics';
import { logger } from './logger';

// ─── Module state ────────────────────────────────────────

let _ids = new Set<string>();
let _loaded = false;
let _loading = false;
// Single pending intent (last-wins), non-persistent: a guest tapped a heart and
// must sign up first; replayed once after login, then dropped.
let _pendingFavoritePlaceId: string | null = null;
// Per-place in-flight guard: a second tap on the same heart while its PUT/DELETE
// is still pending is IGNORED, so PUT and DELETE for one place can never race
// out of order (spurious events / backend-local divergence on double-tap).
const _inFlight = new Set<string>();
const _subs = new Set<() => void>();

function _notify(): void {
  // Reassign to a fresh Set so subscribers keying off identity re-render.
  _ids = new Set(_ids);
  _subs.forEach((cb) => cb());
}

function _subscribe(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

// ─── Sync getters ────────────────────────────────────────

export function getFavoriteIdsSync(): Set<string> {
  return _ids;
}

export function isFavoriteSync(placeId: string): boolean {
  return _ids.has(placeId);
}

/** Apply a favorite state locally (optimistic UI / revert) and notify. */
function _applyLocal(placeId: string, favorited: boolean): void {
  if (favorited) _ids.add(placeId);
  else _ids.delete(placeId);
  _notify();
}

// ─── Pending intent (guest → signup) ─────────────────────

export function setPendingFavorite(placeId: string): void {
  _pendingFavoritePlaceId = placeId;
}

export function getPendingFavorite(): string | null {
  return _pendingFavoritePlaceId;
}

export function clearPendingFavorite(): void {
  _pendingFavoritePlaceId = null;
}

// ─── Auth-wired lifecycle ────────────────────────────────

/**
 * Fetch the favorite ids for the authenticated session. Best-effort: a failure
 * leaves the set as-is (empty on first load) and never throws into auth.
 */
export async function loadFavoriteIds(): Promise<void> {
  _loading = true;
  _notify();
  try {
    const res = await getFavoriteIds();
    if (res.data?.ids) {
      _ids = new Set(res.data.ids);
      _loaded = true;
    }
  } catch (error) {
    logger.warn('loadFavoriteIds failed', error);
  } finally {
    _loading = false;
    _notify();
  }
}

/** Reset all favorites state. Wired from `lib/auth` logout. */
export function clearFavorites(): void {
  _ids = new Set();
  _loaded = false;
  _loading = false;
  _pendingFavoritePlaceId = null;
  _inFlight.clear();
  _notify();
}

/**
 * Replay the pending guest intent after a successful login: PUT the favorite,
 * add it to the set on success. Best-effort — a failure is logged and the intent
 * is discarded silently (never throws into the auth flow). Only ONE intent at a
 * time (the last heart a guest tapped).
 */
export async function applyPendingFavorite(): Promise<void> {
  const placeId = _pendingFavoritePlaceId;
  if (!placeId) return;
  _pendingFavoritePlaceId = null;
  try {
    const res = await putFavorite(placeId);
    const ok = res.status >= 200 && res.status < 300;
    if (ok) {
      _applyLocal(placeId, true);
    } else {
      logger.warn('applyPendingFavorite: PUT rejected', { status: res.status });
    }
  } catch (error) {
    logger.warn('applyPendingFavorite failed', error);
  }
}

// ─── UI hook ─────────────────────────────────────────────

export type UseFavorites = {
  ids: Set<string>;
  loading: boolean;
  /** True once the id set has been fetched at least once this session. */
  loaded: boolean;
  toggle: (placeId: string, source: FavoriteSource) => Promise<void>;
};

export function useFavorites(): UseFavorites {
  const { isAuthenticated } = useAuth();
  const { presentGate } = useGateHandler();
  const [ids, setIds] = useState<Set<string>>(_ids);
  const [loading, setLoading] = useState<boolean>(_loading);
  const [loaded, setLoaded] = useState<boolean>(_loaded);

  useEffect(() => {
    const sync = () => {
      setIds(_ids);
      setLoading(_loading);
      setLoaded(_loaded);
    };
    sync();
    return _subscribe(sync);
  }, []);

  const toggle = useCallback(
    async (placeId: string, source: FavoriteSource) => {
      // Guest: never hit the API. Record a single pending intent and present the
      // signup gate; it is replayed after login by `applyPendingFavorite`.
      // Dismissing the gate WITHOUT going to login clears the pending: otherwise
      // a user who registers days later through another path would get a
      // phantom favorite applied they no longer remember.
      if (!isAuthenticated) {
        setPendingFavorite(placeId);
        presentGate({ type: 'signup_required' }, { onDismiss: clearPendingFavorite });
        return;
      }

      // In-flight guard: ignore a tap on a place whose op is still pending.
      if (_inFlight.has(placeId)) return;
      _inFlight.add(placeId);
      try {
        const wasFavorited = _ids.has(placeId);
        // Optimistic flip.
        _applyLocal(placeId, !wasFavorited);

        const res = wasFavorited
          ? await deleteFavorite(placeId)
          : await putFavorite(placeId);
        const ok = res.status >= 200 && res.status < 300;

        if (ok) {
          track({ event: wasFavorited ? 'favorite_removed' : 'favorite_added', source });
          return;
        }

        // Failure — revert the optimistic flip.
        _applyLocal(placeId, wasFavorited);

        const action = mapGateError(res.status, res.errorBody);
        if (action.type === 'upsell' && action.code === 'favorites_limit_reached') {
          track({ event: 'favorites_limit_hit' });
          presentGate(action);
          return;
        }
        if (action.type === 'signup_required') {
          // A stale token expired mid-flight; steer to signup rather than fail silently.
          presentGate(action);
          return;
        }
        // 404 (place unpublished) / network: revert already happened, stay quiet.
        logger.warn('favorite toggle failed', { status: res.status });
      } finally {
        _inFlight.delete(placeId);
      }
    },
    [isAuthenticated, presentGate],
  );

  return { ids, loading, loaded, toggle };
}
