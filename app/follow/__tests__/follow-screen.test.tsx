/**
 * Follow Mode screen wiring — cobertura de comportamiento del offline robusto:
 *  - online: persiste el plan a disco (savePlan) + prefetch de fotos del día.
 *  - offline cold-start: sin datos de red cae al plan cacheado (loadPlan),
 *    lo pinta y marca "copia sin conexión"; NO vuelve a persistir.
 *  - completar: encola durablemente (enqueueComplete) ANTES de clearResume, y
 *    dispara flush + removePlan. La durabilidad se prueba con un enqueue
 *    diferido: clearResume no ocurre hasta que la escritura resuelve.
 *
 * No-vacuidad: contra el código pre-fix (llamada directa a /complete, sin cola
 * ni persistencia) fallan: el fallback offline (loadPlan), savePlan, el prefetch
 * y el orden encolar→clearResume. Evidenciado en el reporte de la tarea.
 */
import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import FollowModeScreen from '../[id]';
import { api } from '../../../lib/api';
import { getResume, clearResume } from '../../../lib/follow/resume-store';
import { savePlan, loadPlan, removePlan } from '../../../lib/follow/plan-store';
import { enqueueComplete, flushQueue } from '../../../lib/follow/mutation-queue';
import { prefetchDayPhotos } from '../../../lib/follow/photo-prefetch';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'plan-1' }),
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('../../../components/ui/design-system', () => ({ ProgressDots: () => null }));
jest.mock('../../../components/map/PlanMap', () => ({ PlanMap: () => null }));
jest.mock('../../../components/follow/FollowDaySheet', () => {
  const { Pressable, Text } = require('react-native');
  return {
    FollowDaySheet: ({ onComplete }: { onComplete: () => void }) => (
      <Pressable testID="complete-btn" onPress={onComplete}>
        <Text>complete</Text>
      </Pressable>
    ),
  };
});
jest.mock('../../../components/ui/ConfirmModal', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ConfirmModal: ({ visible, onConfirm }: { visible: boolean; onConfirm: () => void }) =>
      visible ? (
        <Pressable testID="confirm-btn" onPress={onConfirm}>
          <Text>confirm</Text>
        </Pressable>
      ) : null,
  };
});

jest.mock('../../../lib/api', () => ({ api: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('../../../lib/auth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
jest.mock('../../../lib/useGateHandler', () => ({ useGateHandler: () => ({ presentGate: jest.fn() }) }));
jest.mock('../../../lib/follow/resume-store', () => ({
  getResume: jest.fn(async () => null),
  setResume: jest.fn(async () => undefined),
  clearResume: jest.fn(async () => undefined),
}));
jest.mock('../../../lib/follow/plan-store', () => ({
  savePlan: jest.fn(async () => undefined),
  loadPlan: jest.fn(async () => null),
  removePlan: jest.fn(async () => undefined),
}));
jest.mock('../../../lib/follow/mutation-queue', () => ({
  enqueueComplete: jest.fn(async () => undefined),
  flushQueue: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../lib/follow/photo-prefetch', () => ({ prefetchDayPhotos: jest.fn() }));
jest.mock('../../../lib/connectivity/use-connectivity', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

const mockApi = api as jest.Mock;
const mockGetResume = getResume as jest.Mock;
const mockClearResume = clearResume as jest.Mock;
const mockSavePlan = savePlan as jest.Mock;
const mockLoadPlan = loadPlan as jest.Mock;
const mockRemovePlan = removePlan as jest.Mock;
const mockEnqueue = enqueueComplete as jest.Mock;
const mockFlush = flushQueue as jest.Mock;
const mockPrefetch = prefetchDayPhotos as jest.Mock;

const PLAN = {
  id: 'plan-1',
  name: 'Weekend in Miami',
  city: 'Miami',
  days: [
    {
      dayNumber: 1,
      stops: [
        {
          id: 's1',
          placeId: 'p1',
          dayNumber: 1,
          orderIndex: 0,
          timeBlock: null,
          suggestedArrival: null,
          suggestedDurationMin: null,
          travelFromPrevious: null,
          place: {
            id: 'p1',
            name: 'Beach',
            category: 'Nature',
            latitude: 25.7,
            longitude: -80.1,
            photos: ['https://cdn/beach.jpg'],
          },
        },
      ],
    },
  ],
  routeSegments: [],
};

const ok = (data: unknown) => ({ data, error: null, errorBody: null, status: 200 });
const netFail = { data: null, error: 'Network error', errorBody: null, status: 0 };

const routeApi = (planRes: unknown, sessionRes: unknown = ok({ id: 'sess-1', planId: 'plan-1', status: 'active' })) =>
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/plans/plan-1') return planRes;
    if (path === '/follow/start') return sessionRes;
    return ok({});
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetResume.mockResolvedValue(null);
  mockLoadPlan.mockResolvedValue(null);
  mockEnqueue.mockResolvedValue(undefined);
  mockFlush.mockReturnValue(Promise.resolve());
});

describe('carga online', () => {
  it('persiste el plan a disco y prefetch de las fotos del día', async () => {
    routeApi(ok(PLAN));
    render(<FollowModeScreen />);

    await waitFor(() => expect(screen.getByText('Weekend in Miami')).toBeTruthy());
    expect(mockSavePlan).toHaveBeenCalledWith('plan-1', PLAN);
    await waitFor(() =>
      expect(mockPrefetch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ placeId: 'p1' })]),
      ),
    );
    // Sin fallback offline: loadPlan no se toca, no hay badge de copia.
    expect(mockLoadPlan).not.toHaveBeenCalled();
    expect(screen.queryByText('follow.offlineCached')).toBeNull();
  });

  it('vacía la cola de mutaciones pendientes al montar', async () => {
    routeApi(ok(PLAN));
    render(<FollowModeScreen />);
    await waitFor(() => expect(screen.getByText('Weekend in Miami')).toBeTruthy());
    expect(mockFlush).toHaveBeenCalled();
  });
});

describe('cold-start offline', () => {
  it('cae al plan cacheado, lo pinta y marca copia sin conexión', async () => {
    routeApi(netFail, netFail);
    mockLoadPlan.mockResolvedValue(PLAN);

    render(<FollowModeScreen />);

    await waitFor(() => expect(screen.getByText('Weekend in Miami')).toBeTruthy());
    expect(mockLoadPlan).toHaveBeenCalledWith('plan-1');
    expect(screen.getByText('follow.offlineCached')).toBeTruthy();
    // No re-persiste datos cacheados.
    expect(mockSavePlan).not.toHaveBeenCalled();
  });

  it('muestra error si no hay red NI plan cacheado', async () => {
    routeApi(netFail, netFail);
    mockLoadPlan.mockResolvedValue(null);

    render(<FollowModeScreen />);
    // Sin cache la pantalla muestra el estado de error (con CTA de volver).
    await waitFor(() => expect(screen.getByText('plan.goBack')).toBeTruthy());
  });
});

describe('completar el viaje', () => {
  it('encola el complete, luego clearResume + flush + removePlan', async () => {
    routeApi(ok(PLAN));
    render(<FollowModeScreen />);
    await waitFor(() => expect(screen.getByText('Weekend in Miami')).toBeTruthy());

    fireEvent.press(screen.getByTestId('complete-btn'));
    fireEvent.press(await screen.findByTestId('confirm-btn'));

    await waitFor(() => expect(mockClearResume).toHaveBeenCalledWith('plan-1'));
    expect(mockEnqueue).toHaveBeenCalledWith('sess-1', 'plan-1');
    expect(mockRemovePlan).toHaveBeenCalledWith('plan-1');
    // flush al montar (1) + flush oportunista al completar (2).
    expect(mockFlush).toHaveBeenCalledTimes(2);
  });

  it('NO hace clearResume hasta que el encolado durable resuelve', async () => {
    routeApi(ok(PLAN));
    let releaseEnqueue!: () => void;
    mockEnqueue.mockImplementationOnce(
      () => new Promise<void>((resolve) => { releaseEnqueue = resolve; }),
    );

    render(<FollowModeScreen />);
    await waitFor(() => expect(screen.getByText('Weekend in Miami')).toBeTruthy());

    fireEvent.press(screen.getByTestId('complete-btn'));
    fireEvent.press(await screen.findByTestId('confirm-btn'));

    // El enqueue sigue pendiente: clearResume aún no debe haber ocurrido.
    await Promise.resolve();
    expect(mockEnqueue).toHaveBeenCalled();
    expect(mockClearResume).not.toHaveBeenCalled();

    await act(async () => {
      releaseEnqueue();
      await Promise.resolve();
    });
    expect(mockClearResume).toHaveBeenCalledWith('plan-1');
  });
});
