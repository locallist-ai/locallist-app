/**
 * Tests de `useTrialReminder` con el módulo nativo PRESENTE (loader mockeado):
 * dedupe del tap (evento + deep link una sola vez por notificación),
 * short-circuit con tier pro y cancelación vía reconcile en pro→free.
 * El caso "módulo ausente" vive en useTrialReminder.unavailable.test.tsx
 * (necesita otra instancia del módulo del hook, decidida en el import).
 */
import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useAuth } from '../../auth';
import { track } from '../../analytics';
import { reconcileTrialReminder } from '../index';
import {
  useTrialReminder,
  resetTrialReminderResponseDedupeForTesting,
} from '../useTrialReminder';

jest.mock('../native-module', () => {
  const N = {
    setNotificationHandler: jest.fn(),
    useLastNotificationResponse: jest.fn(),
  };
  return {
    getNotificationsModule: () => N,
    isNotificationsAvailable: () => true,
    __mockN: N,
  };
});
jest.mock('../index', () => ({
  reconcileTrialReminder: jest.fn().mockResolvedValue(undefined),
  TRIAL_REMINDER_ID: 'trial-reminder-day5',
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../auth', () => ({ useAuth: jest.fn() }));
jest.mock('../../analytics', () => ({ track: jest.fn() }));

const { __mockN } = jest.requireMock('../native-module') as {
  __mockN: { setNotificationHandler: jest.Mock; useLastNotificationResponse: jest.Mock };
};
const mockUseAuth = useAuth as jest.Mock;
const mockTrack = track as jest.Mock;
const mockPush = router.push as jest.Mock;
const mockReconcile = reconcileTrialReminder as jest.Mock;

function response(identifier: string, date: number) {
  return { notification: { date, request: { identifier } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetTrialReminderResponseDedupeForTesting();
  mockUseAuth.mockReturnValue({ isPro: false });
  __mockN.useLastNotificationResponse.mockReturnValue(undefined);
});

it('registra el handler de presentación en foreground al montar', () => {
  renderHook(() => useTrialReminder());
  expect(__mockN.setNotificationHandler).toHaveBeenCalledTimes(1);
});

it('tap del recordatorio: emite trial_reminder_shown {day:5} y navega a cuenta UNA vez (dedupe)', () => {
  __mockN.useLastNotificationResponse.mockReturnValue(response('trial-reminder-day5', 111));
  const { rerender } = renderHook(() => useTrialReminder());

  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockTrack).toHaveBeenCalledWith({ event: 'trial_reminder_shown', day: 5 });
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/account');

  // La misma response re-entregada (re-render / remontaje) no duplica.
  rerender(undefined);
  expect(mockTrack).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);

  // Una notificación NUEVA (otra fecha) sí vuelve a contar.
  __mockN.useLastNotificationResponse.mockReturnValue(response('trial-reminder-day5', 222));
  rerender(undefined);
  expect(mockTrack).toHaveBeenCalledTimes(2);
});

it('una response de otra notificación no emite ni navega', () => {
  __mockN.useLastNotificationResponse.mockReturnValue(response('other-notification', 111));
  renderHook(() => useTrialReminder());

  expect(mockTrack).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it('tier pro: short-circuit, no reconcilia (caso mayoritario, trial activo)', () => {
  mockUseAuth.mockReturnValue({ isPro: true });
  renderHook(() => useTrialReminder());

  expect(mockReconcile).not.toHaveBeenCalled();
});

it('transición pro→free observada: reconcilia con wasPro=true (cancela el huérfano)', () => {
  mockUseAuth.mockReturnValue({ isPro: true });
  const { rerender } = renderHook(() => useTrialReminder());
  expect(mockReconcile).not.toHaveBeenCalled();

  mockUseAuth.mockReturnValue({ isPro: false });
  rerender(undefined);

  expect(mockReconcile).toHaveBeenCalledTimes(1);
  expect(mockReconcile).toHaveBeenCalledWith({ tier: 'free', wasPro: true });
});

it('montaje ya en free (cold start tras expirar): reconcilia con wasPro=false (decide la gracia)', () => {
  renderHook(() => useTrialReminder());

  expect(mockReconcile).toHaveBeenCalledTimes(1);
  expect(mockReconcile).toHaveBeenCalledWith({ tier: 'free', wasPro: false });
});
