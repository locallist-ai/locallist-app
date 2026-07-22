import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setTokens, clearTokens, getAccessToken } from './api';
import { logger } from './logger';
import { setAnalyticsUserId } from './analytics';
import { logOutPurchases } from './purchases';

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
  login: (userData: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Re-fetch `GET /account` and update user state (e.g. after an IAP purchase
   * flips the tier server-side). Returns the fresh tier, or null on failure.
   */
  refreshUser: () => Promise<'free' | 'pro' | null>;
  /** Override tier locally for testing. Pass null to reset to real tier. */
  setTierOverride: (tier: 'free' | 'pro' | null) => void;
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
  login: async () => { },
  logout: async () => { },
  refreshUser: async () => null,
  setTierOverride: () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tierOverride, setTierOverride] = useState<'free' | 'pro' | null>(null);

  const isAdmin = !!user?.email?.endsWith(ADMIN_DOMAIN);
  const effectiveTier = tierOverride ?? user?.tier ?? 'free';

  const login = useCallback(async (userData: User, accessToken: string, refreshToken: string) => {
    await setTokens(accessToken, refreshToken);
    setAnalyticsUserId(userData.id);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    // Desvincula la identidad de RevenueCat para que el siguiente usuario del
    // mismo proceso nunca compre bajo el appUserID anterior. No lanza nunca
    // (try/catch interno): un fallo del SDK no bloquea el logout de la app.
    await logOutPurchases();
    await clearTokens();
    setAnalyticsUserId(null);
    setUser(null);
    setTierOverride(null);
  }, []);

  // Re-fetch /account (e.g. after purchase/restore) so `isPro` flips without
  // an app restart. Does not touch tierOverride: dev override keeps winning.
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
        login,
        logout,
        refreshUser,
        setTierOverride,
      },
    },
    children,
  );
}
