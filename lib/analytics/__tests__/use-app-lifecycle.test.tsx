/**
 * Tests de `lib/analytics/use-app-lifecycle.ts` — corrección de métricas.
 *
 *  - `app_opened`: exactamente 1 en cold start; un peek de Control Center
 *    (`active→inactive→active`, sin pasar por `background`) NO cuenta; un retorno
 *    real (`active→background→active`) cuenta exactamente 1.
 *  - `screen_view`: un evento por pathname DISTINTO aunque normalicen al mismo
 *    patrón (`/place/A → B → C` ⇒ 3 eventos `/place/[id]`), sin dedupe de nombre.
 */
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { track } from '../../analytics';
import { useAppOpenTracking, useScreenTracking } from '../use-app-lifecycle';

jest.mock('../../analytics', () => ({ track: jest.fn() }));
jest.mock('../app-open', () => ({ getDaysSinceInstall: jest.fn(async () => 3) }));

let mockCurrentPath = '/home';
jest.mock('expo-router', () => ({ usePathname: () => mockCurrentPath }));

const mockTrack = track as jest.Mock;

let appStateHandler: (state: string) => void = () => {};
const removeSub = jest.fn();

const countOf = (event: string) =>
  mockTrack.mock.calls.filter(([p]) => p.event === event).length;
const eventsOf = (event: string) =>
  mockTrack.mock.calls.map(([p]) => p).filter((p) => p.event === event);

// Flush the microtask chain (getDaysSinceInstall resolves then track fires).
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  appStateHandler = () => {};
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(((_type: string, cb: (s: string) => void) => {
      appStateHandler = cb;
      return { remove: removeSub } as ReturnType<typeof AppState.addEventListener>;
    }) as typeof AppState.addEventListener);
});

describe('useAppOpenTracking', () => {
  it('cold start → exactamente un app_opened', async () => {
    renderHook(() => useAppOpenTracking());
    await flush();
    expect(countOf('app_opened')).toBe(1);
    expect(eventsOf('app_opened')[0]).toEqual({ event: 'app_opened', days_since_install: 3 });
  });

  it('peek de Control Center (active→inactive→active) → NO cuenta como apertura', async () => {
    renderHook(() => useAppOpenTracking());
    await flush(); // cold start = 1

    act(() => {
      appStateHandler('inactive');
      appStateHandler('active');
    });
    await flush();

    expect(countOf('app_opened')).toBe(1); // sigue en 1, el peek no dispara
  });

  it('retorno real (active→background→active) → exactamente un app_opened más', async () => {
    renderHook(() => useAppOpenTracking());
    await flush(); // cold start = 1

    act(() => {
      appStateHandler('background');
      appStateHandler('active');
    });
    await flush();

    expect(countOf('app_opened')).toBe(2);
  });

  it('dos peeks alrededor de un background: solo el background→active suma', async () => {
    renderHook(() => useAppOpenTracking());
    await flush(); // 1

    act(() => {
      appStateHandler('inactive'); // peek
      appStateHandler('active');
      appStateHandler('background'); // real leave
      appStateHandler('active'); // real return → +1
      appStateHandler('inactive'); // peek
      appStateHandler('active');
    });
    await flush();

    expect(countOf('app_opened')).toBe(2);
  });
});

describe('useScreenTracking', () => {
  it('pathnames distintos con el mismo patrón → un screen_view por cada uno', () => {
    mockCurrentPath = '/place/A';
    const { rerender } = renderHook(() => useScreenTracking());

    mockCurrentPath = '/place/B';
    rerender({});
    mockCurrentPath = '/place/C';
    rerender({});

    const views = eventsOf('screen_view');
    expect(views).toHaveLength(3);
    expect(views).toEqual([
      { event: 'screen_view', screen: '/place/[id]' },
      { event: 'screen_view', screen: '/place/[id]' },
      { event: 'screen_view', screen: '/place/[id]' },
    ]);
  });

  it('el mismo pathname repetido no re-dispara (usePathname + dep [pathname])', () => {
    mockCurrentPath = '/home';
    const { rerender } = renderHook(() => useScreenTracking());
    rerender({});
    rerender({});
    expect(countOf('screen_view')).toBe(1);
  });
});
