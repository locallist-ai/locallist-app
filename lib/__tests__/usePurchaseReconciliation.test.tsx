/**
 * Tests de reconciliación en caliente del tier tras una compra IAP
 * (`usePurchaseReconciliation`). Mockea lib/purchases y lib/auth.
 *
 * Cubre:
 *  - Sesión autenticada: configura el SDK con el userId y registra el listener;
 *    el callback del listener (entitlement plus activo por webhook retrasado)
 *    refresca /account → isPro flipea en caliente.
 *  - Vuelta a foreground: reconcilia (configure + refreshUser).
 *  - configure=false (identidad RC no confirmada): NO registra el listener del
 *    SDK en el montaje, pero el refresh de /account en foreground se ejecuta
 *    igual — el flip del tier por webhook no depende de la identidad RC.
 *  - Sin sesión: no configura ni registra listener.
 *
 * Las carreras (re-attach del listener en foreground, handlers obsoletos tras
 * logout/cambio de cuenta) viven en usePurchaseReconciliation.contract.test.tsx.
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

beforeEach(() => {
  jest.clearAllMocks();
  refreshUser.mockResolvedValue('pro');
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, refreshUser, isAuthenticated: true });
  mockConfigure.mockResolvedValue(true);
  mockAddListener.mockReturnValue(() => {});
});

it('sesión autenticada: configura con el userId y registra el listener de reconciliación', async () => {
  render(<Harness />);

  await waitFor(() => expect(mockConfigure).toHaveBeenCalledWith('u1'));
  await waitFor(() => expect(mockAddListener).toHaveBeenCalled());
});

it('el listener dispara refreshUser cuando el entitlement plus pasa a activo (webhook retrasado)', async () => {
  render(<Harness />);
  await waitFor(() => expect(mockAddListener).toHaveBeenCalled());

  // El SDK marca el entitlement plus activo (llegó el webhook a RevenueCat).
  const onPlusActivated = mockAddListener.mock.calls[0][0] as () => void;
  onPlusActivated();

  expect(refreshUser).toHaveBeenCalled();
});

it('vuelta a foreground: reconcilia (configure + refreshUser)', async () => {
  const addSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);
  render(<Harness />);

  await waitFor(() =>
    expect(addSpy).toHaveBeenCalledWith('change', expect.any(Function)),
  );
  const handler = addSpy.mock.calls[0][1] as (s: AppStateStatus) => void;

  mockConfigure.mockClear();
  refreshUser.mockClear();
  handler('active');

  await waitFor(() => {
    expect(mockConfigure).toHaveBeenCalledWith('u1');
    expect(refreshUser).toHaveBeenCalled();
  });
  addSpy.mockRestore();
});

it('foreground con estado background: no reconcilia', async () => {
  const addSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);
  render(<Harness />);
  await waitFor(() => expect(addSpy).toHaveBeenCalled());
  const handler = addSpy.mock.calls[0][1] as (s: AppStateStatus) => void;

  mockConfigure.mockClear();
  refreshUser.mockClear();
  handler('background');

  expect(mockConfigure).not.toHaveBeenCalled();
  expect(refreshUser).not.toHaveBeenCalled();
  addSpy.mockRestore();
});

it('configure=false (identidad no confirmada): no registra el listener del SDK', async () => {
  mockConfigure.mockResolvedValue(false);
  const addSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);
  render(<Harness />);

  await waitFor(() => expect(mockConfigure).toHaveBeenCalledWith('u1'));
  expect(mockAddListener).not.toHaveBeenCalled();
  addSpy.mockRestore();
});

it('foreground con configure=false: refresca /account igualmente (el flip no depende de RC)', async () => {
  mockConfigure.mockResolvedValue(false);
  const addSpy = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as never);
  render(<Harness />);
  await waitFor(() => expect(addSpy).toHaveBeenCalled());
  const handler = addSpy.mock.calls[0][1] as (s: AppStateStatus) => void;

  refreshUser.mockClear();
  handler('active');

  await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  addSpy.mockRestore();
});

it('sin sesión: no configura ni registra listener', () => {
  mockUseAuth.mockReturnValue({ user: null, refreshUser, isAuthenticated: false });
  render(<Harness />);

  expect(mockConfigure).not.toHaveBeenCalled();
  expect(mockAddListener).not.toHaveBeenCalled();
});
