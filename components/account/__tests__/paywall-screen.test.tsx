/**
 * Tests de comportamiento del paywall (`app/paywall.tsx`), lib/purchases mockeado.
 *
 * Cubre:
 *  - Degradación sin API key / sin productos: estado "no disponible" con
 *    retry, sin crash (los productos de ASC aún no existen).
 *  - Offering cargado: pinta packages con precio localizado y el CTA compra
 *    el package seleccionado pasando refreshUser (flip de isPro sin reinicio).
 *  - Cancelación del usuario: se queda en el paywall sin modal de error.
 *  - pending_backend: estado "compra recibida" (entitlement activo, tier aún no).
 *  - Restore sin compras: aviso "nada que restaurar".
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PaywallScreen from '../../../app/paywall';
import {
  configurePurchases,
  getPlusOfferings,
  purchasePlusPackage,
  restorePlusPurchases,
} from '../../../lib/purchases';
import { useAuth } from '../../../lib/auth';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});
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
}));
// Stub que expone title/body cuando está visible, para asertar los modales.
jest.mock('../../../components/ui/ConfirmModal', () => {
  const ReactActual = jest.requireActual('react');
  const { View, Text } = jest.requireActual('react-native');
  return {
    ConfirmModal: ({ visible, title, body }: { visible: boolean; title: string; body: string }) =>
      visible
        ? ReactActual.createElement(View, null,
            ReactActual.createElement(Text, null, title),
            ReactActual.createElement(Text, null, body))
        : null,
  };
});

const mockConfigure = configurePurchases as jest.Mock;
const mockGetOfferings = getPlusOfferings as jest.Mock;
const mockPurchase = purchasePlusPackage as jest.Mock;
const mockRestore = restorePlusPurchases as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const refreshUser = jest.fn().mockResolvedValue('pro');

const MONTHLY = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  product: { identifier: 'plus_monthly', title: 'Plus Monthly', priceString: '4,99 €' },
};
const ANNUAL = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  product: { identifier: 'plus_annual', title: 'Plus Annual', priceString: '39,99 €' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'u1', tier: 'free' }, isPro: false, refreshUser });
  mockConfigure.mockResolvedValue(true);
  mockGetOfferings.mockResolvedValue({ packages: [MONTHLY, ANNUAL], error: null });
});

it('sin API key configurada: estado no-disponible con retry, sin crash', async () => {
  mockConfigure.mockResolvedValue(false);
  render(<PaywallScreen />);

  expect(await screen.findByText('paywall.unavailableTitle')).toBeOnTheScreen();
  expect(screen.getByText('paywall.retry')).toBeOnTheScreen();
  expect(mockGetOfferings).not.toHaveBeenCalled();
});

it('offering sin packages (productos ASC no creados): degrada a no-disponible', async () => {
  mockGetOfferings.mockResolvedValue({ packages: [], error: 'no_offerings' });
  render(<PaywallScreen />);

  expect(await screen.findByText('paywall.unavailableTitle')).toBeOnTheScreen();
});

it('pinta los packages con precio localizado y preselecciona el anual', async () => {
  mockPurchase.mockResolvedValue({ status: 'cancelled' });
  render(<PaywallScreen />);

  expect(await screen.findByText('4,99 €')).toBeOnTheScreen();
  expect(screen.getByText('39,99 €')).toBeOnTheScreen();
  expect(screen.getByText('paywall.bestValue')).toBeOnTheScreen();

  fireEvent.press(screen.getByTestId('paywall-cta'));
  await waitFor(() =>
    expect(mockPurchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: '$rc_annual' }), refreshUser),
  );
});

it('compra ok: pasa refreshUser al módulo (flip de isPro sin reinicio) y muestra éxito', async () => {
  mockPurchase.mockResolvedValue({ status: 'success' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
  expect(mockPurchase).toHaveBeenCalledWith(expect.anything(), refreshUser);
});

it('el usuario elige otro package y el CTA compra ese', async () => {
  mockPurchase.mockResolvedValue({ status: 'success' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-pkg-$rc_monthly'));
  fireEvent.press(screen.getByTestId('paywall-cta'));

  await waitFor(() =>
    expect(mockPurchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: '$rc_monthly' }), refreshUser),
  );
});

it('cancelación del usuario: se queda en el paywall, sin modal de error', async () => {
  mockPurchase.mockResolvedValue({ status: 'cancelled' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  await waitFor(() => expect(mockPurchase).toHaveBeenCalled());

  expect(screen.getByTestId('paywall-cta')).toBeOnTheScreen();
  expect(screen.queryByText('paywall.errorTitle')).toBeNull();
});

it('entitlement activo pero tier sin flipear (pending_backend): estado compra recibida', async () => {
  mockPurchase.mockResolvedValue({ status: 'pending_backend' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.pendingTitle')).toBeOnTheScreen();
});

it('pending: si isPro flipa en caliente (reconciliación app-level), avanza a éxito solo', async () => {
  mockPurchase.mockResolvedValue({ status: 'pending_backend' });
  const { rerender } = render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  expect(await screen.findByText('paywall.pendingTitle')).toBeOnTheScreen();

  // El listener a nivel de app refrescó /account al llegar el webhook: tier → pro.
  mockUseAuth.mockReturnValue({ user: { id: 'u1', tier: 'pro' }, isPro: true, refreshUser });
  rerender(<PaywallScreen />);

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
});

it('pending: "comprobar de nuevo" reconsulta el backend y muestra éxito si ya es pro', async () => {
  mockPurchase.mockResolvedValue({ status: 'pending_backend' });
  refreshUser.mockResolvedValue('pro');
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  fireEvent.press(await screen.findByTestId('paywall-pending-retry'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
});

it('fallo de compra: modal de error y el paywall sigue usable', async () => {
  mockPurchase.mockResolvedValue({ status: 'error', message: 'boom' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.errorTitle')).toBeOnTheScreen();
  expect(screen.getByTestId('paywall-cta')).toBeOnTheScreen();
});

it('restore sin compras previas: aviso nada-que-restaurar', async () => {
  mockRestore.mockResolvedValue({ status: 'no_entitlement' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-restore'));

  expect(await screen.findByText('paywall.restoreNoneTitle')).toBeOnTheScreen();
  expect(mockRestore).toHaveBeenCalledWith(refreshUser);
});

it('restore con entitlement: muestra éxito', async () => {
  mockRestore.mockResolvedValue({ status: 'success' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-restore'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
});
