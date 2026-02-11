/**
 * Dev Preferences — toggle mock user profile in development.
 * Only active when __DEV__ is true. In production this is a no-op passthrough.
 */
import React, { createContext, useContext, useState } from 'react';
import { MOCK_USER } from './mock-data';

export type MockProfile = 'anonymous' | 'free' | 'pro';

interface DevPreferencesContextType {
  mockProfile: MockProfile;
  setMockProfile: (profile: MockProfile) => void;
}

const DevPreferencesContext = createContext<DevPreferencesContextType>({
  mockProfile: 'pro',
  setMockProfile: () => {},
});

export function DevPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [mockProfile, setMockProfile] = useState<MockProfile>('pro');

  return React.createElement(
    DevPreferencesContext.Provider,
    { value: { mockProfile, setMockProfile } },
    children,
  );
}

export function useDevPreferences(): DevPreferencesContextType {
  return useContext(DevPreferencesContext);
}

/** Returns the mock user object for the given profile, or null for anonymous */
export function getMockUserForProfile(profile: MockProfile) {
  if (profile === 'anonymous') return null;
  return { ...MOCK_USER, tier: profile as 'free' | 'pro' };
}
