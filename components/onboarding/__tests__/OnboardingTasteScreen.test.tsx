/**
 * Onboarding screen 3 (tastes): multi-select interests (taxonomy-driven chips) +
 * single-select budget, Continue hands the captured prefs up, Skip advances with
 * nothing.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingTasteScreen } from '../OnboardingTasteScreen';
import { getOnboardingPrefsSync } from '../../../lib/onboarding-store';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
// Seed the taste screen from prefs already captured this session (see MINOR fix).
jest.mock('../../../lib/onboarding-store', () => ({
  getOnboardingPrefsSync: jest.fn(() => ({})),
}));
const mockGetPrefs = getOnboardingPrefsSync as jest.Mock;
jest.mock('../../ui/design-system', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    EditorialTitle: ({ text }: { text: string }) => <Text>{text}</Text>,
    StepSubtitle: ({ text }: { text: string }) => <Text>{text}</Text>,
    ChoiceChip: ({
      label,
      selected,
      onPress,
      testID,
    }: {
      label: string;
      selected: boolean;
      onPress: () => void;
      testID?: string;
    }) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{selected ? `[x] ${label}` : label}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock('../../home/useTaxonomy', () => {
  const actual = jest.requireActual('../../home/useTaxonomy');
  return {
    ...actual,
    useTaxonomy: () => ({
      categories: ['Food', 'Outdoors', 'Coffee', 'Culture', 'Nightlife', 'Wellness', 'Shopping'],
      subcategoriesByCategory: {},
      labels: { en: {}, es: {} },
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPrefs.mockReturnValue({});
});

describe('OnboardingTasteScreen', () => {
  it('renders one interest chip per taxonomy category', () => {
    render(<OnboardingTasteScreen onContinue={jest.fn()} onSkip={jest.fn()} />);
    expect(screen.getByTestId('interest-food')).toBeTruthy();
    expect(screen.getByTestId('interest-shopping')).toBeTruthy();
    expect(screen.getByTestId('budget-moderate')).toBeTruthy();
  });

  it('Continue hands the multi-selected interests and single budget up', () => {
    const onContinue = jest.fn();
    render(<OnboardingTasteScreen onContinue={onContinue} onSkip={jest.fn()} />);

    fireEvent.press(screen.getByTestId('interest-food'));
    fireEvent.press(screen.getByTestId('interest-coffee'));
    // Budget is single-select: the second pick replaces the first.
    fireEvent.press(screen.getByTestId('budget-moderate'));
    fireEvent.press(screen.getByTestId('budget-premium'));

    fireEvent.press(screen.getByText('onboarding.continue'));
    expect(onContinue).toHaveBeenCalledWith({ interests: ['food', 'coffee'], budget: 'premium' });
  });

  it('Continue with no picks hands empty interests + null budget', () => {
    const onContinue = jest.fn();
    render(<OnboardingTasteScreen onContinue={onContinue} onSkip={jest.fn()} />);
    fireEvent.press(screen.getByText('onboarding.continue'));
    expect(onContinue).toHaveBeenCalledWith({ interests: [], budget: null });
  });

  it('Skip calls onSkip', () => {
    const onSkip = jest.fn();
    render(<OnboardingTasteScreen onContinue={jest.fn()} onSkip={onSkip} />);
    fireEvent.press(screen.getByText('onboarding.skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  // MINOR fix: revisiting tastes (remounted from the preview) must not wipe the
  // interests/budget captured before. The screen seeds from persisted prefs, so
  // a bare Continue re-hands the same selection up instead of `[]`.
  it('seeds interests + budget from already-persisted prefs (non-destructive back-nav)', () => {
    mockGetPrefs.mockReturnValue({ interests: ['food', 'coffee'], budget: 'moderate' });
    const onContinue = jest.fn();
    render(<OnboardingTasteScreen onContinue={onContinue} onSkip={jest.fn()} />);

    // Pre-filled chips render as selected.
    expect(screen.getByText('[x] wizard.interestFood')).toBeTruthy();
    // Continue without touching anything preserves the prior selection.
    fireEvent.press(screen.getByText('onboarding.continue'));
    expect(onContinue).toHaveBeenCalledWith({ interests: ['food', 'coffee'], budget: 'moderate' });
  });

  // MINOR-1 (data correctness): deselecting a previously-seeded budget must
  // re-deliver `budget: null` (not the stale seeded tier), so the orchestrator can
  // persist the deselection. This is the screen half of the deselect round trip.
  it('deselecting a seeded budget re-delivers budget:null on Continue', () => {
    mockGetPrefs.mockReturnValue({ interests: ['food'], budget: 'moderate' });
    const onContinue = jest.fn();
    render(<OnboardingTasteScreen onContinue={onContinue} onSkip={jest.fn()} />);

    // The seeded tier renders selected...
    expect(screen.getByText('[x] wizard.budgetModerate')).toBeTruthy();
    // ...tapping it again deselects (single-select toggles off).
    fireEvent.press(screen.getByTestId('budget-moderate'));
    fireEvent.press(screen.getByText('onboarding.continue'));
    expect(onContinue).toHaveBeenCalledWith({ interests: ['food'], budget: null });
  });

  // MINOR-1: after a deselection is persisted as null, a remount seeds `null` and
  // the budget chip must render UNSELECTED (never fall back to a stale tier).
  it('seeds no selected budget chip when the persisted budget is null', () => {
    mockGetPrefs.mockReturnValue({ interests: ['food'], budget: null });
    render(<OnboardingTasteScreen onContinue={jest.fn()} onSkip={jest.fn()} />);
    // Chip is present but not marked selected (no `[x]` prefix).
    expect(screen.getByTestId('budget-moderate')).toBeTruthy();
    expect(screen.queryByText('[x] wizard.budgetModerate')).toBeNull();
  });
});
