/**
 * W5 paywall step (`components/onboarding/OnboardingPaywallStep.tsx`): the
 * timeline paywall reused as the final onboarding step. `lib/purchases` mocked.
 *
 * Focus (the review's two invariants):
 *  - Nobody is trapped without RevenueCat: a not-configured / no-offerings paywall
 *    AUTO-SKIPS (equivalent to "not now") instead of showing a broken retry state.
 *  - No trial framing to non-eligibles: reuses PaywallView's `effectiveEligibility`
 *    gating, so an INELIGIBLE user sees the price, never the timeline/"free" badge.
 *
 * Plus the exit wiring: "not now" → onSkip, purchase → onPurchased, close → onBack.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { OnboardingPaywallStep } from '../OnboardingPaywallStep';
import {
  configurePurchases,
  getPlusOfferings,
  purchasePlusPackage,
  restorePlusPurchases,
  checkTrialEligibility,
} from '../../../lib/purchases';
import { useAuth } from '../../../lib/auth';
import { track } from '../../../lib/analytics';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/purchases', () => ({
  configurePurchases: jest.fn(),
  getPlusOfferings: jest.fn(),
  purchasePlusPackage: jest.fn(),
  restorePlusPurchases: jest.fn(),
  checkTrialEligibility: jest.fn(),
}));
jest.mock('../../../lib/trial-reminder', () => ({
  syncTrialReminderAfterPurchase: jest.fn().mockResolvedValue('scheduled'),
}));
jest.mock('../../../components/ui/ConfirmModal', () => ({ ConfirmModal: () => null }));

const mockConfigure = configurePurchases as jest.Mock;
const mockGetOfferings = getPlusOfferings as jest.Mock;
const mockPurchase = purchasePlusPackage as jest.Mock;
const mockRestore = restorePlusPurchases as jest.Mock;
const mockCheckEligibility = checkTrialEligibility as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockTrack = track as jest.Mock;

const refreshUser = jest.fn().mockResolvedValue('pro');

const MONTHLY = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  presentedOfferingContext: { offeringIdentifier: 'default' },
  product: {
    identifier: 'plus_monthly',
    title: 'Plus Monthly',
    priceString: '4,99 €',
    price: 4.99,
    currencyCode: 'EUR',
    introPrice: null,
  },
};
const ANNUAL = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  presentedOfferingContext: { offeringIdentifier: 'default' },
  product: {
    identifier: 'plus_annual',
    title: 'Plus Annual',
    priceString: '39,99 €',
    price: 39.99,
    currencyCode: 'EUR',
    introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' },
  },
};

let onBack: jest.Mock;
let onSkip: jest.Mock;
let onPurchased: jest.Mock;

const renderStep = () => {
  onBack = jest.fn();
  onSkip = jest.fn();
  onPurchased = jest.fn();
  return render(
    <OnboardingPaywallStep onBack={onBack} onSkip={onSkip} onPurchased={onPurchased} />,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'u1', tier: 'free' }, isPro: false, refreshUser });
  mockConfigure.mockResolvedValue(true);
  mockGetOfferings.mockResolvedValue({ packages: [MONTHLY, ANNUAL], error: null });
  mockCheckEligibility.mockResolvedValue({ plus_annual: 'ELIGIBLE' });
});

// ─── Degradación: nadie queda atrapado sin RevenueCat ───

it('RC no configurado: auto-salta (onSkip) sin mostrar el estado no-disponible ni atrapar', async () => {
  mockConfigure.mockResolvedValue(false);
  renderStep();

  await waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1));
  // Ni retry ni "no disponible": el paso se salta limpio, sin pantalla rota.
  expect(screen.queryByText('paywall.unavailableTitle')).toBeNull();
  expect(screen.queryByText('paywall.retry')).toBeNull();
  // Auto-salto NO es conversión: no completa como compra.
  expect(onPurchased).not.toHaveBeenCalled();
});

it('sin ofertas (productos ASC no creados): auto-salta igual (onSkip), sin atrapar', async () => {
  mockGetOfferings.mockResolvedValue({ packages: [], error: 'no_offerings' });
  renderStep();

  await waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('paywall.unavailableTitle')).toBeNull();
  expect(onPurchased).not.toHaveBeenCalled();
});

// MINOR-1: una promesa nativa de RC que jamás settle (configure colgado) dejaría
// el `load()` en `loading` para siempre. En el gate BLOQUEANTE del onboarding eso
// atrapa al usuario en un spinner infinito (única salida: X→preview→reintentar).
// Tras el timeout de la fase loading se trata como no disponible y se auto-salta.
it('load que nunca resuelve (configure colgado): tras el timeout auto-salta (onSkip), usuario no atrapado', async () => {
  jest.useFakeTimers();
  try {
    mockConfigure.mockReturnValue(new Promise(() => {})); // jamás settle
    renderStep();

    // Sigue en loading: aún sin auto-salto (el timeout no ha vencido).
    expect(onSkip).not.toHaveBeenCalled();

    // Vence el timeout de la fase loading → auto-salto limpio.
    act(() => {
      jest.advanceTimersByTime(9000);
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    // El auto-salto por timeout NO es conversión: no completa como compra.
    expect(onPurchased).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

// ─── Compliance: no trial framing a no-elegibles ───

it('usuario NO elegible (INELIGIBLE): pinta el precio pero NO el timeline ni el badge de trial', async () => {
  mockCheckEligibility.mockResolvedValue({ plus_annual: 'INELIGIBLE' });
  renderStep();

  expect(await screen.findByText('39,99 €')).toBeOnTheScreen();
  await waitFor(() => expect(mockCheckEligibility).toHaveBeenCalled());
  expect(screen.queryByTestId('paywall-trial-timeline')).toBeNull();
  expect(screen.queryByText('paywall.trialFreeBadge')).toBeNull();
});

it('usuario elegible (ELIGIBLE): sí pinta el timeline del trial (no oculta de más)', async () => {
  renderStep();
  expect(await screen.findByTestId('paywall-trial-timeline')).toBeOnTheScreen();
});

// ─── Salidas del paso ───

it('paywall_viewed sale con source onboarding (entrada del funnel)', async () => {
  renderStep();
  await screen.findByTestId('paywall-cta');

  const viewed = mockTrack.mock.calls.map(([p]) => p).filter((p) => p.event === 'paywall_viewed');
  expect(viewed).toHaveLength(1);
  expect(viewed[0].source).toBe('onboarding');
});

it('"Ahora no" (skip): llama onSkip y no completa como compra', async () => {
  renderStep();
  fireEvent.press(await screen.findByTestId('paywall-skip'));

  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onPurchased).not.toHaveBeenCalled();
  expect(onBack).not.toHaveBeenCalled();
});

it('compra efectiva → éxito → "Listo" llama onPurchased (skippedPaywall:false lo pone el orquestador)', async () => {
  mockPurchase.mockResolvedValue({ status: 'success', entitlementPeriodType: 'TRIAL' });
  renderStep();

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  fireEvent.press(await screen.findByTestId('paywall-done'));

  expect(onPurchased).toHaveBeenCalledTimes(1);
  expect(onSkip).not.toHaveBeenCalled();
});

it('restore con entitlement → éxito → "Listo" llama onPurchased', async () => {
  mockRestore.mockResolvedValue({ status: 'success' });
  renderStep();

  fireEvent.press(await screen.findByTestId('paywall-restore'));
  fireEvent.press(await screen.findByTestId('paywall-done'));

  expect(onPurchased).toHaveBeenCalledTimes(1);
});

it('la X (close) retrocede: llama onBack, no completa el flujo', async () => {
  renderStep();
  await screen.findByTestId('paywall-cta');

  fireEvent.press(screen.getByTestId('paywall-close'));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onSkip).not.toHaveBeenCalled();
  expect(onPurchased).not.toHaveBeenCalled();
});

// MINOR-3: en las fases de outcome la X NO retrocede — completa el flujo (un
// pagador nunca queda varado atrás en vez de completar). `closeAction` cablea la
// X a `done`/`onPurchased` en success/pending, no a `onBack`.
it('la X en fase success invoca onPurchased (completar), no onBack', async () => {
  mockPurchase.mockResolvedValue({ status: 'success', entitlementPeriodType: 'TRIAL' });
  renderStep();

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  await screen.findByTestId('paywall-done'); // ya en fase success

  fireEvent.press(screen.getByTestId('paywall-close'));
  expect(onPurchased).toHaveBeenCalledTimes(1);
  expect(onBack).not.toHaveBeenCalled();
  expect(onSkip).not.toHaveBeenCalled();
});

it('la X en fase pending invoca onPurchased (completar), no onBack', async () => {
  mockPurchase.mockResolvedValue({ status: 'pending_backend' });
  renderStep();

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  await screen.findByTestId('paywall-pending-retry'); // ya en fase pending

  fireEvent.press(screen.getByTestId('paywall-close'));
  expect(onPurchased).toHaveBeenCalledTimes(1);
  expect(onBack).not.toHaveBeenCalled();
  expect(onSkip).not.toHaveBeenCalled();
});
