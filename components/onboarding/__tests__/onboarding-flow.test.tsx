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
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform, BackHandler } from 'react-native';
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
    OnboardingCityScreen: ({
      onSelectCity,
      onNotifyUncovered,
    }: {
      onSelectCity: (c: string, covered: boolean) => void;
      onNotifyUncovered: () => void;
    }) => (
      <>
        <TouchableOpacity testID="city-select" onPress={() => onSelectCity('Miami', true)}>
          <Text>select Miami</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="city-notify" onPress={onNotifyUncovered}>
          <Text>notify me</Text>
        </TouchableOpacity>
      </>
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
        <TouchableOpacity
          testID="taste-continue-nobudget"
          onPress={() => onContinue({ interests: ['food'], budget: null })}
        >
          <Text>continue no budget</Text>
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
// The W5 paywall step is mocked to expose its three onboarding exits as buttons;
// its real behavior (reusing PaywallView, degradation auto-skip, no trial framing
// to non-eligibles) is covered by OnboardingPaywallStep.test.tsx. This test is
// about the orchestrator's navigation + completion side effects.
jest.mock('../OnboardingPaywallStep', () => {
  const { View, TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    OnboardingPaywallStep: ({
      onBack,
      onSkip,
      onPurchased,
    }: {
      onBack: () => void;
      onSkip: () => void;
      onPurchased: () => void;
    }) => (
      <View testID="paywall-step">
        <TouchableOpacity testID="paywall-step-skip" onPress={onSkip}>
          <Text>not now</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="paywall-step-purchased" onPress={onPurchased}>
          <Text>purchased</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="paywall-step-back" onPress={onBack}>
          <Text>paywall back</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});
// The login is mocked, but it MODELS its internal `choose` → `credentials`
// sub-step and publishes the same `onRegisterInnerBack` handler the real screen
// does. Without modelling the sub-step, a flat `LOGIN` node cannot reveal the
// over-dismiss bug (physical back tearing the whole login down instead of
// stepping credentials → choose).
jest.mock('../../../app/login', () => {
  const { useState, useEffect } = jest.requireActual('react');
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  const MockLoginScreen = ({
    onClose,
    onRegisterInnerBack,
  }: {
    onClose?: () => void;
    onRegisterInnerBack?: (handler: (() => boolean) | null) => void;
  }) => {
    const [subStep, setSubStep] = useState('choose');
    useEffect(() => {
      if (!onRegisterInnerBack) return;
      onRegisterInnerBack(() => {
        if (subStep === 'credentials') {
          setSubStep('choose');
          return true;
        }
        return false;
      });
      return () => onRegisterInnerBack(null);
    }, [onRegisterInnerBack, subStep]);
    return (
      <>
        <Text>LOGIN</Text>
        <Text>{`login-step:${subStep}`}</Text>
        <TouchableOpacity testID="login-to-credentials" onPress={() => setSubStep('credentials')}>
          <Text>to credentials</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity testID="login-close" onPress={onClose}>
            <Text>close</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };
  return { __esModule: true, default: MockLoginScreen };
});

const mockTrack = track as jest.Mock;

// Captures the `hardwareBackPress` callback the orchestrator registers so tests
// can simulate the Android physical back button. The handler is Android-only, so
// we force `Platform.OS` and stub `addEventListener` to grab the latest closure
// (the effect re-registers on every step/login change).
type BackCb = () => boolean | null | undefined;
let hardwareBack: BackCb | null = null;
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  hardwareBack = null;
  (Platform as { OS: string }).OS = 'android';
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((event: string, cb: BackCb) => {
      if (event === 'hardwareBackPress') hardwareBack = cb;
      return { remove: jest.fn() } as unknown as ReturnType<typeof BackHandler.addEventListener>;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  (Platform as { OS: string }).OS = originalOS;
});

const pressHardwareBack = (): boolean => {
  let handled = false;
  act(() => {
    handled = hardwareBack?.() === true;
  });
  return handled;
};

describe('onboarding orchestrator — navigation + side effects', () => {
  it('mounts on the value step and fires started + step_viewed(value)', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('step:0')).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_started' });
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_step_viewed', step: 'value' });
  });

  it('walks value → city → interests → preview → paywall → complete with the right side effects', async () => {
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

    // preview → paywall step (W5). "Create my plan" no longer completes: it
    // advances to the paywall, which fires its step_viewed and completion later.
    fireEvent.press(screen.getByTestId('preview-create'));
    expect(screen.getByTestId('paywall-step')).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_step_viewed', step: 'paywall' });
    expect(completeOnboarding).not.toHaveBeenCalled();

    // paywall → complete (skip / "not now" → skippedPaywall:true)
    fireEvent.press(screen.getByTestId('paywall-step-skip'));
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_completed', skippedPaywall: true });
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
  });

  // W5: an effective purchase/restore from the paywall step completes the flow
  // with skippedPaywall:false (the conversion signal in the funnel).
  it('paywall step: a purchase completes onboarding with skippedPaywall:false', async () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start'));
    fireEvent.press(screen.getByTestId('city-select'));
    fireEvent.press(screen.getByTestId('taste-continue'));
    fireEvent.press(screen.getByTestId('preview-create'));
    expect(screen.getByTestId('paywall-step')).toBeTruthy();

    fireEvent.press(screen.getByTestId('paywall-step-purchased'));
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_completed', skippedPaywall: false });
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
  });

  // W5 (no dead-end): back from the paywall step returns to the preview and does
  // NOT complete the flow — the user can still change their mind and go back.
  it('paywall step: back returns to the preview without completing', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start'));
    fireEvent.press(screen.getByTestId('city-select'));
    fireEvent.press(screen.getByTestId('taste-continue'));
    fireEvent.press(screen.getByTestId('preview-create'));
    expect(screen.getByTestId('paywall-step')).toBeTruthy();

    fireEvent.press(screen.getByTestId('paywall-step-back'));
    // Back on the preview (step 3), paywall dismissed, nothing completed.
    expect(screen.getByText('create for Miami')).toBeTruthy();
    expect(screen.queryByTestId('paywall-step')).toBeNull();
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  // W5 analytics: the paywall step_viewed must fire only once — back to the
  // preview and forward again to the paywall must not re-emit it (seenSteps).
  it('paywall step: step_viewed(paywall) is not re-fired on back-and-forward', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start'));
    fireEvent.press(screen.getByTestId('city-select'));
    fireEvent.press(screen.getByTestId('taste-continue'));
    fireEvent.press(screen.getByTestId('preview-create')); // → paywall (viewed once)
    fireEvent.press(screen.getByTestId('paywall-step-back')); // → preview (already seen)
    fireEvent.press(screen.getByTestId('preview-create')); // → paywall again (already seen)

    const paywallViews = mockTrack.mock.calls
      .map((c) => c[0])
      .filter((e) => e.event === 'onboarding_step_viewed' && e.step === 'paywall');
    expect(paywallViews).toHaveLength(1);
  });

  // MINOR-1 (data correctness): a deselected budget must be persisted as `null`,
  // not dropped. A falsy-guarded spread would omit `budget`, leaving a previously
  // chosen tier in the store — re-seeding a selected chip and syncing a phantom
  // tier on login. Budget must be written unconditionally, exactly like interests.
  it('persists a deselected budget as null (unconditional write, symmetric with interests)', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start'));
    fireEvent.press(screen.getByTestId('city-select'));
    fireEvent.press(screen.getByTestId('taste-continue-nobudget'));
    expect(setOnboardingPrefs).toHaveBeenCalledWith({ interests: ['food'], budget: null });
    expect(screen.getByText('step:3')).toBeTruthy();
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

  // MINOR: analytics can never see demand for uncovered cities because the grid
  // only lists covered ones. Notify-me is the sole `covered:false` producer.
  it('notify-me for an uncovered city fires city_selected {covered:false} without advancing', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start')); // → city step
    expect(screen.getByText('step:1')).toBeTruthy();

    fireEvent.press(screen.getByTestId('city-notify'));
    expect(mockTrack).toHaveBeenCalledWith({
      event: 'onboarding_city_selected',
      city: '',
      covered: false,
    });
    // Uncovered selection must NOT advance or write a city.
    expect(screen.getByText('step:1')).toBeTruthy();
    expect(setSelectedCity).not.toHaveBeenCalled();
  });

  // MINOR: back-navigation must not re-emit `step_viewed` for steps already seen,
  // or the funnel view counts inflate.
  it('does not re-fire step_viewed when navigating back to an already-seen step', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start')); // value → city (city viewed)
    fireEvent.press(screen.getByTestId('bg-back')); // city → value (already seen)
    fireEvent.press(screen.getByTestId('value-start')); // value → city again (already seen)

    const stepViews = mockTrack.mock.calls
      .map((c) => c[0])
      .filter((e) => e.event === 'onboarding_step_viewed');
    const valueViews = stepViews.filter((e) => e.step === 'value');
    const cityViews = stepViews.filter((e) => e.step === 'city');
    expect(valueViews).toHaveLength(1);
    expect(cityViews).toHaveLength(1);
  });
});

// MAJOR: the gate renders onboarding outside any navigator, so the Android
// hardware back button has no handler unless the orchestrator installs one.
// `onboarding-flow.test` above only ever exercised the JS chevron (`bg-back`),
// leaving the physical back — the real dead-end on Android — uncovered.
describe('onboarding orchestrator — Android hardware back', () => {
  it('registers a hardwareBackPress handler on Android', () => {
    render(<OnboardingScreen />);
    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
    expect(hardwareBack).toBeInstanceOf(Function);
  });

  it('does NOT register the handler on iOS (no hardware back)', () => {
    (Platform as { OS: string }).OS = 'ios';
    render(<OnboardingScreen />);
    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });

  it('back on the inline login at the choose sub-step dismisses it to the flow (returns to value)', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-signin'));
    expect(screen.getByText('LOGIN')).toBeTruthy();
    expect(screen.getByText('login-step:choose')).toBeTruthy();

    expect(pressHardwareBack()).toBe(true); // consumed
    expect(screen.getByTestId('value-start')).toBeTruthy();
    expect(screen.queryByText('LOGIN')).toBeNull();
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  // MINOR-2 (UX): the physical back must respect the login's INTERNAL sub-step.
  // On `credentials` it returns to `choose` (equivalent to the on-screen chevron
  // `onBack`), keeping the login open — it must NOT tear the whole login down and
  // strand the user back on the value screen (the over-dismiss bug).
  it('back on the login credentials sub-step returns to choose without closing the login', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-signin'));
    fireEvent.press(screen.getByTestId('login-to-credentials'));
    expect(screen.getByText('login-step:credentials')).toBeTruthy();

    expect(pressHardwareBack()).toBe(true); // consumed by the login's own sub-step
    // Login is still open, back on its provider-choice sub-step.
    expect(screen.getByText('LOGIN')).toBeTruthy();
    expect(screen.getByText('login-step:choose')).toBeTruthy();
    expect(screen.queryByTestId('value-start')).toBeNull();
    expect(completeOnboarding).not.toHaveBeenCalled();

    // A second back — now on `choose` — dismisses the whole login to the flow.
    expect(pressHardwareBack()).toBe(true);
    expect(screen.getByTestId('value-start')).toBeTruthy();
    expect(screen.queryByText('LOGIN')).toBeNull();
  });

  it('back on a non-first step steps the flow backwards (step 2 → step 1)', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start')); // step 1
    fireEvent.press(screen.getByTestId('city-select')); // covered → step 2
    expect(screen.getByText('step:2')).toBeTruthy();

    expect(pressHardwareBack()).toBe(true); // consumed
    expect(screen.getByText('step:1')).toBeTruthy();
  });

  it('back on the first step is NOT consumed (OS default exits the app)', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('step:0')).toBeTruthy();
    expect(pressHardwareBack()).toBe(false); // yields to OS default
    expect(screen.getByText('step:0')).toBeTruthy();
  });

  // W5 (no dead-end on the platform with a hardware back): the physical back on
  // the paywall step retreats to the preview, exactly like its close X — never
  // strands the user and never completes the flow.
  it('back on the paywall step retreats to the preview (not a dead-end)', () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId('value-start'));
    fireEvent.press(screen.getByTestId('city-select'));
    fireEvent.press(screen.getByTestId('taste-continue'));
    fireEvent.press(screen.getByTestId('preview-create'));
    expect(screen.getByTestId('paywall-step')).toBeTruthy();

    expect(pressHardwareBack()).toBe(true); // consumed
    expect(screen.getByText('create for Miami')).toBeTruthy();
    expect(screen.queryByTestId('paywall-step')).toBeNull();
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});
