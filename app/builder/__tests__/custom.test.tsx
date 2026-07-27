/**
 * Custom builder screen (`app/builder/custom.tsx`) — cobertura del rediseño
 * TIER-AWARE de la duración (la brecha funcional que arregla el rediseño).
 *
 *  - Free: pills 1..3 + afford. "Plus" bloqueada; tocarla dispara el upsell
 *    duration_requires_plus. No hay pill de 4.
 *  - Plus: pills hasta 14, sin afford. bloqueada.
 *  - Seleccionar una pill actualiza el estado seleccionado.
 *
 * `home/constants` se mockea (como en import-video.test) para fijar los topes
 * sin arrastrar los PNG de assets.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import CustomBuilderScreen from '../custom';
import { useAuth } from '../../../lib/auth';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain: Record<string, () => unknown> = {};
  ['duration', 'delay', 'springify', 'damping', 'easing'].forEach((m) => {
    chain[m] = () => chain;
  });
  return { __esModule: true, default: { View }, FadeInDown: chain };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('../../../lib/api', () => ({
  api: jest.fn(async () => ({ data: { cities: [] }, error: null })),
}));
jest.mock('../../../components/ui/StartDateField', () => ({ StartDateField: () => null }));
jest.mock('../../../components/ui/design-system', () => ({
  EditorialTitle: () => null,
  StepSubtitle: () => null,
  PrimaryButton: () => null,
}));
jest.mock('../../../lib/trip-context-store', () => ({
  getStartDateSync: () => '2026-07-23',
  setStartDate: jest.fn(),
}));
// Fija los topes por tier sin cargar los PNG del wizard (mismo patrón que
// import-video.test). maxDaysForTier real vive aquí; lo replicamos 1:1.
jest.mock('../../../components/home/constants', () => ({
  FREE_MAX_DAYS: 3,
  PLUS_MAX_DAYS: 14,
  maxDaysForTier: (isPro: boolean) => (isPro ? 14 : 3),
}));
jest.mock('../../../lib/auth', () => ({ useAuth: jest.fn() }));

const mockPresentGate = jest.fn();
jest.mock('../../../lib/useGateHandler', () => ({
  useGateHandler: () => ({ presentGate: mockPresentGate, presentClamped: jest.fn() }),
}));

const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CustomBuilderScreen — duración (free)', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ isPro: false }));

  it('muestra pills 1..3 + afford. Plus bloqueada, sin pill de 4', () => {
    render(<CustomBuilderScreen />);

    expect(screen.getByTestId('duration-pill-1')).toBeTruthy();
    expect(screen.getByTestId('duration-pill-3')).toBeTruthy();
    expect(screen.queryByTestId('duration-pill-4')).toBeNull();
    expect(screen.getByTestId('duration-plus-locked')).toBeTruthy();
  });

  it('tocar la afford. bloqueada dispara el upsell duration_requires_plus', () => {
    render(<CustomBuilderScreen />);

    fireEvent.press(screen.getByTestId('duration-plus-locked'));

    expect(mockPresentGate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upsell',
        code: 'duration_requires_plus',
        maxDays: 3,
        plusMaxDays: 14,
      }),
    );
  });

  it('seleccionar una pill marca esa duración como seleccionada', () => {
    render(<CustomBuilderScreen />);

    // Default = 2 días.
    expect(screen.getByTestId('duration-pill-2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('duration-pill-3').props.accessibilityState.selected).toBe(false);

    fireEvent.press(screen.getByTestId('duration-pill-3'));

    expect(screen.getByTestId('duration-pill-3').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('duration-pill-2').props.accessibilityState.selected).toBe(false);
  });
});

describe('CustomBuilderScreen — duración (plus)', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ isPro: true }));

  it('muestra pills hasta 14 y NO la afford. bloqueada', () => {
    render(<CustomBuilderScreen />);

    expect(screen.getByTestId('duration-pill-14')).toBeTruthy();
    expect(screen.queryByTestId('duration-plus-locked')).toBeNull();
  });
});
