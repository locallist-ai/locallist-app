/**
 * Tests de `components/home/useWizard.ts` — gate Plus + cap de duración por tier.
 *
 * Cubre:
 *  - Guest: tocar generar dispara el CTA de registro y NO llama al endpoint.
 *  - Cap de duración: free clampa a 3 días (>3 se omite del payload); Plus
 *    permite hasta 14.
 *  - Errores estructurados en /builder/chat: 403 (plan_limit / duration) →
 *    presentGate upsell; 429 daily_cap → soft_throttle; 429 genérico → rate
 *    limit inline; 401 → signup.
 *  - Hint clamped en la respuesta OK → presentClamped.
 */

import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { api } from '../../../lib/api';
import { setPreviewPlan } from '../../../lib/plan/plan-store';
import { useTripContext } from '../../../lib/trip-context-store';
import { useAuth } from '../../../lib/auth';
import { useWizard } from '../useWizard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('../../../lib/api', () => ({ api: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../lib/plan/plan-store', () => ({ setPreviewPlan: jest.fn() }));
jest.mock('../../../lib/trip-context-store', () => ({ useTripContext: jest.fn() }));
jest.mock('../../../lib/auth', () => ({ useAuth: jest.fn() }));

const mockPresentGate = jest.fn((): string | null => 'gate-msg');
const mockPresentClamped = jest.fn();
jest.mock('../../../lib/useGateHandler', () => ({
  useGateHandler: () => ({ presentGate: mockPresentGate, presentClamped: mockPresentClamped }),
}));

const mockApi = api as jest.Mock;
const mockUseTripContext = useTripContext as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const okResponse = (over: Record<string, unknown> = {}) => ({
  data: { plan: { id: 'p1', city: 'Miami', durationDays: 2 }, stops: [], message: '', ...over },
  error: null,
  errorBody: null,
  status: 200,
});

const setAuth = (over: Record<string, unknown> = {}) =>
  mockUseAuth.mockReturnValue({ isAuthenticated: true, isPro: false, aiPlansMonth: null, ...over });

/** Rellena señales mínimas (city+days+interest) y dispara generate. */
const generateWith = async (result: ReturnType<typeof renderHook<ReturnType<typeof useWizard>, unknown>>['result'], days: number) => {
  act(() => { result.current.toggleInterest('food'); });
  act(() => { result.current.handleSelectDays(days); });
  await act(async () => { await result.current.handleGenerate(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPresentGate.mockReturnValue('gate-msg');
  mockUseTripContext.mockReturnValue({ city: 'Miami', loading: false });
  setAuth();
});

describe('useWizard — gate de autenticación', () => {
  it('guest: generar dispara presentGate(signup_required) y NO llama al endpoint', async () => {
    setAuth({ isAuthenticated: false });
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).toHaveBeenCalledWith({ type: 'signup_required' });
    expect(mockApi).not.toHaveBeenCalled();
    expect(result.current.error).toBe('gate-msg');
  });
});

describe('useWizard — cap de duración por tier', () => {
  it('free: días > 3 se omiten del payload (clamp a 3)', async () => {
    setAuth({ isPro: false });
    mockApi.mockResolvedValue(okResponse());
    const { result } = renderHook(() => useWizard());

    // El picker no debería permitirlo, pero defensa en profundidad: 7 días en
    // free no debe viajar al backend.
    await generateWith(result, 7);

    expect(mockApi).toHaveBeenCalledTimes(1);
    const body = (mockApi.mock.calls[0][1] as { body: { tripContext: { days?: number } } }).body;
    expect(body.tripContext.days).toBeUndefined();
  });

  it('plus: 14 días viajan en el payload', async () => {
    setAuth({ isPro: true });
    mockApi.mockResolvedValue(okResponse({ durationDays: 14 }));
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 14);

    const body = (mockApi.mock.calls[0][1] as { body: { tripContext: { days?: number } } }).body;
    expect(body.tripContext.days).toBe(14);
  });
});

describe('useWizard — errores estructurados del gate', () => {
  const errorResponse = (status: number, code: string) => ({
    data: null, error: code, errorBody: { error: code }, status,
  });

  it('403 plan_limit_reached → presentGate upsell', async () => {
    mockApi.mockResolvedValue({
      data: null, error: 'plan_limit_reached',
      errorBody: { error: 'plan_limit_reached', used: 3, limit: 3, resetsAt: '2026-08-01' },
      status: 403,
    });
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'upsell', code: 'plan_limit_reached' }),
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('403 duration_requires_plus → presentGate upsell', async () => {
    mockApi.mockResolvedValue({
      data: null, error: 'duration_requires_plus',
      errorBody: { error: 'duration_requires_plus', maxDays: 3, plusMaxDays: 14 }, status: 403,
    });
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'upsell', code: 'duration_requires_plus' }),
    );
  });

  it('429 daily_cap_reached → presentGate soft_throttle', async () => {
    mockApi.mockResolvedValue(errorResponse(429, 'daily_cap_reached'));
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).toHaveBeenCalledWith({ type: 'soft_throttle' });
  });

  it('429 genérico → error inline de rate limit, sin presentGate', async () => {
    mockApi.mockResolvedValue(errorResponse(429, 'too_many'));
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).not.toHaveBeenCalled();
    expect(result.current.error).toBe('wizard.errorRateLimit');
  });

  it('401 → presentGate signup_required', async () => {
    mockApi.mockResolvedValue(errorResponse(401, 'unauthorized'));
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).toHaveBeenCalledWith({ type: 'signup_required' });
  });
});

describe('useWizard — clamped hint en éxito', () => {
  it('respuesta OK con clamped → presentClamped y navega a preview', async () => {
    mockApi.mockResolvedValue(okResponse({ clamped: true, appliedDays: 3, durationDays: 3 }));
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(setPreviewPlan).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/plan/preview');
    expect(mockPresentClamped).toHaveBeenCalledWith(3);
  });

  it('respuesta OK sin clamped → no presentClamped', async () => {
    mockApi.mockResolvedValue(okResponse());
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(router.push).toHaveBeenCalledWith('/plan/preview');
    expect(mockPresentClamped).not.toHaveBeenCalled();
  });
});
