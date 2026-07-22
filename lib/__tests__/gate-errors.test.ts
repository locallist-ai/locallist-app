/**
 * Tests de `lib/gate-errors.ts` — mapeo puro de respuestas del gate Plus a
 * acciones de cliente + parseo tolerante de cuota y hint de clamp.
 *
 * Cubre cada rama del catálogo estructurado:
 *  - 401 → signup_required (prioritario sobre cualquier código).
 *  - 403 plan_limit_reached / duration_requires_plus / multicity_requires_plus
 *    / saved_plans_limit_reached → upsell con campos tolerantes.
 *  - 429 daily_cap_reached → soft_throttle (Plus, sin upsell).
 *  - 429 genérico → rate_limit.
 *  - resto → generic.
 */

import {
  mapGateError,
  parseAiPlansQuota,
  parseClampedHint,
  type GateAction,
} from '../gate-errors';

describe('mapGateError', () => {
  it('401 → signup_required, incluso con un código en el body', () => {
    expect(mapGateError(401, { error: 'unauthorized' })).toEqual({ type: 'signup_required' });
    expect(mapGateError(401, null)).toEqual({ type: 'signup_required' });
  });

  it('403 plan_limit_reached → upsell con used/limit/resetsAt', () => {
    const action = mapGateError(403, {
      error: 'plan_limit_reached',
      used: 3,
      limit: 3,
      resetsAt: '2026-08-01T00:00:00Z',
    });
    expect(action).toEqual({
      type: 'upsell',
      code: 'plan_limit_reached',
      used: 3,
      limit: 3,
      resetsAt: '2026-08-01T00:00:00Z',
      requestedDays: null,
      maxDays: null,
      plusMaxDays: null,
    });
  });

  it('403 duration_requires_plus → upsell con requestedDays/maxDays/plusMaxDays', () => {
    const action = mapGateError(403, {
      error: 'duration_requires_plus',
      requestedDays: 7,
      maxDays: 3,
      plusMaxDays: 14,
    });
    expect(action).toMatchObject({
      type: 'upsell',
      code: 'duration_requires_plus',
      requestedDays: 7,
      maxDays: 3,
      plusMaxDays: 14,
    });
  });

  it('403 multicity_requires_plus → upsell (sin campos numéricos)', () => {
    const action = mapGateError(403, { error: 'multicity_requires_plus' });
    expect(action).toMatchObject({ type: 'upsell', code: 'multicity_requires_plus', used: null });
  });

  it('403 saved_plans_limit_reached → upsell con used/limit', () => {
    const action = mapGateError(403, { error: 'saved_plans_limit_reached', used: 5, limit: 5 });
    expect(action).toMatchObject({ type: 'upsell', code: 'saved_plans_limit_reached', used: 5, limit: 5 });
  });

  it('429 daily_cap_reached → soft_throttle (Plus, sin upsell)', () => {
    expect(mapGateError(429, { error: 'daily_cap_reached' })).toEqual({ type: 'soft_throttle' });
  });

  it('429 sin código de gate → rate_limit', () => {
    expect(mapGateError(429, { error: 'too_many_requests' })).toEqual({ type: 'rate_limit' });
    expect(mapGateError(429, null)).toEqual({ type: 'rate_limit' });
  });

  it('otros estados/códigos → generic', () => {
    expect(mapGateError(500, { error: 'server_error' })).toEqual({ type: 'generic' });
    expect(mapGateError(400, { error: 'insufficient_input' })).toEqual({ type: 'generic' });
    expect(mapGateError(0, null)).toEqual({ type: 'generic' });
  });

  it('normaliza el case/espacios del código antes de comparar (g5)', () => {
    // Un drift de casing/espacios del backend no debe misroutear el gate.
    expect(mapGateError(403, { error: 'PLAN_LIMIT_REACHED' })).toMatchObject({
      type: 'upsell',
      code: 'plan_limit_reached',
    });
    expect(mapGateError(403, { error: '  Duration_Requires_Plus  ' })).toMatchObject({
      type: 'upsell',
      code: 'duration_requires_plus',
    });
    expect(mapGateError(429, { error: 'Daily_Cap_Reached' })).toEqual({ type: 'soft_throttle' });
  });

  it('parseo tolerante: campos no numéricos o body no-objeto degradan a null', () => {
    const action = mapGateError(403, {
      error: 'plan_limit_reached',
      used: 'three', // tipo incorrecto
      limit: null,
      resetsAt: 42, // tipo incorrecto
    }) as Extract<GateAction, { type: 'upsell' }>;
    expect(action.used).toBeNull();
    expect(action.limit).toBeNull();
    expect(action.resetsAt).toBeNull();
  });
});

describe('parseAiPlansQuota', () => {
  // Contrato fijado (feat/iap-backend-tier): /account devuelve
  // `{ user, aiPlansMonth: { used, limit, resetsAt } }` a nivel raíz.
  it('lee aiPlansMonth a nivel raíz (free)', () => {
    const body = { user: { id: 'u1' }, aiPlansMonth: { used: 2, limit: 3, resetsAt: '2026-08-01T00:00:00Z' } };
    expect(parseAiPlansQuota(body)).toEqual({ used: 2, limit: 3, resetsAt: '2026-08-01T00:00:00Z' });
  });

  it('resetsAt ausente → null (used/limit presentes)', () => {
    const body = { user: {}, aiPlansMonth: { used: 1, limit: 3 } };
    expect(parseAiPlansQuota(body)).toEqual({ used: 1, limit: 3, resetsAt: null });
  });

  it('Plus: limit omitido (ilimitado) → null, la UI oculta la línea', () => {
    // El backend omite `limit` para Plus (WhenWritingNull); sin límite concreto
    // no hay "X de N" que pintar.
    expect(parseAiPlansQuota({ user: {}, aiPlansMonth: { used: 0, resetsAt: '2026-08-01' } })).toBeNull();
  });

  it('null cuando falta o está malformado', () => {
    expect(parseAiPlansQuota(null)).toBeNull();
    expect(parseAiPlansQuota({ user: { id: 'u1' } })).toBeNull();
    expect(parseAiPlansQuota({ aiPlansMonth: { used: 'x', limit: 3 } })).toBeNull();
    // Ya no se lee snake_case ni anidado bajo user — contrato bloqueado.
    expect(parseAiPlansQuota({ ai_plans_month: { used: 1, limit: 3 } })).toBeNull();
    expect(parseAiPlansQuota({ user: { aiPlansMonth: { used: 1, limit: 3 } } })).toBeNull();
  });
});

describe('parseClampedHint', () => {
  // Contrato fijado: `clamped: { field, requested, applied, upsell }`, presente
  // solo cuando hubo recorte (omitido si no).
  it('objeto clamped con field/requested/applied/upsell → días', () => {
    expect(
      parseClampedHint({ clamped: { field: 'days', requested: 10, applied: 3, upsell: true } }),
    ).toEqual({ appliedDays: 3, requestedDays: 10 });
  });

  it('applied presente sin requested → requestedDays null', () => {
    expect(parseClampedHint({ clamped: { field: 'days', applied: 3, upsell: true } })).toEqual({
      appliedDays: 3,
      requestedDays: null,
    });
  });

  it('null cuando no hay clamp', () => {
    expect(parseClampedHint({})).toBeNull();
    expect(parseClampedHint(null)).toBeNull();
    // Formas antiguas ya no se aceptan (contrato bloqueado).
    expect(parseClampedHint({ clamped: true, appliedDays: 3 })).toBeNull();
    expect(parseClampedHint({ clamped: false })).toBeNull();
  });
});
