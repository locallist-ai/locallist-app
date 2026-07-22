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
  it('lee ai_plans_month (snake_case) a nivel raíz', () => {
    const body = { user: { id: 'u1' }, ai_plans_month: { used: 1, limit: 3, resetsAt: '2026-08-01' } };
    expect(parseAiPlansQuota(body)).toEqual({ used: 1, limit: 3, resetsAt: '2026-08-01' });
  });

  it('lee aiPlansMonth (camelCase) anidado bajo user', () => {
    const body = { user: { aiPlansMonth: { used: 2, limit: 3 } } };
    expect(parseAiPlansQuota(body)).toEqual({ used: 2, limit: 3, resetsAt: null });
  });

  it('null cuando falta o está malformado', () => {
    expect(parseAiPlansQuota(null)).toBeNull();
    expect(parseAiPlansQuota({ user: { id: 'u1' } })).toBeNull();
    expect(parseAiPlansQuota({ ai_plans_month: { used: 'x', limit: 3 } })).toBeNull();
  });
});

describe('parseClampedHint', () => {
  it('boolean clamped:true con días adyacentes', () => {
    expect(parseClampedHint({ clamped: true, appliedDays: 3, requestedDays: 7 })).toEqual({
      appliedDays: 3,
      requestedDays: 7,
    });
  });

  it('objeto clamped con días', () => {
    expect(parseClampedHint({ clamped: { days: 3 } })).toEqual({ appliedDays: 3, requestedDays: null });
  });

  it('null cuando no hay clamp', () => {
    expect(parseClampedHint({ clamped: false })).toBeNull();
    expect(parseClampedHint({})).toBeNull();
    expect(parseClampedHint(null)).toBeNull();
  });
});
