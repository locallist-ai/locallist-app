import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import '@react-native-firebase/app';
import { getAuth, onAuthStateChanged, signOut } from '@react-native-firebase/auth';
import { api } from './api';
import { logger } from './logger';

function getFirebaseAuth() {
  return getAuth();
}

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tier: 'free' | 'pro';
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isPro: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  syncError: string | null;
  retrySync: () => Promise<void>;
  logout: () => Promise<void>;
  setTierOverride: (tier: 'free' | 'pro' | null) => void;
}

const ADMIN_DOMAIN = '@locallist.ai';

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isPro: false,
  isAdmin: false,
  isLoading: true,
  syncError: null,
  retrySync: async () => { },
  logout: async () => { },
  setTierOverride: () => { },
});

export function useAuth() {
  return useContext(AuthContext);
}

async function syncUserWithBackend(): Promise<User | null> {
  const res = await api<{ user: User }>('/auth/sync', { method: 'POST' });
  if (res.data?.user) {
    return res.data.user;
  }
  logger.warn('Backend sync failed', res.error);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [tierOverride, setTierOverride] = useState<'free' | 'pro' | null>(null);
  const syncingRef = React.useRef(false);

  const isAdmin = !!user?.email?.endsWith(ADMIN_DOMAIN);
  const effectiveTier = tierOverride ?? user?.tier ?? 'free';

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const backendUser = await syncUserWithBackend();
      if (backendUser) {
        setUser(backendUser);
        setSyncError(null);
      } else {
        setUser(null);
        setSyncError('Could not connect to server. Please try again.');
      }
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const retrySync = useCallback(async () => {
    if (!getFirebaseAuth().currentUser) return;
    setIsLoading(true);
    await doSync();
    setIsLoading(false);
  }, [doSync]);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setUser(null);
    setSyncError(null);
    setTierOverride(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        await doSync();
      } else {
        setUser(null);
        setSyncError(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [doSync]);

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        isAuthenticated: !!user,
        isPro: effectiveTier === 'pro',
        isAdmin,
        isLoading,
        syncError,
        retrySync,
        logout,
        setTierOverride,
      },
    },
    children,
  );
}
