/**
 * Tests de la lógica pura del trial reminder (día 5 de 7) — fecha y scheduler
 * inyectados, sin nada nativo. Cubre el contrato del brief: programación a
 * +5 días (10:00 locales), idempotencia por identificador, permiso denegado
 * sin romper la compra, y cancelación por pérdida de entitlement (con la
 * ventana de gracia del webhook) — la cancelación por logout se cubre en
 * lib/__tests__/auth.test.tsx.
 */
import {
  FREE_TIER_GRACE_MS,
  REMINDER_HOUR_LOCAL,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAY,
  TRIAL_REMINDER_ID,
  computeFirstChargeDate,
  computeReminderTriggerDate,
  ensureReminderScheduled,
  isTrialReminderPurchase,
  shouldCancelReminder,
  type PendingReminder,
  type ReminderScheduler,
  type ScheduleReminderRequest,
} from '../logic';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ─── Trigger a +5 días, 10:00 locales ────────────────────

describe('computeReminderTriggerDate', () => {
  it('programa el día 5 tras la compra, a las 10:00 locales', () => {
    const purchasedAt = new Date(2026, 6, 22, 18, 45, 30); // 22 jul 18:45:30 local
    const trigger = computeReminderTriggerDate(purchasedAt);

    expect(trigger.getFullYear()).toBe(2026);
    expect(trigger.getMonth()).toBe(6);
    expect(trigger.getDate()).toBe(27); // 22 + 5
    expect(trigger.getHours()).toBe(REMINDER_HOUR_LOCAL);
    expect(trigger.getMinutes()).toBe(0);
    expect(trigger.getSeconds()).toBe(0);
  });

  it('con compra de madrugada sigue cayendo en el día 5 a las 10:00 (nunca antes del día 4)', () => {
    const purchasedAt = new Date(2026, 6, 22, 0, 30, 0);
    const trigger = computeReminderTriggerDate(purchasedAt);

    expect(trigger.getDate()).toBe(27);
    expect(trigger.getHours()).toBe(REMINDER_HOUR_LOCAL);
    // Entre día 4 y día 6 relativos a la compra: el aviso es "quedan 2 días".
    const elapsed = trigger.getTime() - purchasedAt.getTime();
    expect(elapsed).toBeGreaterThan(4 * DAY_MS);
    expect(elapsed).toBeLessThan(6 * DAY_MS);
  });

  it('el primer cobro es al terminar el trial (compra + 7 días) — día 8, nunca antes', () => {
    const purchasedAt = new Date(2026, 6, 22, 18, 0, 0);
    const charge = computeFirstChargeDate(purchasedAt);
    expect(charge.getTime() - purchasedAt.getTime()).toBe(TRIAL_DAYS * DAY_MS);
    // El recordatorio siempre dispara antes del primer cobro.
    expect(computeReminderTriggerDate(purchasedAt).getTime()).toBeLessThan(charge.getTime());
  });
});

// ─── Qué compras programan recordatorio ──────────────────

describe('isTrialReminderPurchase', () => {
  const base = { packageType: 'ANNUAL', hasIntroTrial: true, outcomeStatus: 'success' };

  it.each(['success', 'pending_backend'])('anual con trial y outcome %s programa', (outcomeStatus) => {
    expect(isTrialReminderPurchase({ ...base, outcomeStatus })).toBe(true);
  });

  it.each([
    ['mensual', { ...base, packageType: 'MONTHLY' }],
    ['sin trial', { ...base, hasIntroTrial: false }],
    ['cancelada', { ...base, outcomeStatus: 'cancelled' }],
    ['sin entitlement', { ...base, outcomeStatus: 'no_entitlement' }],
    ['error', { ...base, outcomeStatus: 'error' }],
  ])('%s NO programa', (_label, input) => {
    expect(isTrialReminderPurchase(input)).toBe(false);
  });
});

// ─── Programación: idempotencia y permiso ────────────────

function makeSchedulerMock(pending: PendingReminder | null = null) {
  const calls = {
    scheduled: [] as ScheduleReminderRequest[],
    cancelled: [] as string[],
  };
  const scheduler: ReminderScheduler = {
    getPending: jest.fn().mockResolvedValue(pending),
    schedule: jest.fn().mockImplementation(async (req: ScheduleReminderRequest) => {
      calls.scheduled.push(req);
    }),
    cancel: jest.fn().mockImplementation(async (id: string) => {
      calls.cancelled.push(id);
    }),
  };
  return { scheduler, calls };
}

const buildContent = (chargeDate: Date) => ({
  title: 'title',
  body: `charge:${chargeDate.toISOString()}`,
});

describe('ensureReminderScheduled', () => {
  const purchasedAt = new Date(2026, 6, 22, 18, 0, 0);

  it('programa UNA notificación con el identificador y el trigger del día 5', async () => {
    const { scheduler, calls } = makeSchedulerMock(null);

    const outcome = await ensureReminderScheduled(
      { ensurePermission: async () => true, scheduler, buildContent },
      purchasedAt,
    );

    expect(outcome).toBe('scheduled');
    expect(calls.scheduled).toHaveLength(1);
    expect(calls.cancelled).toHaveLength(0);
    const req = calls.scheduled[0];
    expect(req.identifier).toBe(TRIAL_REMINDER_ID);
    expect(req.triggerDate).toEqual(computeReminderTriggerDate(purchasedAt));
    expect(req.purchasedAt).toBe(purchasedAt);
    expect(req.content.body).toContain(computeFirstChargeDate(purchasedAt).toISOString());
  });

  it('idempotente: con una pendiente del mismo id, cancela antes de re-programar (nunca duplica)', async () => {
    const { scheduler, calls } = makeSchedulerMock({ purchasedAt: new Date(2026, 6, 20) });

    const outcome = await ensureReminderScheduled(
      { ensurePermission: async () => true, scheduler, buildContent },
      purchasedAt,
    );

    expect(outcome).toBe('scheduled');
    expect(calls.cancelled).toEqual([TRIAL_REMINDER_ID]);
    expect(calls.scheduled).toHaveLength(1);
  });

  it('permiso denegado: no programa, no cancela y NO lanza (la compra no se rompe)', async () => {
    const { scheduler, calls } = makeSchedulerMock(null);

    const outcome = await ensureReminderScheduled(
      { ensurePermission: async () => false, scheduler, buildContent },
      purchasedAt,
    );

    expect(outcome).toBe('permission_denied');
    expect(calls.scheduled).toHaveLength(0);
    expect(calls.cancelled).toHaveLength(0);
    expect(scheduler.getPending).not.toHaveBeenCalled();
  });
});

// ─── Cancelación por pérdida de entitlement ──────────────

describe('shouldCancelReminder', () => {
  const now = new Date(2026, 6, 25, 12, 0, 0);
  const recentPurchase = new Date(now.getTime() - FREE_TIER_GRACE_MS / 2);
  const stalePurchase = new Date(now.getTime() - FREE_TIER_GRACE_MS - HOUR_MS);

  it('tier pro conserva el recordatorio (trial activo: el caso normal)', () => {
    expect(
      shouldCancelReminder({ tier: 'pro', wasPro: true, pendingPurchasedAt: stalePurchase, now }),
    ).toBe(false);
  });

  it('transición pro→free observada cancela (entitlement perdido)', () => {
    expect(
      shouldCancelReminder({ tier: 'free', wasPro: true, pendingPurchasedAt: recentPurchase, now }),
    ).toBe(true);
  });

  it('free sin transición y compra dentro de la gracia conserva (webhook aún en vuelo)', () => {
    expect(
      shouldCancelReminder({ tier: 'free', wasPro: false, pendingPurchasedAt: recentPurchase, now }),
    ).toBe(false);
  });

  it('free sin transición y compra fuera de la gracia cancela (recordatorio huérfano)', () => {
    expect(
      shouldCancelReminder({ tier: 'free', wasPro: false, pendingPurchasedAt: stalePurchase, now }),
    ).toBe(true);
  });

  it('fecha de compra ilegible conserva: ante la duda, nunca romper la promesa del día 5', () => {
    expect(
      shouldCancelReminder({ tier: 'free', wasPro: false, pendingPurchasedAt: null, now }),
    ).toBe(false);
  });
});

// ─── Constantes del contrato ─────────────────────────────

it('el evento del tap lleva day 5 (contrato con lib/analytics)', () => {
  expect(TRIAL_REMINDER_DAY).toBe(5);
});
