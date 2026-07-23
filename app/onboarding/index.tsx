import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { track, type OnboardingStepName } from '../../lib/analytics';
import { completeOnboarding, setOnboardingPrefs } from '../../lib/onboarding-store';
import { setSelectedCity } from '../../lib/trip-context-store';
import { logger } from '../../lib/logger';
import LoginScreen from '../login';
import { OnboardingBackground } from '../../components/onboarding/OnboardingBackground';
import { OnboardingValueScreen } from '../../components/onboarding/OnboardingValueScreen';
import { OnboardingCityScreen } from '../../components/onboarding/OnboardingCityScreen';
import { OnboardingTasteScreen } from '../../components/onboarding/OnboardingTasteScreen';
import { OnboardingPreviewScreen } from '../../components/onboarding/OnboardingPreviewScreen';
import { OnboardingPaywallStep } from '../../components/onboarding/OnboardingPaywallStep';

/**
 * First-run onboarding flow (W2 + W5). Five steps — value, city, tastes, value
 * preview, and the timeline paywall — rendered directly by the root entry gate
 * (no navigator mounted yet), as an internal step machine. "I already have an
 * account" swaps to an inline login that can be dismissed back to the flow
 * (fixes the W1 dead-end); a successful login flips `isAuthenticated`,
 * re-rendering the gate into the app.
 *
 * The preview "Create my plan" CTA advances to the paywall step (W5); the flow
 * completes from there — after a purchase/restore (`skippedPaywall:false`), on
 * "not now", or on a clean auto-skip when RevenueCat is not configured
 * (`skippedPaywall:true`). Completion lands the guest in the app (city already
 * written to the trip context for preselection).
 *
 * PRODUCT DECISION TO FLAG (does not block): a brand-new user who taps "I already
 * have an account" and then REGISTERS never sees these value screens — `login()`
 * marks `onboarding_completed`. The UX study wants onboarding for EVERYONE, so
 * this path skips the highest-leverage surface. Left for Pablo to decide whether
 * an up-front registrant should be routed through onboarding first.
 */

const STEP_NAMES: OnboardingStepName[] = ['value', 'city', 'interests', 'preview', 'paywall'];
const TOTAL_STEPS = STEP_NAMES.length;
// Index of the W5 paywall step (the last one), rendered full-screen outside the
// OnboardingBackground chrome since PaywallView carries its own layout.
const PAYWALL_STEP = STEP_NAMES.indexOf('paywall');

export default function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [selectedCity, setSelectedCityState] = useState<string | null>(null);

  // Fire `onboarding_started` once, on first mount.
  useEffect(() => {
    track({ event: 'onboarding_started' });
  }, []);

  // Fire `onboarding_step_viewed` only the FIRST time each step becomes visible.
  // Back-navigation (city → back → value → forward → city) must not re-emit views
  // for steps already seen, or the funnel view counts inflate. Toggling the inline
  // login does not change stepIndex, so returning from login never re-fires it.
  const seenSteps = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (seenSteps.current.has(stepIndex)) return;
    seenSteps.current.add(stepIndex);
    track({ event: 'onboarding_step_viewed', step: STEP_NAMES[stepIndex] });
  }, [stepIndex]);

  const goTo = (index: number) => setStepIndex(index);

  // The inline login publishes its internal back handler here (see `LoginScreen`
  // `onRegisterInnerBack`). Kept in a ref so the Android back closure always reads
  // the live sub-step handler without re-registering the BackHandler on it.
  const loginInnerBackRef = useRef<(() => boolean) | null>(null);
  const registerLoginInnerBack = useCallback((handler: (() => boolean) | null) => {
    loginInnerBackRef.current = handler;
  }, []);

  // Android hardware back: mirror the on-screen chevron so the OS back button is
  // never a dead-end on the platform that has one. The gate renders onboarding
  // OUTSIDE any navigator, so without this handler the physical back sends the app
  // to the background at every step (iOS has no hardware back, hence the guard).
  // Precedence matches `onBack`/`onClose`: when the inline login is up, first let
  // it consume its own sub-step (credentials → choose); only when it reports the
  // event unhandled (already on `choose`) do we dismiss the whole login. Else step
  // back one screen, else (step 0) let the OS default fire (exit). Returning `true`
  // consumes the event; `false` yields to the default.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onHardwareBack = (): boolean => {
      if (showLogin) {
        if (loginInnerBackRef.current?.()) return true;
        setShowLogin(false);
        return true;
      }
      if (stepIndex > 0) {
        goTo(stepIndex - 1);
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [showLogin, stepIndex]);

  const handleSelectCity = (cityName: string, covered: boolean) => {
    setSelectedCityState(cityName);
    // Mirror to the trip context (preselection for chat/wizard once in the app)
    // and to onboarding prefs (favouriteCity on the deferred profile sync).
    setSelectedCity(cityName).catch((err) => logger.warn('onboarding: setSelectedCity failed', err));
    setOnboardingPrefs({ city: cityName }).catch((err) =>
      logger.warn('onboarding: persist city pref failed', err),
    );
    track({ event: 'onboarding_city_selected', city: cityName, covered });
    if (covered) goTo(2);
  };

  // Notify-me for a city we do not cover yet. The grid only lists covered cities,
  // so this is the ONLY producer of `covered:false` — without it PostHog can never
  // measure demand for uncovered cities (a signal for expansion priority). No city
  // name is captured yet (there is no free-text input; QW4's waitlist endpoint will
  // add one), so `city` is empty for now — the count is the signal. Does not advance.
  const handleNotifyUncovered = () => {
    track({ event: 'onboarding_city_selected', city: '', covered: false });
  };

  const handleTasteContinue = (prefs: { interests: string[]; budget: string | null }) => {
    // Persist BOTH fields unconditionally. Writing `budget: null` (not omitting
    // it) is what lets a deselection stick: a falsy-guarded spread would drop the
    // null and leave a previously chosen tier in the store, which would then
    // re-seed a selected chip on the next remount and sync a phantom tier on login.
    setOnboardingPrefs({
      interests: prefs.interests,
      budget: prefs.budget,
    }).catch((err) => logger.warn('onboarding: persist taste prefs failed', err));
    goTo(3);
  };

  // Preview CTA now advances to the paywall step (W5) instead of completing; the
  // flow is finished by the paywall step's outcome via `completeFlow`.
  const goToPaywall = () => goTo(PAYWALL_STEP);

  // Terminal completion, invoked from the W5 paywall step: skip / auto-skip →
  // `skippedPaywall:true`, effective purchase/restore → false.
  const completeFlow = (skippedPaywall: boolean) => {
    track({ event: 'onboarding_completed', skippedPaywall });
    // Fire-and-forget: the entry gate flips to the app as soon as the in-memory
    // completion flag notifies subscribers.
    completeOnboarding().catch((err) => logger.warn('onboarding: completeOnboarding failed', err));
  };

  if (showLogin) {
    return (
      <LoginScreen
        onClose={() => setShowLogin(false)}
        onRegisterInnerBack={registerLoginInnerBack}
      />
    );
  }

  // W5 paywall step: full-screen (PaywallView owns its layout), OUTSIDE the
  // OnboardingBackground chrome. The step is never a dead-end — its close X and
  // the Android hardware back (via the orchestrator's handler above, step-1)
  // both retreat to the preview; "not now"/auto-skip and a purchase both
  // complete the flow.
  if (stepIndex === PAYWALL_STEP) {
    return (
      <OnboardingPaywallStep
        onBack={() => goTo(PAYWALL_STEP - 1)}
        onSkip={() => completeFlow(true)}
        onPurchased={() => completeFlow(false)}
      />
    );
  }

  return (
    <OnboardingBackground
      step={stepIndex}
      totalSteps={TOTAL_STEPS}
      onBack={stepIndex === 0 ? undefined : () => goTo(stepIndex - 1)}
    >
      {stepIndex === 0 && (
        <OnboardingValueScreen onStart={() => goTo(1)} onSignIn={() => setShowLogin(true)} />
      )}
      {stepIndex === 1 && (
        <OnboardingCityScreen
          onSelectCity={handleSelectCity}
          onNotifyUncovered={handleNotifyUncovered}
        />
      )}
      {stepIndex === 2 && (
        <OnboardingTasteScreen onContinue={handleTasteContinue} onSkip={() => goTo(3)} />
      )}
      {stepIndex === 3 && (
        <OnboardingPreviewScreen city={selectedCity} onCreatePlan={goToPaywall} />
      )}
    </OnboardingBackground>
  );
}
