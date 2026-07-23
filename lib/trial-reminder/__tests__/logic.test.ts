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
  decideReminderActionForPurchase,
  ensureReminderScheduled,
  shouldCancelReminder,
  type PendingReminder,
  type ReminderScheduler,
  type ScheduleReminderRequest,
} from '../logic';
import { trialTimelineFromDays } from '../../trial-timeline';

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

// ─── Qué hace cada compra con el recordatorio ────────────

describe('decideReminderActionForPurchase', () => {
  const base = {
    packageType: 'ANNUAL',
    entitlementPeriodType: 'TRIAL' as string | null,
    outcomeStatus: 'success',
  };

  it.each(['success', 'pending_backend'])(
    'anual con entitlement en TRIAL y outcome %s programa',
    (outcomeStatus) => {
      expect(decideReminderActionForPurchase({ ...base, outcomeStatus })).toBe('schedule');
    },
  );

  // Escenario del review: el PRODUCTO anual ofrece trial (introPrice 0) pero
  // este usuario ya consumió el suyo — Apple le cobra YA y el entitlement
  // llega como NORMAL. Programarle "tu prueba acaba en 2 días" sería mentira:
  // NO se programa, y además se limpia cualquier pendiente obsoleto.
  it('anual con trial ya consumido (entitlement NORMAL) NO programa: cancela pendiente', () => {
    expect(
      decideReminderActionForPurchase({ ...base, entitlementPeriodType: 'NORMAL' }),
    ).toBe('cancel_stale');
  });

  it.each([
    ['mensual sin trial', { ...base, packageType: 'MONTHLY', entitlementPeriodType: 'NORMAL' }],
    ['anual con periodType INTRO (intro de pago, no trial)', { ...base, entitlementPeriodType: 'INTRO' }],
    ['anual sin periodType expuesto por el SDK', { ...base, entitlementPeriodType: null }],
    // Cambio de plan durante el trial: compra efectiva nueva ⇒ el aviso del
    // trial anterior queda obsoleto y debe cancelarse (MINOR-1 del review).
    ['mensual comprada durante un trial anual', { ...base, packageType: 'MONTHLY', entitlementPeriodType: 'NORMAL', outcomeStatus: 'pending_backend' }],
  ])('compra efectiva sin trial real (%s) cancela el pendiente', (_label, input) => {
    expect(decideReminderActionForPurchase(input)).toBe('cancel_stale');
  });

  it.each([
    ['cancelada', { ...base, outcomeStatus: 'cancelled' }],
    ['sin entitlement', { ...base, outcomeStatus: 'no_entitlement' }],
    ['error', { ...base, outcomeStatus: 'error' }],
  ])('compra no efectiva (%s) no toca nada', (_label, input) => {
    expect(decideReminderActionForPurchase(input)).toBe('none');
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

// ─── Property-test: margen entre el aviso y el primer cobro ──
//
// La promesa del aviso incluye "cancela hasta 24h antes sin pagar": el
// recordatorio DEBE llegar siempre con más de 24h de margen hasta el cobro.
// Analíticamente: margen = 2d + horaLocalDeCompra − 10h ∈ [38h01m, 61h59m]
// para compras a 00:01–23:59… ±1h si un cambio de hora DST cae entre el
// disparo y no afecta al cobro (que es compra + 7d en ms absolutos).
// Verificado empíricamente en Europe/Madrid (DST 2026: 29-mar / 25-oct):
//   min = 37.02h (compra 20-oct 00:01 CEST → aviso 25-oct 10:00 CET, otoño −1h)
//   max = 61.98h (compra 23:59 sin cruce DST)
// Nota: el bound manual del review ([38h, 62h]) no contemplaba el cruce de
// otoño; el bound real es [37h, 62h]. En TZs sin DST el margen queda en
// [38h, 62h] ⊂ [37h, 62h], así que la aserción vale en cualquier runner.
describe('margen aviso → primer cobro', () => {
  const MARGIN_MIN_H = 37;
  const MARGIN_MAX_H = 62;

  function marginHours(purchasedAt: Date): number {
    return (
      (computeFirstChargeDate(purchasedAt).getTime() -
        computeReminderTriggerDate(purchasedAt).getTime()) /
      HOUR_MS
    );
  }

  const probes: Date[] = [];
  // Barrido horario en un día sin cambios de hora cercanos.
  for (let h = 0; h < 24; h++) probes.push(new Date(2026, 6, 22, h, 0, 0));
  // Bordes 23:59 / 00:01 alrededor de los dos cambios DST europeos de 2026
  // (primavera 29-mar, otoño 25-oct): compras cuyo día 5 cruza el cambio.
  for (let day = 20; day <= 31; day++) {
    for (const [hh, mm] of [[23, 59], [0, 1]] as const) {
      probes.push(new Date(2026, 2, day, hh, mm, 0)); // marzo
      probes.push(new Date(2026, 9, day, hh, mm, 0)); // octubre
    }
  }

  it.each(probes.map((p) => [p.toISOString(), p] as const))(
    'compra %s: margen dentro de [37h, 62h] y SIEMPRE > 24h',
    (_iso, purchasedAt) => {
      const margin = marginHours(purchasedAt);
      expect(margin).toBeGreaterThanOrEqual(MARGIN_MIN_H);
      expect(margin).toBeLessThanOrEqual(MARGIN_MAX_H);
      // Invariante de la promesa: la ventana de cancelación de 24h sigue
      // abierta (con holgura) cuando suena el aviso.
      expect(margin).toBeGreaterThan(24);
    },
  );
});

// ─── Coupling scheduler ↔ display (MINOR ronda 2) ────────
//
// El display del timeline (paywall) DERIVA los días del introPrice del producto
// (`trialTimelineFromDays`). El scheduler del recordatorio debe derivar de la
// MISMA duración, no de una constante 7 hardcodeada: si App Store Connect
// cambiara la duración del trial, aviso y display se mueven juntos en vez de
// que el display diga una cosa y la notificación local dispare a otra. Este
// test ACOPLA explícitamente ambos a la misma `trialDays`.
describe('coupling scheduler ↔ display: aviso y cobro derivan de la misma duración', () => {
  // Compra a las 10:00 EXACTAS: la normalización horaria del trigger no desplaza
  // el offset, así el offset en días es un múltiplo entero verificable (y sin
  // cruces DST en la ventana jul→ago para los valores probados).
  const purchasedAt = new Date(2026, 6, 22, REMINDER_HOUR_LOCAL, 0, 0, 0);

  const offsetDays = (a: Date, b: Date) => (a.getTime() - b.getTime()) / DAY_MS;

  it.each([3, 7, 14, 30])(
    'trialDays=%i: trigger del recordatorio y primer cobro concuerdan con trialTimelineFromDays',
    (trialDays) => {
      const display = trialTimelineFromDays(trialDays);

      const reminderOffset = offsetDays(computeReminderTriggerDate(purchasedAt, trialDays), purchasedAt);
      const chargeOffset = offsetDays(computeFirstChargeDate(purchasedAt, trialDays), purchasedAt);

      // El recordatorio del scheduler cae en el MISMO día de trial que el display.
      expect(reminderOffset).toBe(display.reminderDay);
      // El primer cobro del scheduler = duración del trial (= chargeDay - 1 del display).
      expect(chargeOffset).toBe(trialDays);
      expect(display.chargeDay).toBe(trialDays + 1);
      // Invariante de la promesa: el aviso siempre precede al cobro.
      expect(reminderOffset).toBeLessThan(chargeOffset);
    },
  );

  it('default sin trialDays = decisión de negocio de 7 días (recordatorio día 5, cobro +7 → "día 8")', () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(offsetDays(computeReminderTriggerDate(purchasedAt), purchasedAt)).toBe(5);
    expect(offsetDays(computeFirstChargeDate(purchasedAt), purchasedAt)).toBe(7);
    expect(trialTimelineFromDays(TRIAL_DAYS)).toMatchObject({ reminderDay: 5, chargeDay: 8 });
  });
});

// ─── Constantes del contrato ─────────────────────────────

it('el evento del tap lleva day 5 (contrato con lib/analytics)', () => {
  expect(TRIAL_REMINDER_DAY).toBe(5);
});
