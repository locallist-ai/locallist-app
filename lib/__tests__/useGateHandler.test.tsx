/**
 * Tests de `lib/useGateHandler.ts` — presentación de cada GateAction como UI.
 *
 * Verifica que cada rama dispara el Alert correcto (título/cuerpo por código) y
 * que los CTAs navegan al destino esperado (login para signup, Account tab para
 * upsell/clamped). `t` se mockea como identidad, así que asertamos sobre keys.
 */

import { Alert } from 'react-native';
import { router } from 'expo-router';
import { renderHook } from '@testing-library/react-native';
import { useGateHandler } from '../useGateHandler';
import type { GateAction } from '../gate-errors';

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockAlert = Alert.alert as jest.Mock;
const mockPush = router.push as jest.Mock;

type AlertButton = { text: string; style?: string; onPress?: () => void };

function lastAlert() {
  const call = mockAlert.mock.calls[mockAlert.mock.calls.length - 1];
  return { title: call[0] as string, body: call[1] as string, buttons: (call[2] ?? []) as AlertButton[] };
}

function pressCta(text: string) {
  const btn = lastAlert().buttons.find((b) => b.text === text);
  btn?.onPress?.();
}

describe('useGateHandler.presentGate', () => {
  afterEach(() => jest.clearAllMocks());

  it('signup_required → Alert de registro + CTA que navega a /login', () => {
    const { result } = renderHook(() => useGateHandler());
    const msg = result.current.presentGate({ type: 'signup_required' });

    expect(msg).toBe('gate.signupRequiredBody');
    expect(lastAlert().title).toBe('gate.signupRequiredTitle');
    pressCta('gate.signupCta');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('upsell plan_limit_reached (con reset) → Alert con cuerpo de reset + CTA a Account', () => {
    const { result } = renderHook(() => useGateHandler());
    const action: GateAction = {
      type: 'upsell',
      code: 'plan_limit_reached',
      used: 3,
      limit: 3,
      resetsAt: '2026-08-01T00:00:00Z',
      requestedDays: null,
      maxDays: null,
      plusMaxDays: null,
    };
    const msg = result.current.presentGate(action);

    expect(msg).toBe('gate.planLimitBodyReset');
    expect(lastAlert().title).toBe('gate.planLimitTitle');
    pressCta('gate.upgradeCta');
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/account');
  });

  it('upsell plan_limit_reached (sin reset) → cuerpo sin fecha', () => {
    const { result } = renderHook(() => useGateHandler());
    const msg = result.current.presentGate({
      type: 'upsell', code: 'plan_limit_reached',
      used: null, limit: null, resetsAt: null, requestedDays: null, maxDays: null, plusMaxDays: null,
    });
    expect(msg).toBe('gate.planLimitBody');
  });

  it('upsell duration_requires_plus → título de duración', () => {
    const { result } = renderHook(() => useGateHandler());
    result.current.presentGate({
      type: 'upsell', code: 'duration_requires_plus',
      used: null, limit: null, resetsAt: null, requestedDays: 7, maxDays: 3, plusMaxDays: 14,
    });
    expect(lastAlert().title).toBe('gate.durationTitle');
  });

  it('upsell saved_plans_limit_reached → título de planes guardados', () => {
    const { result } = renderHook(() => useGateHandler());
    result.current.presentGate({
      type: 'upsell', code: 'saved_plans_limit_reached',
      used: 5, limit: 5, resetsAt: null, requestedDays: null, maxDays: null, plusMaxDays: null,
    });
    expect(lastAlert().title).toBe('gate.savedPlansTitle');
  });

  it('soft_throttle → Alert de daily cap SIN CTA de upgrade', () => {
    const { result } = renderHook(() => useGateHandler());
    const msg = result.current.presentGate({ type: 'soft_throttle' });

    expect(msg).toBe('gate.dailyCapBody');
    expect(lastAlert().title).toBe('gate.dailyCapTitle');
    // No debe ofrecer upgrade: no hay botón que navegue a Plus.
    const hasUpgrade = lastAlert().buttons.some((b) => b.text === 'gate.upgradeCta');
    expect(hasUpgrade).toBe(false);
  });

  it('rate_limit y generic no presentan Alert y devuelven null', () => {
    const { result } = renderHook(() => useGateHandler());
    expect(result.current.presentGate({ type: 'rate_limit' })).toBeNull();
    expect(result.current.presentGate({ type: 'generic' })).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});

describe('useGateHandler.presentClamped', () => {
  afterEach(() => jest.clearAllMocks());

  it('con días → cuerpo con {{days}} y CTA a Plus', () => {
    const { result } = renderHook(() => useGateHandler());
    result.current.presentClamped(3);
    expect(lastAlert().title).toBe('gate.clampedTitle');
    expect(lastAlert().body).toBe('gate.clampedBody');
    pressCta('gate.upgradeCta');
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/account');
  });

  it('sin días → cuerpo genérico', () => {
    const { result } = renderHook(() => useGateHandler());
    result.current.presentClamped(null);
    expect(lastAlert().body).toBe('gate.clampedBodyGeneric');
  });
});
