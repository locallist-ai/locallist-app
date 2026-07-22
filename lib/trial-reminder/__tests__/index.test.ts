/**
 * Comportamiento del wiring (`index.ts`) con el módulo nativo PRESENTE
 * (mock del loader): adapter de expo-notifications, permiso en el momento de
 * la compra, cancel_stale en compra sin trial y reconciliación end-to-end
 * (payload → decisión → cancel). La lógica de decisión pura ya está cubierta
 * en logic.test.ts; aquí se verifica que el wiring la ejecuta de verdad.
 */
import {
  TRIAL_REMINDER_ID,
  cancelTrialReminder,
  reconcileTrialReminder,
  syncTrialReminderAfterPurchase,
} from '../index';
import { FREE_TIER_GRACE_MS, computeReminderTriggerDate } from '../logic';

// var (no const): el factory de jest.mock se evalúa en el require del módulo,
// antes de que un `const` del test file estuviera inicializado.
/* eslint-disable no-var */
var mockN: {
  IosAuthorizationStatus: { PROVISIONAL: number };
  SchedulableTriggerInputTypes: { DATE: string };
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
};
/* eslint-enable no-var */

jest.mock('../native-module', () => ({
  getNotificationsModule: () => mockN,
  isNotificationsAvailable: () => true,
}));
jest.mock('../../i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, opts?: { date?: string }) => (opts?.date ? `${key}:${opts.date}` : key),
    language: 'en',
  },
}));
jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
  mockN = {
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
    scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  };
});

function pendingRequest(purchasedAt: Date) {
  return {
    identifier: TRIAL_REMINDER_ID,
    content: { data: { purchasedAt: purchasedAt.toISOString() } },
  };
}

// ─── Programación ────────────────────────────────────────

it('trial real: programa con identificador fijo, trigger a +5d 10:00, sonido y purchasedAt en el payload', async () => {
  const purchasedAt = new Date(2026, 6, 22, 18, 0, 0);

  const result = await syncTrialReminderAfterPurchase({
    packageType: 'ANNUAL',
    entitlementPeriodType: 'TRIAL',
    outcomeStatus: 'success',
    purchasedAt,
  });

  expect(result).toBe('scheduled');
  expect(mockN.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const call = mockN.scheduleNotificationAsync.mock.calls[0][0];
  expect(call.identifier).toBe(TRIAL_REMINDER_ID);
  expect(call.trigger).toEqual({ type: 'date', date: computeReminderTriggerDate(purchasedAt) });
  expect(call.content.data.purchasedAt).toBe(purchasedAt.toISOString());
  expect(call.content.title).toBe('trialReminder.notificationTitle');
  expect(call.content.body).toContain('trialReminder.notificationBody:');
});

it('permiso aún no pedido: pregunta EN la compra; denegado ⇒ permission_denied sin programar (la compra no se rompe)', async () => {
  mockN.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
  mockN.requestPermissionsAsync.mockResolvedValue({ granted: false });

  const result = await syncTrialReminderAfterPurchase({
    packageType: 'ANNUAL',
    entitlementPeriodType: 'TRIAL',
    outcomeStatus: 'success',
    purchasedAt: new Date(),
  });

  expect(result).toBe('permission_denied');
  expect(mockN.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(mockN.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('fallo del scheduler nativo queda contenido: resultado "error", nunca throw hacia el paywall', async () => {
  mockN.scheduleNotificationAsync.mockRejectedValue(new Error('native boom'));

  await expect(
    syncTrialReminderAfterPurchase({
      packageType: 'ANNUAL',
      entitlementPeriodType: 'TRIAL',
      outcomeStatus: 'success',
      purchasedAt: new Date(),
    }),
  ).resolves.toBe('error');
});

// ─── Cancel stale (MINOR-1) ──────────────────────────────

it('compra efectiva SIN trial real cancela el pendiente obsoleto (cambio de plan durante el trial)', async () => {
  const result = await syncTrialReminderAfterPurchase({
    packageType: 'MONTHLY',
    entitlementPeriodType: 'NORMAL',
    outcomeStatus: 'success',
    purchasedAt: new Date(),
  });

  expect(result).toBe('cancelled_stale');
  expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledWith(TRIAL_REMINDER_ID);
  expect(mockN.scheduleNotificationAsync).not.toHaveBeenCalled();
});

// ─── Reconciliación end-to-end ───────────────────────────

it('reconcile con tier pro: atajo, ni siquiera consulta el scheduler', async () => {
  await reconcileTrialReminder({ tier: 'pro', wasPro: true });
  expect(mockN.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(mockN.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});

it('reconcile pro→free con pendiente: lee purchasedAt del payload y cancela', async () => {
  mockN.getAllScheduledNotificationsAsync.mockResolvedValue([pendingRequest(new Date())]);

  await reconcileTrialReminder({ tier: 'free', wasPro: true });

  expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledWith(TRIAL_REMINDER_ID);
});

it('reconcile free sin transición y compra dentro de la gracia: conserva (webhook en vuelo)', async () => {
  mockN.getAllScheduledNotificationsAsync.mockResolvedValue([pendingRequest(new Date())]);

  await reconcileTrialReminder({ tier: 'free', wasPro: false });

  expect(mockN.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});

it('reconcile free sin transición y compra fuera de la gracia: cancela el huérfano', async () => {
  const stale = new Date(Date.now() - FREE_TIER_GRACE_MS - 60 * 60 * 1000);
  mockN.getAllScheduledNotificationsAsync.mockResolvedValue([pendingRequest(stale)]);

  await reconcileTrialReminder({ tier: 'free', wasPro: false });

  expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledWith(TRIAL_REMINDER_ID);
});

it('cancelTrialReminder cancela por identificador y nunca lanza aunque el nativo falle', async () => {
  mockN.cancelScheduledNotificationAsync.mockRejectedValue(new Error('native boom'));
  expect(() => cancelTrialReminder('logout')).not.toThrow();
  // El rechazo async queda tragado por el catch interno (fire-and-forget).
  await Promise.resolve();
  expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledWith(TRIAL_REMINDER_ID);
});
