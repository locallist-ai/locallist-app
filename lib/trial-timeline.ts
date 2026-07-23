/**
 * Derivación PURA de la duración del trial y los días del timeline del paywall
 * a partir del `introPrice` de StoreKit. Nada hardcodeado a 7: si App Store
 * Connect configura otra duración, la copy la refleja. La decisión de negocio
 * es un trial de 7 días, pero se DERIVA del producto, no se asume — una copy
 * que promete "7 días" sobre un trial de otra duración sería engañosa.
 */

/** Periodo del intro price (subconjunto de `PurchasesIntroPrice`). */
export interface IntroPricePeriod {
  periodNumberOfUnits: number;
  /** DAY | WEEK | MONTH | YEAR (según StoreKit). */
  periodUnit: string;
}

/** Días del timeline derivados de la duración del trial. */
export interface TrialTimelineDays {
  /** Duración del trial en días (N). */
  trialDays: number;
  /** Día del recordatorio de fin de trial (N-2, mínimo 1). */
  reminderDay: number;
  /** Día del primer cobro (N+1). */
  chargeDay: number;
}

/**
 * Duración en días del periodo de un intro price. Devuelve `null` si el periodo
 * no es interpretable (unidad desconocida o número no positivo): en ese caso el
 * paywall NO promete un trial con días concretos (default seguro).
 *
 * MONTH/YEAR se aproximan (30/365 días) — no aplican al trial de 7 días real,
 * pero mantienen la derivación total en vez de asumir.
 */
export function introPriceDurationDays(
  introPrice: IntroPricePeriod | null | undefined,
): number | null {
  if (!introPrice) return null;
  const units = Math.round(introPrice.periodNumberOfUnits);
  if (!Number.isFinite(units) || units <= 0) return null;
  switch (introPrice.periodUnit) {
    case 'DAY':
      return units;
    case 'WEEK':
      return units * 7;
    case 'MONTH':
      return units * 30;
    case 'YEAR':
      return units * 365;
    default:
      return null;
  }
}

/**
 * Timeline (recordatorio N-2, primer cobro N+1) a partir de la duración del
 * trial en días. Para el trial de 7 días real: recordatorio día 5, cobro día 8.
 */
export function trialTimelineFromDays(trialDays: number): TrialTimelineDays {
  return {
    trialDays,
    reminderDay: Math.max(1, trialDays - 2),
    chargeDay: trialDays + 1,
  };
}

/**
 * Timeline derivado directamente del intro price, o `null` si la duración no es
 * interpretable. Atajo de `introPriceDurationDays` + `trialTimelineFromDays`.
 */
export function trialTimelineFromIntroPrice(
  introPrice: IntroPricePeriod | null | undefined,
): TrialTimelineDays | null {
  const trialDays = introPriceDurationDays(introPrice);
  return trialDays === null ? null : trialTimelineFromDays(trialDays);
}
