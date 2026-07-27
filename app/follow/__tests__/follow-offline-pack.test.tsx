/**
 * Cableado del pack offline en Follow Mode (regresión MAJOR-1).
 *
 * El pack debe cubrir TODO el plan, no el día visible: `PlanMap` recibe los
 * pines/ruta del día activo en `stops`, pero el bbox del pack se calcula sobre
 * `packStops` = todos los stops de todos los días. Este test captura las props
 * que la pantalla pasa a `PlanMap`.
 *
 * No-vacuidad: si la pantalla pasara los stops del DÍA como `packStops` (el bug),
 * `packStops` no contendría el stop del día 2 → el `expect` de p2 falla.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import FollowModeScreen from '../[id]';
import { api } from '../../../lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPlanMapProps: any = null;
jest.mock('../../../components/map/PlanMap', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PlanMap: (props: any) => {
    mockPlanMapProps = props;
    return null;
  },
}));

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
jest.mock('../../../components/follow/FollowDaySheet', () => ({ FollowDaySheet: () => null }));
jest.mock('../../../components/ui/ConfirmModal', () => ({ ConfirmModal: () => null }));
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

const mockApi = api as jest.Mock;

// Plan de DOS días: día 1 = p1 (Beach), día 2 = p2 (Museum), en otro rincón.
const MULTI_DAY_PLAN = {
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
          place: { id: 'p1', name: 'Beach', category: 'Nature', latitude: 25.7, longitude: -80.1, photos: [] },
        },
      ],
    },
    {
      dayNumber: 2,
      stops: [
        {
          id: 's2',
          placeId: 'p2',
          dayNumber: 2,
          orderIndex: 0,
          timeBlock: null,
          suggestedArrival: null,
          suggestedDurationMin: null,
          travelFromPrevious: null,
          place: { id: 'p2', name: 'Museum', category: 'Culture', latitude: 26.2, longitude: -80.4, photos: [] },
        },
      ],
    },
  ],
  routeSegments: [],
};

const ok = (data: unknown) => ({ data, error: null, errorBody: null, status: 200 });

beforeEach(() => {
  jest.clearAllMocks();
  mockPlanMapProps = null;
  mockApi.mockImplementation(async (path: string) => {
    if (path === '/plans/plan-1') return ok(MULTI_DAY_PLAN);
    if (path === '/follow/start') return ok({ id: 'sess-1', planId: 'plan-1', status: 'active' });
    return ok({});
  });
});

it('packStops cubre TODO el plan (ambos días); stops solo el día activo', async () => {
  render(<FollowModeScreen />);
  await waitFor(() => expect(screen.getByText('Weekend in Miami')).toBeTruthy());
  await waitFor(() => expect(mockPlanMapProps).not.toBeNull());

  expect(mockPlanMapProps.planId).toBe('plan-1');

  // Render del día activo (día 1): solo p1.
  const stopIds = mockPlanMapProps.stops.map((s: { id: string }) => s.id);
  expect(stopIds).toEqual(['p1']);

  // Pack del plan entero: p1 (día 1) Y p2 (día 2). Falla si se pasa el día.
  const packIds = mockPlanMapProps.packStops.map((s: { id: string }) => s.id).sort();
  expect(packIds).toEqual(['p1', 'p2']);
});
