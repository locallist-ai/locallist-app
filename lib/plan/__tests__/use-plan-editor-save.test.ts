/**
 * Tests del save del builder manual (`usePlanEditor`): al crear un plan nuevo,
 * el POST /plans incluye la fecha de inicio como `yyyy-MM-dd` (además de
 * nombre/ciudad/días). Espejo del envío del wizard, pero por el camino del
 * builder manual.
 */

import { renderHook, act } from '@testing-library/react-native';
import { api } from '../../api';
import { usePlanEditor } from '../use-plan-editor';

jest.mock('../../api', () => ({ api: jest.fn() }));

const mockApi = api as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePlanEditor.save — builder manual', () => {
  it('POST /plans incluye startDate (yyyy-MM-dd) junto a name/city/durationDays', async () => {
    mockApi.mockResolvedValue({
      data: { id: 'plan-1', name: 'Trip', city: 'Miami', durationDays: 2, days: [] },
      error: null,
      errorBody: null,
      status: 201,
    });

    // Referencia estable (el efecto de init depende de newPlanConfig; en la app
    // real viene memoizado con useMemo — un objeto nuevo por render loopea).
    const cfg = { name: 'Trip', city: 'Miami', durationDays: 2, startDate: '2026-09-01' };
    const { result } = renderHook(() => usePlanEditor('new', { newPlanConfig: cfg }));

    let saveResult: { success: boolean; planId?: string } = { success: false };
    await act(async () => {
      saveResult = await result.current.save();
    });

    expect(saveResult.success).toBe(true);
    expect(saveResult.planId).toBe('plan-1');

    const postCall = mockApi.mock.calls.find(([path]) => path === '/plans');
    expect(postCall).toBeTruthy();
    const body = (postCall![1] as { method: string; body: Record<string, unknown> }).body;
    expect(body).toMatchObject({
      name: 'Trip',
      city: 'Miami',
      durationDays: 2,
      startDate: '2026-09-01',
    });
    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('el plan nuevo en memoria expone startDate para el display inmediato', async () => {
    mockApi.mockResolvedValue({ data: { id: 'x', days: [] }, error: null, errorBody: null, status: 201 });

    const cfg = { name: 'Trip', city: 'Miami', durationDays: 3, startDate: '2026-09-01' };
    const { result } = renderHook(() => usePlanEditor('new', { newPlanConfig: cfg }));

    expect(result.current.plan?.startDate).toBe('2026-09-01');
  });
});
