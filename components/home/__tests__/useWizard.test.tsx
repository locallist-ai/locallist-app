/**
 * Tests de `components/home/useWizard.ts` — gate Plus + cap de duración por tier.
 *
 * Cubre:
 *  - G1: gate por PRESENCIA DE TOKEN, no por `user` en memoria. Token presente +
 *    user null (auto-login falló) → NO signup, deja pasar la request. Sin token
 *    (guest real) → signup, sin endpoint.
 *  - g2: los gates (signup/upsell/soft_throttle) NO caen en el overlay de error
 *    (no setean `error`) — solo Alert.
 *  - Cap de duración: free clampa a 3 días (>3 se omite del payload); Plus
 *    permite hasta 14.
 *  - Errores estructurados en /builder/chat: 403 (plan_limit / duration) →
 *    presentGate upsell; 429 daily_cap → soft_throttle; 429 genérico → rate
 *    limit inline; 401 → signup.
 *  - Hint clamped en la respuesta OK → presentClamped.
 *  - g3: generación exitosa refresca la cuota (refreshAiPlansQuota).
 */

import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { api, getAccessToken } from '../../../lib/api';
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
jest.mock('../../../lib/api', () => ({ api: jest.fn(), getAccessToken: jest.fn() }));
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
const mockGetAccessToken = getAccessToken as jest.Mock;
const mockUseTripContext = useTripContext as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockRefreshAiPlansQuota = jest.fn();

const okResponse = (over: Record<string, unknown> = {}) => ({
  data: { plan: { id: 'p1', city: 'Miami', durationDays: 2 }, stops: [], message: '', ...over },
  error: null,
  errorBody: null,
  status: 200,
});

const setAuth = (over: Record<string, unknown> = {}) =>
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    isPro: false,
    aiPlansMonth: null,
    refreshAiPlansQuota: mockRefreshAiPlansQuota,
    ...over,
  });

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
  // Por defecto hay token en SecureStore (usuario autenticado). Los tests de
  // guest lo ponen a null.
  mockGetAccessToken.mockResolvedValue('valid-token');
  setAuth();
});

describe('useWizard — gate de autenticación (G1: por presencia de token)', () => {
  it('guest real (sin token): generar dispara presentGate(signup_required) y NO llama al endpoint', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    setAuth({ isAuthenticated: false });
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).toHaveBeenCalledWith({ type: 'signup_required' });
    expect(mockApi).not.toHaveBeenCalled();
    // g2: el gate NO cae en el overlay de error — `error` queda null (solo Alert).
    expect(result.current.error).toBeNull();
  });

  it('G1: token presente pero user null (auto-login falló) → NO signup, deja pasar la request', async () => {
    // El blip transitorio de /account dejó user=null, pero el token vive en
    // SecureStore. Un returning user NO debe ver el muro de registro.
    mockGetAccessToken.mockResolvedValue('valid-token');
    setAuth({ isAuthenticated: false });
    mockApi.mockResolvedValue(okResponse());
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockPresentGate).not.toHaveBeenCalledWith({ type: 'signup_required' });
    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/plan/preview');
  });

  it('G1: token caducado → el 401 de la respuesta maneja el signup (fallback)', async () => {
    mockGetAccessToken.mockResolvedValue('expired-token');
    setAuth({ isAuthenticated: false });
    mockApi.mockResolvedValue({ data: null, error: 'unauthorized', errorBody: { error: 'unauthorized' }, status: 401 });
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    // La request SÍ se intenta (el gate pre-request no corta), y el 401 dispara signup.
    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(mockPresentGate).toHaveBeenCalledWith({ type: 'signup_required' });
    // g2: tampoco aquí cae en el overlay de error.
    expect(result.current.error).toBeNull();
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
    // g2: el upsell NO cae en el overlay de error con Retry — solo Alert.
    expect(result.current.error).toBeNull();
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
    // g2: soft-throttle es un gate, no un error — sin overlay de Retry.
    expect(result.current.error).toBeNull();
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
  it('respuesta OK con clamped {applied,requested} → presentClamped y navega a preview', async () => {
    mockApi.mockResolvedValue(
      okResponse({ clamped: { field: 'days', requested: 7, applied: 3, upsell: true }, durationDays: 3 }),
    );
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

describe('useWizard — g3: refresco de cuota tras generar', () => {
  it('generación exitosa refresca aiPlansMonth (refreshAiPlansQuota)', async () => {
    mockApi.mockResolvedValue(okResponse());
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockRefreshAiPlansQuota).toHaveBeenCalledTimes(1);
  });

  it('generación fallida (gate) NO refresca la cuota', async () => {
    mockApi.mockResolvedValue({
      data: null, error: 'plan_limit_reached',
      errorBody: { error: 'plan_limit_reached' }, status: 403,
    });
    const { result } = renderHook(() => useWizard());

    await generateWith(result, 2);

    expect(mockRefreshAiPlansQuota).not.toHaveBeenCalled();
  });
});
