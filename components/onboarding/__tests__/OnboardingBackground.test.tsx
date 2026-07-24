/**
 * Onboarding chrome (`OnboardingBackground`): the relit LIGHT backdrop. Asserts
 * the animated itinerary motif is mounted (Skia component present), children
 * render, the back affordance toggles on `onBack`, and the contrast tokens flow
 * through — the back chevron is deepOcean and ProgressDots gets the dark
 * `colorPending` (no more white-on-dark assumptions).
 *
 * The Skia canvas is mocked (same pattern as home-screen.test mocking
 * HeroSkiaBg) so jest never has to boot the native Skia backend.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { OnboardingBackground } from '../OnboardingBackground';
import { colors } from '../../../lib/theme';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: (props: Record<string, unknown>) => <View testID="onboarding-gradient" {...props} /> };
});
jest.mock('../OnboardingSkiaBg', () => {
  const { View } = jest.requireActual('react-native');
  return { OnboardingSkiaBg: () => <View testID="onboarding-skia-bg" /> };
});
// Capture the contrast props handed to the shared components.
jest.mock('../../ui/design-system', () => {
  const { View } = jest.requireActual('react-native');
  return {
    ProgressDots: (props: { colorPending?: string }) => (
      <View testID="progress-dots" progressColorPending={props.colorPending} />
    ),
  };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = jest.requireActual('react-native');
  return { Ionicons: (props: { color?: string }) => <View testID="back-chevron" iconColor={props.color} /> };
});

describe('OnboardingBackground — light animated chrome', () => {
  it('mounts the animated itinerary motif and the cream gradient under the content', () => {
    render(
      <OnboardingBackground step={0} totalSteps={5}>
        <Text>child</Text>
      </OnboardingBackground>,
    );
    expect(screen.getByTestId('onboarding-skia-bg')).toBeTruthy();
    expect(screen.getByTestId('onboarding-gradient')).toBeTruthy();
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('hides the back affordance on the first step (no onBack)', () => {
    render(
      <OnboardingBackground step={0} totalSteps={5}>
        <Text>child</Text>
      </OnboardingBackground>,
    );
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
  });

  it('renders a deepOcean back chevron and fires onBack when provided', () => {
    const onBack = jest.fn();
    render(
      <OnboardingBackground step={1} totalSteps={5} onBack={onBack}>
        <Text>child</Text>
      </OnboardingBackground>,
    );
    const chevron = screen.getByTestId('back-chevron');
    expect(chevron.props.iconColor).toBe(colors.deepOcean);
    fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('passes a dark (light-backdrop) colorPending to ProgressDots', () => {
    render(
      <OnboardingBackground step={1} totalSteps={5}>
        <Text>child</Text>
      </OnboardingBackground>,
    );
    expect(screen.getByTestId('progress-dots').props.progressColorPending).toBe('rgba(15, 23, 42, 0.15)');
  });
});
