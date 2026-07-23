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
import { useLocalSearchParams } from 'expo-router';
import {
  configurePurchases,
  getPlusOfferings,
  purchasePlusPackage,
  restorePlusPurchases,
  checkTrialEligibility,
} from '../../../lib/purchases';
import { useAuth } from '../../../lib/auth';
import { track } from '../../../lib/analytics';
import { syncTrialReminderAfterPurchase } from '../../../lib/trial-reminder';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
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
  checkTrialEligibility: jest.fn(),
}));
// Evita el wiring nativo (expo-notifications + init real de i18n) en jsdom.
jest.mock('../../../lib/trial-reminder', () => ({
  syncTrialReminderAfterPurchase: jest.fn().mockResolvedValue('scheduled'),
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
const mockCheckEligibility = checkTrialEligibility as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockSyncTrialReminder = syncTrialReminderAfterPurchase as jest.Mock;

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
    // Trial de 7 días del plan anual: intro price gratuito.
    introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: 'u1', tier: 'free' }, isPro: false, refreshUser });
  mockConfigure.mockResolvedValue(true);
  mockGetOfferings.mockResolvedValue({ packages: [MONTHLY, ANNUAL], error: null });
  // Por defecto el usuario ES elegible para el trial del anual (caso base del
  // paywall). Los tests que ejercen la NO elegibilidad lo sobrescriben.
  mockCheckEligibility.mockResolvedValue({ plus_annual: 'ELIGIBLE' });
});

it('sin API key configurada: estado no-disponible con retry, sin crash', async () => {
  mockConfigure.mockResolvedValue(false);
  render(<PaywallScreen />);

  expect(await screen.findByText('paywall.unavailableTitle')).toBeOnTheScreen();
  expect(screen.getByText('paywall.retry')).toBeOnTheScreen();
  expect(mockGetOfferings).not.toHaveBeenCalled();
});

// Contrato de identidad IAP: configure=false significa identidad RC no confirmada
// (p. ej. logIn fallido tras cambio de usuario). El paywall NUNCA debe llegar a
// ready en ese estado — comprar acreditaría Plus a la cuenta equivocada.
it('configure falla (identidad no confirmada): nunca llega a ready ni expone compra/restore', async () => {
  mockConfigure.mockResolvedValue(false);
  render(<PaywallScreen />);

  expect(await screen.findByText('paywall.unavailableTitle')).toBeOnTheScreen();
  expect(screen.queryByTestId('paywall-cta')).toBeNull();
  expect(screen.queryByTestId('paywall-restore')).toBeNull();
  expect(mockPurchase).not.toHaveBeenCalled();
  expect(mockRestore).not.toHaveBeenCalled();
});

it('retry desde no-disponible: si configure ya confirma la identidad, llega a ready', async () => {
  mockConfigure.mockResolvedValueOnce(false);
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByText('paywall.retry'));

  expect(await screen.findByTestId('paywall-cta')).toBeOnTheScreen();
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
    expect(mockPurchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: '$rc_annual' }), 'u1', refreshUser),
  );
});

// ─── Timeline-first: trial vertical Hoy→Día5→Día8, precio dominante ───

it('anual preseleccionado (trial real): pinta el timeline del trial', async () => {
  render(<PaywallScreen />);

  expect(await screen.findByTestId('paywall-trial-timeline')).toBeOnTheScreen();
  // La promesa del día 5 (recordatorio) y del día 8 (cobro) están presentes.
  expect(screen.getByText('paywall.timelineReminderTitle')).toBeOnTheScreen();
  expect(screen.getByText('paywall.timelineChargeTitle')).toBeOnTheScreen();
});

it('con el mensual seleccionado (sin trial) NO hay timeline: precio directo', async () => {
  render(<PaywallScreen />);

  // Arranca en anual → timeline visible.
  expect(await screen.findByTestId('paywall-trial-timeline')).toBeOnTheScreen();

  fireEvent.press(screen.getByTestId('paywall-pkg-$rc_monthly'));

  // El mensual no tiene introPrice gratuito → sin timeline, no se promete trial.
  expect(screen.queryByTestId('paywall-trial-timeline')).toBeNull();
});

// Producto anual SIN introPrice (offering sin trial configurado): aunque sea el
// preseleccionado, no se pinta timeline — refleja el PRODUCTO, no la promesa.
it('anual sin introPrice: no renderiza timeline (fallback a precio directo)', async () => {
  const annualNoTrial = { ...ANNUAL, product: { ...ANNUAL.product, introPrice: null } };
  mockGetOfferings.mockResolvedValue({ packages: [MONTHLY, annualNoTrial], error: null });
  render(<PaywallScreen />);

  await screen.findByTestId('paywall-cta');
  expect(screen.queryByTestId('paywall-trial-timeline')).toBeNull();
  // Sin producto con trial no se consulta la elegibilidad.
  expect(mockCheckEligibility).not.toHaveBeenCalled();
});

// ─── Elegibilidad REAL del trial (CRITICAL del review) ───
// El framing de trial (timeline + "N días gratis") NUNCA debe verse si el
// usuario no es elegible: Apple expone el introPrice a todos, pero cobra el
// día 0 a quien ya consumió su trial. Solo status 'ELIGIBLE' pinta el framing.

it('la elegibilidad se consulta SOLO por los productos con trial (introPrice gratuito)', async () => {
  render(<PaywallScreen />);
  await screen.findByTestId('paywall-trial-timeline');

  // Solo el anual tiene introPrice 0; el mensual (introPrice null) queda fuera.
  expect(mockCheckEligibility).toHaveBeenCalledTimes(1);
  expect(mockCheckEligibility).toHaveBeenCalledWith(['plus_annual']);
});

it('usuario elegible (ELIGIBLE): pinta el timeline y el badge de trial', async () => {
  render(<PaywallScreen />);

  expect(await screen.findByTestId('paywall-trial-timeline')).toBeOnTheScreen();
  expect(screen.getByText('paywall.trialFreeBadge')).toBeOnTheScreen();
});

it('usuario NO elegible (INELIGIBLE) con producto que SÍ ofrece trial: NO timeline, NO "gratis", precio directo', async () => {
  // Trial ya consumido: Apple cobraría el día 0. El producto sigue trayendo
  // introPrice gratuito, pero el usuario no puede canjearlo.
  mockCheckEligibility.mockResolvedValue({ plus_annual: 'INELIGIBLE' });
  render(<PaywallScreen />);

  // El precio del anual se muestra (paywall usable), pero SIN framing de trial.
  expect(await screen.findByText('39,99 €')).toBeOnTheScreen();
  await waitFor(() => expect(mockCheckEligibility).toHaveBeenCalled());

  expect(screen.queryByTestId('paywall-trial-timeline')).toBeNull();
  expect(screen.queryByText('paywall.trialFreeBadge')).toBeNull();
});

it('elegibilidad UNKNOWN: precio directo, sin timeline ni "gratis" (default seguro del SDK)', async () => {
  mockCheckEligibility.mockResolvedValue({ plus_annual: 'UNKNOWN' });
  render(<PaywallScreen />);

  expect(await screen.findByText('39,99 €')).toBeOnTheScreen();
  await waitFor(() => expect(mockCheckEligibility).toHaveBeenCalled());

  expect(screen.queryByTestId('paywall-trial-timeline')).toBeNull();
  expect(screen.queryByText('paywall.trialFreeBadge')).toBeNull();
});

// Ventana de carga: hasta que la consulta de elegibilidad resuelve, el paywall
// NO promete trial (mapa vacío ⇒ no elegible). Nunca hay un instante en que un
// no-elegible vea el framing.
it('mientras la elegibilidad no resuelve: precio directo sin framing (nunca un trial prematuro)', async () => {
  mockCheckEligibility.mockReturnValue(new Promise(() => {})); // nunca resuelve
  render(<PaywallScreen />);

  expect(await screen.findByText('39,99 €')).toBeOnTheScreen();
  expect(screen.queryByTestId('paywall-trial-timeline')).toBeNull();
  expect(screen.queryByText('paywall.trialFreeBadge')).toBeNull();
});

it('source onboarding: paywall_viewed lo lleva (nueva entrada del funnel)', async () => {
  const params = useLocalSearchParams as jest.Mock;
  // Persistente (no Once): el paywall re-renderiza durante el load y lee params
  // en cada render; se restaura al default al terminar para no filtrar a otros.
  params.mockReturnValue({ source: 'onboarding' });
  try {
    render(<PaywallScreen />);
    await screen.findByTestId('paywall-cta');

    const viewed = (track as jest.Mock).mock.calls
      .map(([p]) => p)
      .filter((p) => p.event === 'paywall_viewed');
    expect(viewed).toHaveLength(1);
    expect(viewed[0].source).toBe('onboarding');
  } finally {
    params.mockReturnValue({});
  }
});

it('compra ok: pasa refreshUser al módulo (flip de isPro sin reinicio) y muestra éxito', async () => {
  mockPurchase.mockResolvedValue({ status: 'success' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
  expect(mockPurchase).toHaveBeenCalledWith(expect.anything(), 'u1', refreshUser);
});

it('el usuario elige otro package y el CTA compra ese', async () => {
  mockPurchase.mockResolvedValue({ status: 'success' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-pkg-$rc_monthly'));
  fireEvent.press(screen.getByTestId('paywall-cta'));

  await waitFor(() =>
    expect(mockPurchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: '$rc_monthly' }), 'u1', refreshUser),
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

// ─── Trial reminder (día 5): enganche del outcome de compra ───

it('compra anual con trial REAL (entitlement TRIAL): sincroniza el recordatorio y muestra el contexto del aviso', async () => {
  mockPurchase.mockResolvedValue({ status: 'success', entitlementPeriodType: 'TRIAL' });
  render(<PaywallScreen />);

  // El anual (con trial) viene preseleccionado.
  fireEvent.press(await screen.findByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
  expect(screen.getByTestId('paywall-trial-notice')).toBeOnTheScreen();
  expect(mockSyncTrialReminder).toHaveBeenCalledTimes(1);
  expect(mockSyncTrialReminder).toHaveBeenCalledWith(
    expect.objectContaining({
      packageType: 'ANNUAL',
      entitlementPeriodType: 'TRIAL',
      outcomeStatus: 'success',
      purchasedAt: expect.any(Date),
    }),
  );
});

it('compra anual con trial pending_backend: también sincroniza el recordatorio', async () => {
  mockPurchase.mockResolvedValue({ status: 'pending_backend', entitlementPeriodType: 'TRIAL' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.pendingTitle')).toBeOnTheScreen();
  expect(screen.getByTestId('paywall-trial-notice')).toBeOnTheScreen();
  expect(mockSyncTrialReminder).toHaveBeenCalledWith(
    expect.objectContaining({ outcomeStatus: 'pending_backend', entitlementPeriodType: 'TRIAL' }),
  );
});

// Escenario del review (M2): el producto anual OFRECE trial (introPrice 0)
// pero este usuario ya consumió el suyo — Apple cobra YA y el entitlement
// llega como NORMAL. Prometerle un aviso de fin de trial sería mentira.
it('compra anual con trial ya consumido (entitlement NORMAL): sin aviso en pantalla y el sync recibe NORMAL (cancela, no programa)', async () => {
  mockPurchase.mockResolvedValue({ status: 'success', entitlementPeriodType: 'NORMAL' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
  expect(screen.queryByTestId('paywall-trial-notice')).toBeNull();
  expect(mockSyncTrialReminder).toHaveBeenCalledWith(
    expect.objectContaining({ packageType: 'ANNUAL', entitlementPeriodType: 'NORMAL' }),
  );
});

// MINOR-1 del review: una compra efectiva SIN trial (cambio de plan durante
// el trial) también pasa por el sync — el módulo cancela el aviso obsoleto.
it('compra mensual efectiva: sin aviso en pantalla y el sync recibe la compra para cancelar pendientes', async () => {
  mockPurchase.mockResolvedValue({ status: 'success', entitlementPeriodType: 'NORMAL' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-pkg-$rc_monthly'));
  fireEvent.press(screen.getByTestId('paywall-cta'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
  expect(screen.queryByTestId('paywall-trial-notice')).toBeNull();
  expect(mockSyncTrialReminder).toHaveBeenCalledTimes(1);
  expect(mockSyncTrialReminder).toHaveBeenCalledWith(
    expect.objectContaining({ packageType: 'MONTHLY', entitlementPeriodType: 'NORMAL' }),
  );
});

it('compra cancelada: no toca el recordatorio', async () => {
  mockPurchase.mockResolvedValue({ status: 'cancelled' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  await waitFor(() => expect(mockPurchase).toHaveBeenCalled());

  expect(mockSyncTrialReminder).not.toHaveBeenCalled();
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

// Contrato de recuperación de identity_mismatch: la identidad RC quedó
// invalidada (divergencia/carrera) y un re-load re-configura con logIn fresco.
// Antes el modal genérico dejaba la fase en 'ready' y re-pulsar repetía el
// mismatch hasta salir de la pantalla.
it('identity_mismatch en compra: re-load (re-configure + refetch) en vez de modal terminal', async () => {
  mockPurchase.mockResolvedValue({ status: 'error', message: 'identity_mismatch' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));

  // load inicial + re-load de recuperación.
  await waitFor(() => expect(mockConfigure).toHaveBeenCalledTimes(2));
  expect(await screen.findByTestId('paywall-cta')).toBeOnTheScreen(); // vuelve a ready
  expect(screen.queryByText('paywall.errorTitle')).toBeNull();        // sin modal genérico
});

it('identity_mismatch en restore: misma recuperación vía re-load', async () => {
  mockRestore.mockResolvedValue({ status: 'error', message: 'identity_mismatch' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-restore'));

  await waitFor(() => expect(mockConfigure).toHaveBeenCalledTimes(2));
  expect(await screen.findByTestId('paywall-cta')).toBeOnTheScreen();
  expect(screen.queryByText('paywall.errorTitle')).toBeNull();
});

it('identity_mismatch con identidad irrecuperable: el re-load degrada a no-disponible (no vende)', async () => {
  mockPurchase.mockResolvedValue({ status: 'error', message: 'identity_mismatch' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  // El re-configure del re-load tampoco confirma la identidad.
  mockConfigure.mockResolvedValue(false);

  expect(await screen.findByText('paywall.unavailableTitle')).toBeOnTheScreen();
  expect(screen.queryByTestId('paywall-cta')).toBeNull();
});

it('restore sin compras previas: aviso nada-que-restaurar', async () => {
  mockRestore.mockResolvedValue({ status: 'no_entitlement' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-restore'));

  expect(await screen.findByText('paywall.restoreNoneTitle')).toBeOnTheScreen();
  expect(mockRestore).toHaveBeenCalledWith('u1', refreshUser);
});

it('restore con entitlement: muestra éxito', async () => {
  mockRestore.mockResolvedValue({ status: 'success' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-restore'));

  expect(await screen.findByText('paywall.successTitle')).toBeOnTheScreen();
});

// ─── Analytics de monetización (paywall_viewed / dismissed / purchase props) ──

const mockTrack = track as jest.Mock;
const eventsOf = (name: string) =>
  mockTrack.mock.calls.map(([p]) => p).filter((p) => p.event === name);

it('paywall_viewed se emite UNA vez cuando los precios renderizan, con offeringId y source', async () => {
  render(<PaywallScreen />);
  await screen.findByTestId('paywall-cta');

  const viewed = eventsOf('paywall_viewed');
  expect(viewed).toHaveLength(1);
  expect(viewed[0]).toEqual({ event: 'paywall_viewed', source: 'account_upsell', offeringId: 'default' });
});

it('paywall no disponible: NO emite paywall_viewed (el denominador es "precios mostrados")', async () => {
  mockConfigure.mockResolvedValue(false);
  render(<PaywallScreen />);
  await screen.findByText('paywall.unavailableTitle');

  expect(eventsOf('paywall_viewed')).toHaveLength(0);
  expect(eventsOf('paywall_unavailable')).toHaveLength(1);
});

it('retry que triunfa tras un fallo: paywall_viewed se emite entonces (anclado al éxito), una sola vez', async () => {
  mockConfigure.mockResolvedValueOnce(false);
  render(<PaywallScreen />);

  await screen.findByText('paywall.unavailableTitle');
  expect(eventsOf('paywall_viewed')).toHaveLength(0);

  fireEvent.press(screen.getByText('paywall.retry'));
  await screen.findByTestId('paywall-cta');

  const viewed = eventsOf('paywall_viewed');
  expect(viewed).toHaveLength(1);
  expect(viewed[0].offeringId).toBe('default');
});

it('cierre con precios visibles: paywall_dismissed con phase shown y msOnScreen numérico', async () => {
  const { unmount } = render(<PaywallScreen />);
  await screen.findByTestId('paywall-cta');

  unmount();

  const dismissed = eventsOf('paywall_dismissed');
  expect(dismissed).toHaveLength(1);
  expect(dismissed[0].source).toBe('account_upsell');
  expect(dismissed[0].phase).toBe('shown');
  expect(typeof dismissed[0].msOnScreen).toBe('number');
  expect(dismissed[0].msOnScreen).toBeGreaterThanOrEqual(0);
});

// Caso del review adversarial: cerrar DURANTE el load no debe fabricar un
// "viewed" que nunca ocurrió — sale un dismissed con phase loading sin pareja.
it('cierre durante el load (configure en vuelo): dismissed con phase loading y CERO paywall_viewed', async () => {
  mockConfigure.mockReturnValue(new Promise(() => {})); // nunca resuelve
  const { unmount } = render(<PaywallScreen />);

  unmount();

  expect(eventsOf('paywall_viewed')).toHaveLength(0);
  const dismissed = eventsOf('paywall_dismissed');
  expect(dismissed).toHaveLength(1);
  expect(dismissed[0].phase).toBe('loading');
});

// Caso ADV2 del re-check: unmount durante el load y el load resuelve CON ÉXITO
// después — sin guard de montaje salía un viewed fantasma tras el dismissed,
// con precios que nunca renderizaron.
it('load que resuelve con éxito tras el unmount: CERO paywall_viewed (sin viewed fantasma post-dismiss)', async () => {
  let resolveConfigure!: (v: boolean) => void;
  mockConfigure.mockReturnValue(new Promise<boolean>((r) => { resolveConfigure = r; }));
  const { unmount } = render(<PaywallScreen />);

  unmount();
  resolveConfigure(true); // el load sigue en background y llega a offerings OK
  await waitFor(() => expect(mockGetOfferings).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 0)); // drena la continuación del load

  expect(eventsOf('paywall_viewed')).toHaveLength(0);
  const dismissed = eventsOf('paywall_dismissed');
  expect(dismissed).toHaveLength(1);
  expect(dismissed[0].phase).toBe('loading');
});

it('cierre desde el estado no-disponible: dismissed con phase unavailable y sin viewed', async () => {
  mockGetOfferings.mockResolvedValue({ packages: [], error: 'no_offerings' });
  const { unmount } = render(<PaywallScreen />);
  await screen.findByText('paywall.unavailableTitle');

  unmount();

  expect(eventsOf('paywall_viewed')).toHaveLength(0);
  const dismissed = eventsOf('paywall_dismissed');
  expect(dismissed).toHaveLength(1);
  expect(dismissed[0].phase).toBe('unavailable');
});

it('compra completada: NO se emite paywall_dismissed al cerrar', async () => {
  mockPurchase.mockResolvedValue({ status: 'success' });
  const { unmount } = render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-cta'));
  await screen.findByText('paywall.successTitle');
  unmount();

  expect(eventsOf('paywall_dismissed')).toHaveLength(0);
});

it('purchase_started/completed llevan las props de precio del package (anual con trial)', async () => {
  mockPurchase.mockResolvedValue({ status: 'success' });
  render(<PaywallScreen />);

  // Preselección anual (mejor precio) → las props salen del product del anual.
  fireEvent.press(await screen.findByTestId('paywall-cta'));
  await screen.findByText('paywall.successTitle');

  const expected = {
    productId: 'plus_annual',
    priceString: '39,99 €',
    price: 39.99,
    currency: 'EUR',
    period: 'annual',
    hasTrial: true,
  };
  expect(eventsOf('purchase_started')[0]).toEqual({ event: 'purchase_started', ...expected });
  expect(eventsOf('purchase_completed')[0]).toEqual({
    event: 'purchase_completed',
    pendingBackend: false,
    ...expected,
  });
});

it('cancelación: purchase_cancelled con props del package mensual (sin trial)', async () => {
  mockPurchase.mockResolvedValue({ status: 'cancelled' });
  render(<PaywallScreen />);

  fireEvent.press(await screen.findByTestId('paywall-pkg-$rc_monthly'));
  fireEvent.press(screen.getByTestId('paywall-cta'));
  await waitFor(() => expect(mockPurchase).toHaveBeenCalled());

  const cancelled = eventsOf('purchase_cancelled');
  expect(cancelled[0]).toEqual({
    event: 'purchase_cancelled',
    productId: 'plus_monthly',
    priceString: '4,99 €',
    price: 4.99,
    currency: 'EUR',
    period: 'monthly',
    hasTrial: false,
  });
});
