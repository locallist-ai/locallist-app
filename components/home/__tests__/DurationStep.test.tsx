/**
 * Tests de `components/home/DurationStep.tsx` — picker de duración por tier.
 *
 *  - Free: pills 1..3 + afford. "Plus" bloqueada; tocarla dispara el upsell
 *    duration_requires_plus. No hay pill de 4+.
 *  - Plus: pills 1..14, sin afford. bloqueada.
 *  - Seleccionar un día llama onSelectDays con el número.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { DurationStep } from '../DurationStep';
import { useAuth } from '../../../lib/auth';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../ui/design-system', () => ({
  EditorialTitle: () => null,
  StepSubtitle: () => null,
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

describe('DurationStep — free', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ isPro: false }));

  it('muestra pills 1..3 y la afford. Plus bloqueada, sin pill de 4', () => {
    render(<DurationStep selectedDays={null} onSelectDays={jest.fn()} onContinue={jest.fn()} />);

    expect(screen.getByTestId('duration-pill-1')).toBeTruthy();
    expect(screen.getByTestId('duration-pill-3')).toBeTruthy();
    expect(screen.queryByTestId('duration-pill-4')).toBeNull();
    expect(screen.getByTestId('duration-plus-locked')).toBeTruthy();
  });

  it('tocar la afford. bloqueada dispara el upsell duration_requires_plus', () => {
    render(<DurationStep selectedDays={null} onSelectDays={jest.fn()} onContinue={jest.fn()} />);

    fireEvent.press(screen.getByTestId('duration-plus-locked'));

    expect(mockPresentGate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'upsell', code: 'duration_requires_plus', maxDays: 3, plusMaxDays: 14 }),
    );
  });

  it('seleccionar un día llama onSelectDays con el número', () => {
    const onSelectDays = jest.fn();
    render(<DurationStep selectedDays={null} onSelectDays={onSelectDays} onContinue={jest.fn()} />);

    fireEvent.press(screen.getByTestId('duration-pill-2'));

    expect(onSelectDays).toHaveBeenCalledWith(2);
  });
});

describe('DurationStep — plus', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ isPro: true }));

  it('muestra pills hasta 14 y NO la afford. bloqueada', () => {
    render(<DurationStep selectedDays={null} onSelectDays={jest.fn()} onContinue={jest.fn()} />);

    expect(screen.getByTestId('duration-pill-14')).toBeTruthy();
    expect(screen.queryByTestId('duration-plus-locked')).toBeNull();
  });
});
