import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setTokens, clearTokens, getAccessToken } from './api';
import { useDevPreferences, getMockUserForProfile } from './dev-preferences';

const USE_MOCK = __DEV__;

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tier: 'free' | 'pro';
}

type UserTier = 'anonymous' | 'free' | 'pro';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPro: boolean;
  userTier: UserTier;
  login: (provider: 'apple' | 'google', idToken: string, name?: string) => Promise<void>;
  loginWithMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { mockProfile } = USE_MOCK ? useDevPreferences() : { mockProfile: 'pro' as const };
  const mockUser = USE_MOCK ? getMockUserForProfile(mockProfile) : null;

  const [user, setUser] = useState<User | null>(USE_MOCK ? mockUser : null);
  const [isLoading, setIsLoading] = useState(USE_MOCK ? false : true);

  // Sync user state when mockProfile changes
  useEffect(() => {
    if (USE_MOCK) {
      setUser(getMockUserForProfile(mockProfile));
    }
  }, [mockProfile]);

  const refreshUser = useCallback(async () => {
    if (USE_MOCK) {
      setUser(getMockUserForProfile(mockProfile));
      setIsLoading(false);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const { data } = await api<User>('/account');
    if (data) {
      setUser(data);
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, [mockProfile]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (provider: 'apple' | 'google', idToken: string, name?: string) => {
      const { data, error } = await api<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('/auth/signin', {
        method: 'POST',
        body: { provider, idToken, name },
        auth: false,
      });

      if (data) {
        await setTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
      } else {
        throw new Error(error ?? 'Login failed');
      }
    },
    []
  );

  const loginWithMagicLink = useCallback(async (email: string) => {
    const { error } = await api('/auth/magic-link', {
      method: 'POST',
      body: { email },
      auth: false,
    });
    if (error) throw new Error(error);
  }, []);

  const verifyMagicLink = useCallback(async (token: string) => {
    const { data, error } = await api<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/verify', {
      method: 'POST',
      body: { token },
      auth: false,
    });

    if (data) {
      await setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    } else {
      throw new Error(error ?? 'Verification failed');
    }
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  const userTier: UserTier = user ? (user.tier as 'free' | 'pro') : 'anonymous';

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPro: user?.tier === 'pro',
    userTier,
    login,
    loginWithMagicLink,
    verifyMagicLink,
    logout,
    refreshUser,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
