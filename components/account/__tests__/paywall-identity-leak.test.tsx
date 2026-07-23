/**
 * Leak SUB-FRAME del framing de trial al cambiar de identidad (MAJOR, ronda 3).
 *
 * El paywall NO se desmonta ante un cambio de `useAuth` (ver
 * `paywall-screen.test.tsx`): React re-renderiza el consumidor con el nuevo
 * `user` mientras `phase`, `packages` y `trialEligibility` siguen siendo del
 * usuario ANTERIOR (los resets de `load()`/effects son passive effects que
 * corren DESPUÉS de ese commit). El commit intermedio se PINTA: un no-elegible
 * (u2, que ya consumió su trial ⇒ Apple cobra el día 0) vería "N días gratis"
 * durante 1 frame — el trial engañoso de Apple 3.1.2 que la feature defiende.
 *
 * Inspeccionar el DOM asentado tras `act` NO detecta esto: el commit intermedio
 * se colapsa. Este test mockea `TrialTimeline` (el render del framing) para
 * REGISTRAR el `user` vigente en CADA render, y verifica que NINGÚN render con
 * `user=u2` pinta el framing. Con el bug, la secuencia registra un render "u2"
 * con timeline; con el fix (reset SÍNCRONO en render, gateado por `user.id`), no.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import PaywallScreen from '../../../app/paywall';
import {
  configurePurchases,
  getPlusOfferings,
  checkTrialEligibility,
} from '../../../lib/purchases';
import { useAuth } from '../../../lib/auth';

// `user.id` vigente en el render en curso: lo estampa el mock de useAuth (llamado
// al inicio de cada render de PaywallScreen) y lo LEE el mock de TrialTimeline
// (hijo, renderizado después) para atribuir cada paint del framing a su usuario.
let mockCurrentUserId: string | undefined;
// Secuencia de `user.id` que VIERON el framing de trial (timeline pintado).
const mockFramingRenders: (string | undefined)[] = [];

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
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
// El render del framing de trial: cada montaje/render registra el usuario vigente
// del render en curso. Un render de un no-elegible que llegue aquí ES el leak.
jest.mock('../../../components/paywall/TrialTimeline', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    TrialTimeline: () => {
      mockFramingRenders.push(mockCurrentUserId);
      return ReactActual.createElement(View, { testID: 'paywall-trial-timeline' });
    },
  };
});

const mockConfigure = configurePurchases as jest.Mock;
const mockGetOfferings = getPlusOfferings as jest.Mock;
const mockCheckEligibility = checkTrialEligibility as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

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

// Fresca cada vez (como devuelve RevenueCat en la práctica): array con nueva
// referencia ⇒ re-dispara el effect de elegibilidad tras el cambio de identidad.
const freshOfferings = () => ({ packages: [{ ...MONTHLY }, { ...ANNUAL }], error: null });

// Instala una identidad y estampa su id para que el mock del framing lo atribuya.
function setAuth(userId: string) {
  const value = { user: { id: userId, tier: 'free' }, isPro: false, refreshUser };
  mockUseAuth.mockImplementation(() => {
    mockCurrentUserId = value.user.id;
    return value;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFramingRenders.length = 0;
  mockCurrentUserId = undefined;
  setAuth('u1');
  mockConfigure.mockResolvedValue(true);
  mockGetOfferings.mockResolvedValue(freshOfferings());
  mockCheckEligibility.mockResolvedValue({ plus_annual: 'ELIGIBLE' });
});

it('u1 ELIGIBLE → u2 INELIGIBLE con el paywall montado: NINGÚN render intermedio pinta el framing a u2', async () => {
  const { rerender } = render(<PaywallScreen />);
  // u1 elegible ve el framing (sanity: el mock registra su render).
  await screen.findByTestId('paywall-trial-timeline');
  expect(mockFramingRenders).toContain('u1');

  // La consulta de u2 queda EN VUELO para observar la ventana entre "packages de
  // u2 en pantalla" y "elegibilidad de u2 resuelta" — pero el leak que buscamos
  // es ANTERIOR: el commit del propio cambio de identidad, con el mapa de u1 aún.
  mockCheckEligibility.mockReturnValueOnce(new Promise(() => {}));
  mockGetOfferings.mockResolvedValue(freshOfferings());
  setAuth('u2');
  rerender(<PaywallScreen />);

  // Deja que load()/effects de u2 corran (recarga offerings + re-query).
  await waitFor(() => expect(mockCheckEligibility).toHaveBeenCalledTimes(2));

  // El invariante: en NINGÚN render (ni el commit intermedio colapsado en el DOM)
  // el framing de trial se pintó con u2 vigente.
  expect(mockFramingRenders).not.toContain('u2');
});

it('u1 ELIGIBLE → u2 ELIGIBLE: el fix NO oculta de más — u2 vuelve a ver el framing al resolver su elegibilidad', async () => {
  const { rerender } = render(<PaywallScreen />);
  await screen.findByTestId('paywall-trial-timeline');

  // u2 también es elegible; su consulta resuelve ELIGIBLE.
  mockCheckEligibility.mockResolvedValue({ plus_annual: 'ELIGIBLE' });
  mockGetOfferings.mockResolvedValue(freshOfferings());
  setAuth('u2');
  rerender(<PaywallScreen />);

  // Tras resolver la elegibilidad de u2 (tag = u2 = user actual), el framing
  // vuelve legítimamente: el gating sub-frame no lo bloquea de forma permanente.
  await waitFor(() => expect(mockFramingRenders).toContain('u2'));
  expect(screen.getByTestId('paywall-trial-timeline')).toBeOnTheScreen();
});
