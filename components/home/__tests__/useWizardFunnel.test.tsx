/**
 * Tests de `components/home/useWizardFunnel.ts` — funnel del wizard.
 *
 * Cubre:
 *  - `wizard_step_viewed` en el mount y en cada cambio de step (denominador).
 *  - `wizard_abandoned` al desmontar CON el último step visible, cuando el
 *    usuario sale sin generar.
 *  - Suprimido: si `markGenerated()` se llamó (generate exitoso), el unmount NO
 *    emite `wizard_abandoned`.
 */
import { act, renderHook } from '@testing-library/react-native';
import { track } from '../../../lib/analytics';
import { useWizardFunnel } from '../useWizardFunnel';

jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));

const mockTrack = track as jest.Mock;

const eventsOf = (name: string) =>
  mockTrack.mock.calls.map(([p]) => p).filter((p) => p.event === name);

beforeEach(() => jest.clearAllMocks());

describe('wizard_step_viewed', () => {
  it('emite en el mount con el step inicial', () => {
    renderHook(({ step }: { step: number }) => useWizardFunnel(step), { initialProps: { step: 1 } });
    expect(eventsOf('wizard_step_viewed')).toEqual([{ event: 'wizard_step_viewed', step: 1 }]);
  });

  it('emite en cada cambio de step', () => {
    const { rerender } = renderHook(({ step }: { step: number }) => useWizardFunnel(step), {
      initialProps: { step: 1 },
    });
    rerender({ step: 2 });
    rerender({ step: 4 });
    expect(eventsOf('wizard_step_viewed')).toEqual([
      { event: 'wizard_step_viewed', step: 1 },
      { event: 'wizard_step_viewed', step: 2 },
      { event: 'wizard_step_viewed', step: 4 },
    ]);
  });
});

describe('wizard_abandoned (suppression)', () => {
  it('salir a mitad de flujo → emite abandon con el último step visible', () => {
    const { rerender, unmount } = renderHook(({ step }: { step: number }) => useWizardFunnel(step), {
      initialProps: { step: 1 },
    });
    rerender({ step: 2 });
    unmount();
    expect(eventsOf('wizard_abandoned')).toEqual([{ event: 'wizard_abandoned', step: 2 }]);
  });

  it('generate exitoso (markGenerated) → el unmount NO emite abandon', () => {
    const { result, rerender, unmount } = renderHook(({ step }: { step: number }) => useWizardFunnel(step), {
      initialProps: { step: 1 },
    });
    rerender({ step: 4 });
    act(() => result.current.markGenerated());
    unmount();
    expect(eventsOf('wizard_abandoned')).toHaveLength(0);
  });
});
