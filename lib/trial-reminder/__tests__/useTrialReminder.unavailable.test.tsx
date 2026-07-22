/**
 * C1, variante hook: sin módulo nativo (loader devuelve null en el import del
 * hook) `useTrialReminder` monta la alternativa no-op de
 * `useLastNotificationResponse`, no registra handler y NO crashea. La
 * reconciliación sigue invocándose (ya es no-op aguas abajo). En fichero
 * propio porque la disponibilidad se decide una vez al evaluar el módulo.
 */
import { renderHook } from '@testing-library/react-native';
import { useAuth } from '../../auth';
import { reconcileTrialReminder } from '../index';
import { useTrialReminder } from '../useTrialReminder';

jest.mock('../native-module', () => ({
  getNotificationsModule: () => null,
  isNotificationsAvailable: () => false,
}));
jest.mock('../index', () => ({
  reconcileTrialReminder: jest.fn().mockResolvedValue(undefined),
  TRIAL_REMINDER_ID: 'trial-reminder-day5',
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../auth', () => ({ useAuth: jest.fn() }));
jest.mock('../../analytics', () => ({ track: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockReconcile = reconcileTrialReminder as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ isPro: false });
});

it('sin módulo nativo el hook monta y re-renderiza sin crash (no-op estable, orden de hooks intacto)', () => {
  const { rerender } = renderHook(() => useTrialReminder());
  expect(() => rerender(undefined)).not.toThrow();
});

it('la reconciliación por tier sigue delegándose (no-op aguas abajo)', () => {
  renderHook(() => useTrialReminder());
  expect(mockReconcile).toHaveBeenCalledWith({ tier: 'free', wasPro: false });
});
