/**
 * The dead-end fix at the real `app/login.tsx`: when the onboarding flow renders
 * the login inline it passes `onClose`, which surfaces a back affordance so the
 * user can return to the value screens. As a modal route (no `onClose`) the
 * affordance is absent (native dismiss handles it).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import LoginScreen from '../../app/login';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../responsive', () => ({ useResponsive: () => ({ compact: false }) }));
// Mutable so individual tests can drive the internal sub-step + observe backToChoose.
const mockAuthForm = {
  step: 'choose' as 'choose' | 'credentials',
  authMode: 'signin',
  credentialsMode: 'login',
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
};
jest.mock('../auth/useAuthForm', () => ({ useAuthForm: () => mockAuthForm }));
jest.mock('../../components/auth/AuthModeToggle', () => ({ AuthModeToggle: () => null }));
jest.mock('../../components/auth/AppleSignInButton', () => ({ AppleSignInButton: () => null }));
jest.mock('../../components/auth/GoogleSignInButton', () => ({ GoogleSignInButton: () => null }));
jest.mock('../../components/auth/EmailSignInButton', () => ({ EmailSignInButton: () => null }));
jest.mock('../../components/auth/CredentialsForm', () => ({ CredentialsForm: () => null }));

beforeEach(() => {
  mockAuthForm.step = 'choose';
  mockAuthForm.backToChoose.mockClear();
});

describe('login dead-end exit', () => {
  it('renders a dismiss affordance and calls onClose when passed (inline onboarding path)', () => {
    const onClose = jest.fn();
    render(<LoginScreen onClose={onClose} />);
    const close = screen.getByTestId('login-close');
    fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the dismiss affordance when used as a modal route (no onClose)', () => {
    render(<LoginScreen />);
    expect(screen.queryByTestId('login-close')).toBeNull();
  });

  // MINOR-2 (UX Android): the login publishes an internal back handler so an inline
  // host can honour the credentials → choose sub-step on the physical back button.
  it('registers an inner-back handler that yields (false) on the choose sub-step', () => {
    mockAuthForm.step = 'choose';
    const onRegisterInnerBack = jest.fn();
    render(<LoginScreen onClose={jest.fn()} onRegisterInnerBack={onRegisterInnerBack} />);
    const handler = onRegisterInnerBack.mock.calls.at(-1)?.[0] as () => boolean;
    expect(handler()).toBe(false); // not consumed → host dismisses the whole login
    expect(mockAuthForm.backToChoose).not.toHaveBeenCalled();
  });

  it('registers an inner-back handler that returns to choose (true) on the credentials sub-step', () => {
    mockAuthForm.step = 'credentials';
    const onRegisterInnerBack = jest.fn();
    render(<LoginScreen onClose={jest.fn()} onRegisterInnerBack={onRegisterInnerBack} />);
    const handler = onRegisterInnerBack.mock.calls.at(-1)?.[0] as () => boolean;
    expect(handler()).toBe(true); // consumed → login stays open, steps back
    expect(mockAuthForm.backToChoose).toHaveBeenCalledTimes(1);
  });
});
