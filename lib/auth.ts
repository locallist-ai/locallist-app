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
  isLoading: boolean;
  login: (userData: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Auth state for the app. On mount, attempts auto-login by reading persisted
 * tokens from SecureStore and fetching /account. `isLoading` stays true until
 * this check completes, allowing screens to show a splash/skeleton.
 */
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isPro: false,
  isLoading: true,
  login: async () => { },
  logout: async () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(async (userData: User, accessToken: string, refreshToken: string) => {
    await setTokens(accessToken, refreshToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
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
        isPro: user?.tier === 'pro',
        isLoading,
        login,
        logout,
      },
    },
    children,
  );
}
