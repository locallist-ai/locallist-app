/**
 * Derivación de la duración del trial y los días del timeline. Blinda la copy:
 * si el producto trae una duración distinta de 7 días, los días DERIVADOS
 * cambian — nada asume "7/día 5/día 8".
 */
import {
  introPriceDurationDays,
  trialTimelineFromDays,
  trialTimelineFromIntroPrice,
} from '../trial-timeline';

describe('introPriceDurationDays', () => {
  it('DAY: devuelve el número de unidades tal cual (trial de 7 días real)', () => {
    expect(introPriceDurationDays({ periodNumberOfUnits: 7, periodUnit: 'DAY' })).toBe(7);
  });

  it('WEEK: multiplica por 7', () => {
    expect(introPriceDurationDays({ periodNumberOfUnits: 2, periodUnit: 'WEEK' })).toBe(14);
  });

  it('MONTH/YEAR: aproxima (30/365 días)', () => {
    expect(introPriceDurationDays({ periodNumberOfUnits: 1, periodUnit: 'MONTH' })).toBe(30);
    expect(introPriceDurationDays({ periodNumberOfUnits: 1, periodUnit: 'YEAR' })).toBe(365);
  });

  it('null/undefined introPrice: null (sin trial que prometer)', () => {
    expect(introPriceDurationDays(null)).toBeNull();
    expect(introPriceDurationDays(undefined)).toBeNull();
  });

  it('unidad desconocida o número no positivo: null (no interpretable)', () => {
    expect(introPriceDurationDays({ periodNumberOfUnits: 7, periodUnit: 'FORTNIGHT' })).toBeNull();
    expect(introPriceDurationDays({ periodNumberOfUnits: 0, periodUnit: 'DAY' })).toBeNull();
    expect(introPriceDurationDays({ periodNumberOfUnits: -3, periodUnit: 'DAY' })).toBeNull();
  });
});

describe('trialTimelineFromDays', () => {
  it('trial de 7 días → recordatorio día 5, cobro día 8 (el caso de negocio real)', () => {
    expect(trialTimelineFromDays(7)).toEqual({ trialDays: 7, reminderDay: 5, chargeDay: 8 });
  });

  it('otra duración (14 días) → días DERIVADOS distintos (recordatorio 12, cobro 15)', () => {
    // Este es el test que exige el review: si ASC configura 14 días, la copy NO
    // puede seguir diciendo "día 5/día 8" — se deriva.
    expect(trialTimelineFromDays(14)).toEqual({ trialDays: 14, reminderDay: 12, chargeDay: 15 });
  });

  it('trials muy cortos: el recordatorio nunca cae antes del día 1', () => {
    expect(trialTimelineFromDays(3)).toEqual({ trialDays: 3, reminderDay: 1, chargeDay: 4 });
    expect(trialTimelineFromDays(1)).toEqual({ trialDays: 1, reminderDay: 1, chargeDay: 2 });
  });
});

describe('trialTimelineFromIntroPrice', () => {
  it('deriva el timeline completo del introPrice (7 días → 5/8)', () => {
    expect(trialTimelineFromIntroPrice({ periodNumberOfUnits: 7, periodUnit: 'DAY' })).toEqual({
      trialDays: 7,
      reminderDay: 5,
      chargeDay: 8,
    });
  });

  it('introPrice no interpretable: null', () => {
    expect(trialTimelineFromIntroPrice(null)).toBeNull();
    expect(trialTimelineFromIntroPrice({ periodNumberOfUnits: 1, periodUnit: '?' })).toBeNull();
  });
});
