/**
 * Contrato de resiliencia de usePurchaseReconciliation bajo carreras.
 *
 * Origen: pase adversarial ciego 2026-07-22. Afirma:
 *  - Un configure fallido al montar (blip transitorio) NO pierde el listener de
 *    reconciliación para toda la sesión: la vuelta a foreground re-configura y
 *    re-adjunta.
 *  - El listener no se duplica cuando mount y foreground configuran bien.
 *  - Un handler de foreground obsoleto (capturado antes de un logout ya
 *    efectivo) no re-configura: jamás re-adopta la identidad RC desvinculada.
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { usePurchaseReconciliation } from '../usePurchaseReconciliation';
import { configurePurchases, addPlusActivationListener } from '../purchases';
import { useAuth } from '../auth';

jest.mock('../purchases', () => ({
  configurePurchases: jest.fn(),
  addPlusActivationListener: jest.fn(),
}));
jest.mock('../auth', () => ({ useAuth: jest.fn() }));

const mockConfigure = configurePurchases as jest.Mock;
const mockAddListener = addPlusActivationListener as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const refreshUser = jest.fn().mockResolvedValue('pro');

function Harness() {
  usePurchaseReconciliation();
  return null;
}

let addSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  refreshUser.mockResolvedValue('pro');
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, refreshUser, isAuthenticated: true });
  mockAddListener.mockReturnValue(() => {});
  mockConfigure.mockResolvedValue(true);
  addSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);
});

afterEach(() => {
  addSpy.mockRestore();
});

function foregroundHandler(): (s: AppStateStatus) => void {
  return addSpy.mock.calls[0][1] as (s: AppStateStatus) => void;
}

it('CONTRATO: configure=false al montar, el foreground re-configura Y re-adjunta el listener', async () => {
  mockConfigure.mockResolvedValueOnce(false); // blip al montar (o carrera de logIn)
  mockConfigure.mockResolvedValue(true);      // los siguientes configure funcionan

  render(<Harness />);
  await waitFor(() => expect(mockConfigure).toHaveBeenCalledTimes(1));
  expect(mockAddListener).not.toHaveBeenCalled(); // identidad no confirmada: sin listener aún

  // Vuelta a foreground: configure ahora confirma la identidad...
  foregroundHandler()('active');
  await waitFor(() => expect(mockConfigure).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(refreshUser).toHaveBeenCalled());

  // ...y el listener de reconciliación en caliente queda registrado: el flip
  // por webhook retrasado llega aunque el configure del montaje fallara.
  expect(mockAddListener).toHaveBeenCalledTimes(1);
});

it('CONTRATO: mount y foreground con configure ok no duplican el listener', async () => {
  render(<Harness />);
  await waitFor(() => expect(mockAddListener).toHaveBeenCalledTimes(1));

  foregroundHandler()('active');
  await waitFor(() => expect(refreshUser).toHaveBeenCalled());

  expect(mockAddListener).toHaveBeenCalledTimes(1); // sin re-attach redundante
});

it('CONTRATO: un handler de foreground obsoleto (logout ya efectivo) no re-configura la identidad desvinculada', async () => {
  const { rerender } = render(<Harness />);
  await waitFor(() => expect(mockConfigure).toHaveBeenCalledTimes(1));
  const staleHandler = foregroundHandler(); // capturado con sesión u1 viva

  // Logout: la sesión muere (lib/auth ya desvinculó RC vía logOutPurchases).
  mockUseAuth.mockReturnValue({ user: null, refreshUser, isAuthenticated: false });
  rerender(<Harness />);

  mockConfigure.mockClear();
  refreshUser.mockClear();
  staleHandler('active'); // el evento llegó con el handler viejo aún vivo

  // Sin sesión no se re-configura (re-adoptaría el uid deslogueado) ni se refresca.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockConfigure).not.toHaveBeenCalled();
  expect(refreshUser).not.toHaveBeenCalled();
});

it('CONTRATO: handler obsoleto de un usuario anterior no re-configura tras cambiar de cuenta', async () => {
  const { rerender } = render(<Harness />);
  await waitFor(() => expect(mockConfigure).toHaveBeenCalledWith('u1'));
  const staleHandler = foregroundHandler(); // capturado para u1

  // Cambio de cuenta: ahora la sesión es u2 (el efecto re-corre para u2).
  mockUseAuth.mockReturnValue({ user: { id: 'u2' }, refreshUser, isAuthenticated: true });
  rerender(<Harness />);
  await waitFor(() => expect(mockConfigure).toHaveBeenCalledWith('u2'));

  mockConfigure.mockClear();
  staleHandler('active'); // handler viejo de u1

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockConfigure).not.toHaveBeenCalledWith('u1'); // jamás con el uid viejo
});
