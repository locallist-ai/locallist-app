import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setTokens, clearTokens, getAccessToken } from './api';
import { logger } from './logger';
import { setAnalyticsUserId } from './analytics';
import { logOutPurchases } from './purchases';
import { parseAiPlansQuota, type AiPlansQuota } from './gate-errors';
import { cancelTrialReminder } from './trial-reminder';
import { completeOnboarding } from './onboarding-store';
import { syncOnboardingPrefsToProfile } from './onboarding-sync';
import { loadFavoriteIds, clearFavorites, applyPendingFavorite } from './favorites-store';
import { applyPendingClonePlan, clearCloneState } from './clone-plan-store';

interface User {
  id: string;
  email: string;
  name: string | null;
  tier: 'free' | 'pro';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** Derived from `user.tier === 'pro'` — gates premium features (RevenueCat subscription). */
  isPro: boolean;
  /** True when logged-in user is a founder (@locallist.ai). Enables dev tools. */
  isAdmin: boolean;
  isLoading: boolean;
  /**
   * Monthly AI-plan quota from `GET /account` ({used, limit, resetsAt}), or
   * null until the backend exposes it (api-gates-fixes.md m4). Free-tier UI
   * uses it to show "X of N plans this month".
   */
  aiPlansMonth: AiPlansQuota | null;
  login: (userData: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Re-fetch `GET /account` and update user state (e.g. after an IAP purchase
   * flips the tier server-side). Returns the fresh tier, or null on failure.
   */
  refreshUser: () => Promise<'free' | 'pro' | null>;
  /**
   * Re-fetch `GET /account` and refresh `aiPlansMonth`. Best-effort (never
   * throws). Called after an interactive `login()` and after a successful
   * generation so the "X of N plans" line reflects the latest usage (g3).
   */
  refreshAiPlansQuota: () => Promise<void>;
}

/**
 * Auth state for the app. On mount, attempts auto-login by reading persisted
 * tokens from SecureStore and fetching /account. `isLoading` stays true until
 * this check completes, allowing screens to show a splash/skeleton.
 */
const ADMIN_DOMAIN = '@locallist.ai';

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isPro: false,
  isAdmin: false,
  isLoading: true,
  aiPlansMonth: null,
  login: async () => { },
  logout: async () => { },
  refreshUser: async () => null,
  refreshAiPlansQuota: async () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiPlansMonth, setAiPlansMonth] = useState<AiPlansQuota | null>(null);

  const isAdmin = !!user?.email?.endsWith(ADMIN_DOMAIN);
  // `isPro` derives from the REAL server-side tier. Dev tools flip `User.Tier`
  // on the backend and re-fetch `/account`, so the local flag and the server
  // gates always agree (no client-only override that lies to `isPro`).
  const effectiveTier = user?.tier ?? 'free';

  // Best-effort refresh of the monthly AI-plan quota from `GET /account`. Kept
  // separate from `refreshUser` so callers can update just the quota (after a
  // generation) without re-touching user/tier. Never throws.
  const refreshAiPlansQuota = useCallback(async () => {
    try {
      const res = await api<{ user: User }>('/account');
      setAiPlansMonth(parseAiPlansQuota(res.data));
    } catch (error) {
      logger.warn('refreshAiPlansQuota failed', error);
    }
  }, []);

  const login = useCallback(async (userData: User, accessToken: string, refreshToken: string) => {
    await setTokens(accessToken, refreshToken);
    setAnalyticsUserId(userData.id);
    setUser(userData);
    // Having authenticated on this device retires the marketing onboarding for
    // good — the entry-gate's guest state must NOT be re-derived from it. Root
    // fix for both MAJORs: after a later logout, or a transient auto-login
    // failure, `onboarding_completed` stays true so the gate lands on the app
    // (as a degraded guest), never back on the marketing onboarding. Best-effort:
    // the flag is set synchronously in-memory; a persistence blip must not fail login.
    try {
      await completeOnboarding();
    } catch (error) {
      logger.warn('completeOnboarding during login failed', error);
    }
    // Deferred sync of any guest onboarding prefs (city/budget) to the profile,
    // then clear them. Best-effort: a failure must not fail the login (the prefs
    // stay for the next attempt). Only the interactive login()/register path runs
    // this — a cold-start auto-login is a returning user who already synced.
    try {
      await syncOnboardingPrefsToProfile();
    } catch (error) {
      logger.warn('onboarding prefs sync during login failed', error);
    }
    // Populate the quota right after an interactive login — the startup
    // auto-login effect only fires on cold start, so without this a freshly
    // registered free user never sees their "X of N plans" line (g3).
    await refreshAiPlansQuota();
    // Favorites: replay any pending guest heart-tap, then hydrate the id set for
    // the session. Both best-effort — a failure never breaks login.
    try {
      await applyPendingFavorite();
      await loadFavoriteIds();
    } catch (error) {
      logger.warn('favorites hydration during login failed', error);
    }
    // "Save this plan": replay a staged guest clone intent (onboarding hook). The
    // replay stages a landing id the app shell navigates to once mounted. Never
    // throws by contract; wrapped as extra defence so nothing can break login.
    try {
      await applyPendingClonePlan();
    } catch (error) {
      logger.warn('clone-plan replay during login failed', error);
    }
  }, [refreshAiPlansQuota]);

  const logout = useCallback(async () => {
    // La sesión muere ANTES de tocar RevenueCat y sin ningún await entre la
    // limpieza de estado y logOutPurchases: si hubiera un await en medio, un
    // handler de foreground (usePurchaseReconciliation) podría colarse con la
    // sesión aún "viva" y re-adoptar la identidad RC recién desvinculada.
    setUser(null);
    setAiPlansMonth(null);
    setAnalyticsUserId(null);
    // logOutPurchases es síncrona y por contrato no lanza (la llamada de red
    // del SDK va encolada en fire-and-forget); el try/catch es defensa extra:
    // nada de RevenueCat puede bloquear el logout.
    try {
      logOutPurchases();
    } catch (error) {
      logger.warn('logOutPurchases failed during logout', error);
    }
    // El recordatorio de trial pertenece a la sesión que compró: al cerrar
    // sesión se cancela (síncrona, por contrato nunca lanza; try/catch como
    // defensa extra — nada puede bloquear el logout).
    try {
      cancelTrialReminder('logout');
    } catch (error) {
      logger.warn('cancelTrialReminder failed during logout', error);
    }
    // Favorites belong to the session: drop the cached id set on logout.
    try {
      clearFavorites();
    } catch (error) {
      logger.warn('clearFavorites failed during logout', error);
    }
    // Any staged "save this plan" intent/landing is session-scoped too.
    try {
      clearCloneState();
    } catch (error) {
      logger.warn('clearCloneState failed during logout', error);
    }
    await clearTokens();
  }, []);

  // Re-fetch /account (e.g. after purchase/restore, or a dev tier flip) so
  // `isPro` reflects the real server-side tier without an app restart.
  const refreshUser = useCallback(async (): Promise<'free' | 'pro' | null> => {
    try {
      const res = await api<{ user: User }>('/account');
      if (res.data?.user) {
        setUser(res.data.user);
        return res.data.user.tier;
      }
      return null;
    } catch (error) {
      logger.warn('refreshUser failed', error);
      return null;
    }
  }, []);

  // Auto-login: try to load user from stored token on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setIsLoading(false);
          return;
        }
        const res = await api<{ user: User }>('/account');
        if (res.data?.user) {
          setAnalyticsUserId(res.data.user.id);
          setUser(res.data.user);
          // Tolerant parse — quota field is optional until api m4 ships.
          setAiPlansMonth(parseAiPlansQuota(res.data));
          // A successful auto-login also retires the marketing onboarding: if a
          // *future* cold start fails to reach /account transiently, the flag is
          // already true, so the gate degrades to the guest app, not onboarding.
          try {
            await completeOnboarding();
          } catch (error) {
            logger.warn('completeOnboarding during auto-login failed', error);
          }
          // Returning user: hydrate the favorite id set (best-effort).
          loadFavoriteIds().catch((error) =>
            logger.warn('loadFavoriteIds during auto-login failed', error),
          );
        }
      } catch (error) {
        logger.warn('Auto-login failed, starting fresh', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        isAuthenticated: !!user,
        isPro: effectiveTier === 'pro',
        isAdmin,
        isLoading,
        aiPlansMonth,
        login,
        logout,
        refreshUser,
        refreshAiPlansQuota,
      },
    },
    children,
  );
}
