/**
 * Onboarding orchestrator (`app/onboarding/index.tsx`): the four-step machine,
 * its analytics, prefs/trip-context writes, completion, and — critically — the
 * fix for the W1 dead-end (the inline login can be dismissed back to the flow).
 *
 * The four screens, the background chrome and the login are mocked to expose
 * their callbacks as buttons; this test is about navigation + side effects, not
 * their visuals (covered by each screen's own test).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../../../app/onboarding';
import { track } from '../../../lib/analytics';
import { completeOnboarding, setOnboardingPrefs } from '../../../lib/onboarding-store';
import { setSelectedCity } from '../../../lib/trip-context-store';

jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/onboarding-store', () => ({
  completeOnboarding: jest.fn(() => Promise.resolve()),
  setOnboardingPrefs: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../lib/trip-context-store', () => ({
  setSelectedCity: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../OnboardingBackground', () => {
  const { View, Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    OnboardingBackground: ({
      step,
      onBack,
      children,
    }: {
      step: number;
      onBack?: () => void;
      children: React.ReactNode;
    }) => (
      <View>
        <Text>{`step:${step}`}</Text>
        {onBack && (
          <TouchableOpacity testID="bg-back" onPress={onBack}>
            <Text>back</Text>
          </TouchableOpacity>
        )}
        {children}
      </View>
    ),
  };
});
jest.mock('../OnboardingValueScreen', () => {
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    OnboardingValueScreen: ({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) => (
      <>
        <TouchableOpacity testID="value-start" onPress={onStart}>
          <Text>start</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="value-signin" onPress={onSignIn}>
          <Text>signin</Text>
        </TouchableOpacity>
      </>
    ),
  };
});
jest.mock('../OnboardingCityScreen', () => {
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    OnboardingCityScreen: ({ onSelectCity }: { onSelectCity: (c: string, covered: boolean) => void }) => (
      <TouchableOpacity testID="city-select" onPress={() => onSelectCity('Miami', true)}>
        <Text>select Miami</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock('../OnboardingTasteScreen', () => {
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    OnboardingTasteScreen: ({
      onContinue,
      onSkip,
    }: {
      onContinue: (p: { interests: string[]; budget: string | null }) => void;
      onSkip: () => void;
    }) => (
      <>
        <TouchableOpacity testID="taste-continue" onPress={() => onContinue({ interests: ['food'], budget: 'moderate' })}>
          <Text>continue</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="taste-skip" onPress={onSkip}>
          <Text>skip</Text>
        </TouchableOpacity>
      </>
    ),
  };
});
jest.mock('../OnboardingPreviewScreen', () => {
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    OnboardingPreviewScreen: ({ city, onCreatePlan }: { city: string | null; onCreatePlan: () => void }) => (
      <TouchableOpacity testID="preview-create" onPress={onCreatePlan}>
        <Text>{`create for ${city}`}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock('../../../app/login', () => {
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onClose }: { onClose?: () => void }) => (
      <>
        <Text>LOGIN</Text>
        {onClose && (
          <TouchableOpacity testID="login-close" onPress={onClose}>
            <Text>close</Text>
          </TouchableOpacity>
        )}
      </>
    ),
  };
});

const mockTrack = track as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('onboarding orchestrator — navigation + side effects', () => {
  it('mounts on the value step and fires started + step_viewed(value)', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('step:0')).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_started' });
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_step_viewed', step: 'value' });
  });

  it('walks value → city → interests → preview → complete with the right side effects', async () => {
    render(<OnboardingScreen />);

    // value → city
    fireEvent.press(screen.getByTestId('value-start'));
    expect(screen.getByText('step:1')).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_step_viewed', step: 'city' });

    // city → interests (persists city + trip context, fires city_selected)
    fireEvent.press(screen.getByTestId('city-select'));
    expect(setSelectedCity).toHaveBeenCalledWith('Miami');
    expect(setOnboardingPrefs).toHaveBeenCalledWith({ city: 'Miami' });
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_city_selected', city: 'Miami', covered: true });
    expect(screen.getByText('step:2')).toBeTruthy();

    // interests → preview (persists taste prefs)
    fireEvent.press(screen.getByTestId('taste-continue'));
    expect(setOnboardingPrefs).toHaveBeenCalledWith({ interests: ['food'], budget: 'moderate' });
    expect(screen.getByText('step:3')).toBeTruthy();
    // Preview receives the preselected city.
    expect(screen.getByText('create for Miami')).toBeTruthy();

    // preview → complete
    fireEvent.press(screen.getByTestId('preview-create'));
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_completed', skippedPaywall: true });
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
  });

  it('Skip on tastes still advances to preview', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start'));
    fireEvent.press(screen.getByTestId('city-select'));
    fireEvent.press(screen.getByTestId('taste-skip'));
    expect(screen.getByText('step:3')).toBeTruthy();
  });

  it('back navigation steps the flow backwards', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start')); // step 1
    expect(screen.getByText('step:1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('bg-back'));
    expect(screen.getByText('step:0')).toBeTruthy();
  });

  it('DEAD-END FIX: inline login can be dismissed back to the value screen', () => {
    render(<OnboardingScreen />);

    // Open the inline login from "I already have an account".
    fireEvent.press(screen.getByTestId('value-signin'));
    expect(screen.getByText('LOGIN')).toBeTruthy();
    expect(screen.queryByTestId('value-start')).toBeNull();

    // Close it — the user returns to the flow instead of being trapped.
    fireEvent.press(screen.getByTestId('login-close'));
    expect(screen.getByTestId('value-start')).toBeTruthy();
    expect(screen.queryByText('LOGIN')).toBeNull();
    // Backing out of login never completes onboarding.
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});
