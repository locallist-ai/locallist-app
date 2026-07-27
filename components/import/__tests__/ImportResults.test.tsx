/**
 * ImportResults — selection + tier-aware day picker + create. `mapGateError`
 * stays REAL; the API + router are mocked. Assertions fail against mutations
 * that drop the preselection, the tier gating or the create wiring.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ImportResults } from '../ImportResults';
import { createImportPlan } from '../../../lib/api';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../lib/api', () => ({ createImportPlan: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
// Deterministic tier caps without pulling PNG assets / haptics.
jest.mock('../../home/constants', () => ({
  maxDaysForTier: (isPro: boolean) => (isPro ? 14 : 3),
  PLUS_MAX_DAYS: 14,
  FREE_MAX_DAYS: 3,
}));

const mockCreatePlan = createImportPlan as jest.Mock;

const candidates = [
  { name: 'Place A', matchedPlaceId: 'p1', matchedPlaceName: 'Place A', matchConfidence: 'high' as const },
  { name: 'Unknown Bar' },
];

const baseProps = {
  candidates,
  city: 'Miami',
  isPro: false,
  platform: 'self' as const,
  creatorHandle: '',
  presentGate: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

it('match preseleccionado → crear habilitado; no-match no seleccionable', () => {
  render(<ImportResults {...baseProps} />);
  expect(screen.getByTestId('candidate-0').props.accessibilityState.checked).toBe(true);
  expect(screen.getByTestId('candidate-1').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByTestId('import-create').props.accessibilityState.disabled).toBe(false);
});

it('free: pills 1..3 + afford. bloqueada; pulsarla dispara upsell duration_requires_plus', () => {
  const presentGate = jest.fn();
  render(<ImportResults {...baseProps} presentGate={presentGate} />);

  expect(screen.getByTestId('import-day-3')).toBeTruthy();
  expect(screen.queryByTestId('import-day-4')).toBeNull();
  expect(screen.getByTestId('import-day-locked')).toBeTruthy();

  fireEvent.press(screen.getByTestId('import-day-locked'));
  expect(presentGate).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'upsell', code: 'duration_requires_plus' }),
  );
});

it('Plus: pills hasta 14 y SIN afford. bloqueada', () => {
  render(<ImportResults {...baseProps} isPro />);
  expect(screen.getByTestId('import-day-14')).toBeTruthy();
  expect(screen.queryByTestId('import-day-locked')).toBeNull();
});

it('deseleccionar el único match deshabilita crear y explica por qué', () => {
  render(<ImportResults {...baseProps} />);
  fireEvent.press(screen.getByTestId('candidate-0'));

  expect(screen.getByTestId('import-create').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText('import.selectAtLeastOne')).toBeTruthy();
});

it('crear → createImportPlan con ids + días elegidos y navega al plan', async () => {
  mockCreatePlan.mockResolvedValue({ data: { id: 'plan-123' }, error: null, errorBody: null, status: 200 });
  render(<ImportResults {...baseProps} />);

  fireEvent.press(screen.getByTestId('import-day-2'));
  fireEvent.press(screen.getByTestId('import-create'));

  await waitFor(() =>
    expect(mockCreatePlan).toHaveBeenCalledWith({
      city: 'Miami',
      days: 2,
      placeIds: ['p1'],
      planName: undefined,
      platform: 'self',
    }),
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/plan/plan-123'));
});
