import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setTokens, clearTokens, getAccessToken } from './api';
import { logger } from './logger';

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
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
    setTierOverride(null);
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
        setTierOverride,
      },
    },
    children,
  );
}
