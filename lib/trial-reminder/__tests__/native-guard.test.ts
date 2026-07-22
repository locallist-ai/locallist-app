/**
 * C1 del review: sobre un binario SIN el módulo nativo de expo-notifications
 * (dev client previo al rebuild), el `require` del paquete LANZA al evaluarse.
 * Este suite simula exactamente eso (factory de jest que lanza en el require)
 * y verifica que la carga es perezosa+guardada y TODO el API degrada a no-op
 * — nunca un crash de arranque en la cadena app/_layout → lib/auth.
 */
import { logger } from '../../logger';
import {
  getNotificationsModule,
  isNotificationsAvailable,
  resetNotificationsModuleForTesting,
} from '../native-module';
import {
  cancelTrialReminder,
  reconcileTrialReminder,
  syncTrialReminderAfterPurchase,
} from '../index';

// Simula el binario sin módulo nativo: requireNativeModule lanza al evaluar
// el paquete JS de expo-notifications.
jest.mock('expo-notifications', () => {
  throw new Error("Cannot find native module 'ExpoNotificationScheduler'");
});
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key, language: 'en' },
}));
jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockWarn = logger.warn as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetNotificationsModuleForTesting();
});

it('el require que lanza queda contenido: módulo null, disponible=false, y un solo warn por proceso', () => {
  expect(getNotificationsModule()).toBeNull();
  expect(isNotificationsAvailable()).toBe(false);
  // Detección cacheada: llamadas repetidas no re-lanzan ni re-loguean.
  expect(getNotificationsModule()).toBeNull();
  expect(mockWarn).toHaveBeenCalledTimes(1);
});

it('syncTrialReminderAfterPurchase degrada a "unavailable" sin lanzar', async () => {
  await expect(
    syncTrialReminderAfterPurchase({
      packageType: 'ANNUAL',
      entitlementPeriodType: 'TRIAL',
      outcomeStatus: 'success',
      purchasedAt: new Date(),
    }),
  ).resolves.toBe('unavailable');
});

it('cancelTrialReminder es no-op sin lanzar (camino del logout)', () => {
  expect(() => cancelTrialReminder('logout')).not.toThrow();
});

it('reconcileTrialReminder resuelve como no-op sin lanzar', async () => {
  await expect(reconcileTrialReminder({ tier: 'free', wasPro: true })).resolves.toBeUndefined();
});
