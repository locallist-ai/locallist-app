/**
 * Onboarding screen 3 (tastes): multi-select interests (taxonomy-driven chips) +
 * single-select budget, Continue hands the captured prefs up, Skip advances with
 * nothing.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingTasteScreen } from '../OnboardingTasteScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
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

beforeEach(() => jest.clearAllMocks());

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
});
