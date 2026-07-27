/**
 * Tests de `app/login.tsx` — resolución del MODO INICIAL (log-in vs register)
 * a partir del route param `intent`/`mode` y de la prop `initialMode`.
 *
 * `useAuthForm` se mockea para inspeccionar con qué modo lo arranca la pantalla
 * (el comportamiento interno del hook ya está cubierto en useAuthForm.test.ts).
 * Así el test aísla la ÚNICA responsabilidad nueva de la pantalla: traducir la
 * intención de entrada (deep link `/login?intent=register` o prop inline) al modo
 * con el que abre el flujo.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import LoginScreen from '../login';
import { useAuthForm } from '../../lib/auth/useAuthForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('../../lib/responsive', () => ({
  useResponsive: () => ({ compact: false, short: false, scale: (n: number) => n, scaleFont: (n: number) => n }),
}));
jest.mock('../../lib/auth/useAuthForm', () => ({
  useAuthForm: jest.fn(),
}));

const mockUseAuthForm = useAuthForm as jest.MockedFunction<typeof useAuthForm>;
const mockUseParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

function authFormStub() {
  return {
    step: 'choose' as const,
    authMode: 'signin' as const,
    credentialsMode: 'login' as const,
    email: '',
    password: '',
    name: '',
    loading: null,
    error: null,
    appleAvailable: false,
    passwordStrength: 0,
    emailInputRef: { current: null },
    setEmail: jest.fn(),
    setPassword: jest.fn(),
    setName: jest.fn(),
    handleAppleSignIn: jest.fn(),
    handleGoogleSignIn: jest.fn(),
    selectAuthMode: jest.fn(),
    goToCredentials: jest.fn(),
    toggleCredentialsMode: jest.fn(),
    backToChoose: jest.fn(),
    submitCredentials: jest.fn(),
  } as unknown as ReturnType<typeof useAuthForm>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthForm.mockReturnValue(authFormStub());
  mockUseParams.mockReturnValue({});
});

describe('LoginScreen — initial mode resolution', () => {
  it('opens the flow on REGISTER when deep-linked with intent=register', () => {
    mockUseParams.mockReturnValue({ intent: 'register' });
    render(<LoginScreen />);
    expect(mockUseAuthForm).toHaveBeenCalledWith('signup');
  });

  it('opens the flow on LOG IN by default (bare /login, no intent)', () => {
    render(<LoginScreen />);
    expect(mockUseAuthForm).toHaveBeenCalledWith('signin');
  });

  it('accepts the `mode=register` param alias', () => {
    mockUseParams.mockReturnValue({ mode: 'register' });
    render(<LoginScreen />);
    expect(mockUseAuthForm).toHaveBeenCalledWith('signup');
  });

  it('lets an inline host force register via the initialMode prop', () => {
    render(<LoginScreen initialMode="signup" />);
    expect(mockUseAuthForm).toHaveBeenCalledWith('signup');
  });

  it('the initialMode prop overrides a conflicting route param', () => {
    mockUseParams.mockReturnValue({ intent: 'register' });
    render(<LoginScreen initialMode="signin" />);
    expect(mockUseAuthForm).toHaveBeenCalledWith('signin');
  });
});
