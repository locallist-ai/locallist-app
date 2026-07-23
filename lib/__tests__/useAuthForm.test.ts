/**
 * Tests de comportamiento de `useAuthForm` (lib/auth/useAuthForm.ts) —
 * lógica extraída de app/login.tsx en el refactor thin-screens.
 *
 * Cubre la validación y el happy-path de email login/register, que es la
 * lógica determinista y significativa del flujo (OAuth Apple/Google quedan
 * mockeados al nivel del provider). Nada de snapshots: solo comportamiento
 * observable (qué error se fija, si se llama a login()/api()).
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAuthForm } from '../auth/useAuthForm';
import { api, getAccessToken } from '../api';
import { useAuth } from '../auth';
import { router } from 'expo-router';
import type { AuthResponse } from '../types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: jest.fn(() => [null, null, jest.fn()]),
}));
jest.mock('../api', () => ({
  api: jest.fn(),
  getAccessToken: jest.fn(() => Promise.resolve('existing-token')),
}));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));
jest.mock('../analytics', () => ({ track: jest.fn() }));

const mockApi = api as jest.MockedFunction<typeof api>;
const mockGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockRouter = router as unknown as { canGoBack: jest.Mock; back: jest.Mock; replace: jest.Mock };
const login = jest.fn();

const okResponse: AuthResponse = {
  user: { id: 'u1', email: 'a@b.com', tier: 'free' } as AuthResponse['user'],
  accessToken: 'at',
  refreshToken: 'rt',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockResolvedValue('existing-token');
  mockUseAuth.mockReturnValue({ login } as unknown as ReturnType<typeof useAuth>);
  mockRouter.canGoBack.mockReturnValue(true);
});

describe('useAuthForm — email login', () => {
  it('rejects an invalid email without calling the API', async () => {
    const { result } = renderHook(() => useAuthForm());
    act(() => {
      result.current.setEmail('not-an-email');
      result.current.setPassword('whatever');
    });
    await act(async () => {
      await result.current.submitCredentials();
    });
    expect(result.current.error).toBe('auth.errorInvalidEmail');
    expect(mockApi).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects an empty password without calling the API', async () => {
    const { result } = renderHook(() => useAuthForm());
    act(() => {
      result.current.setEmail('a@b.com');
      result.current.setPassword('');
    });
    await act(async () => {
      await result.current.submitCredentials();
    });
    expect(result.current.error).toBe('auth.errorPasswordRequired');
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('logs in on a successful response', async () => {
    mockApi.mockResolvedValue({ data: okResponse, error: null, errorBody: null, status: 200 });
    const { result } = renderHook(() => useAuthForm());
    act(() => {
      result.current.setEmail(' a@b.com ');
      result.current.setPassword('secret123');
    });
    await act(async () => {
      await result.current.submitCredentials();
    });
    expect(mockApi).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.com', password: 'secret123' },
    });
    expect(login).toHaveBeenCalledWith(okResponse.user, 'at', 'rt');
    expect(result.current.error).toBeNull();
    // Login modal closes after a successful login (guest mode: it's a modal on
    // top of the app stack, so pop it).
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('falls back to the home tab when there is nothing to pop (inline onboarding login)', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    mockApi.mockResolvedValue({ data: okResponse, error: null, errorBody: null, status: 200 });
    const { result } = renderHook(() => useAuthForm());
    act(() => {
      result.current.setEmail('a@b.com');
      result.current.setPassword('secret123');
    });
    await act(async () => {
      await result.current.submitCredentials();
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('does NOT navigate away when login fails', async () => {
    mockApi.mockResolvedValue({ data: null, error: 'bad creds', errorBody: null, status: 401 });
    const { result } = renderHook(() => useAuthForm());
    act(() => {
      result.current.setEmail('a@b.com');
      result.current.setPassword('secret123');
    });
    await act(async () => {
      await result.current.submitCredentials();
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('surfaces the API error on failure', async () => {
    mockApi.mockResolvedValue({ data: null, error: 'bad creds', errorBody: null, status: 401 });
    const { result } = renderHook(() => useAuthForm());
    act(() => {
      result.current.setEmail('a@b.com');
      result.current.setPassword('secret123');
    });
    await act(async () => {
      await result.current.submitCredentials();
    });
    expect(result.current.error).toBe('bad creds');
    expect(login).not.toHaveBeenCalled();
  });
});

describe('useAuthForm — register', () => {
  it('switches to register and hits the register endpoint on submit', async () => {
    mockApi.mockResolvedValue({ data: okResponse, error: null, errorBody: null, status: 200 });
    const { result } = renderHook(() => useAuthForm());
    act(() => {
      result.current.toggleCredentialsMode(); // login → register
    });
    expect(result.current.credentialsMode).toBe('register');
    act(() => {
      result.current.setEmail('a@b.com');
      result.current.setPassword('Abcdef1!');
      result.current.setName(' Pablo ');
    });
    await act(async () => {
      await result.current.submitCredentials();
    });
    expect(mockApi).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: { email: 'a@b.com', password: 'Abcdef1!', name: 'Pablo' },
    });
    expect(login).toHaveBeenCalledWith(okResponse.user, 'at', 'rt');
    // Registration also closes the login screen.
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('derives full password strength only in register mode', async () => {
    const { result } = renderHook(() => useAuthForm());
    // login mode → strength stays 0 regardless of password
    act(() => result.current.setPassword('Abcdef1!'));
    expect(result.current.passwordStrength).toBe(0);
    // register mode → all 5 rules met
    act(() => result.current.toggleCredentialsMode());
    act(() => result.current.setPassword('Abcdef1!'));
    expect(result.current.passwordStrength).toBe(5);
  });
});
