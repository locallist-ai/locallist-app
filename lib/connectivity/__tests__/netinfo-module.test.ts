/**
 * Sobre un binario SIN el módulo nativo de netinfo (dev client previo al rebuild
 * que lo añade), el `require` del paquete LANZA al evaluarse. Este suite simula
 * exactamente eso y verifica que la carga es perezosa+guardada y degrada a "no
 * disponible" (asumimos online), nunca un crash de arranque.
 */
import { logger } from '../../logger';
import {
  getNetInfoModule,
  isConnectivityAvailable,
  resetNetInfoModuleForTesting,
} from '../netinfo-module';

jest.mock('@react-native-community/netinfo', () => {
  throw new Error("Cannot find native module 'RNCNetInfo'");
});
jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockWarn = logger.warn as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetNetInfoModuleForTesting();
});

it('el require que lanza queda contenido: módulo null, disponible=false, un solo warn', () => {
  expect(getNetInfoModule()).toBeNull();
  expect(isConnectivityAvailable()).toBe(false);
  // Detección cacheada: llamadas repetidas no re-lanzan ni re-loguean.
  expect(getNetInfoModule()).toBeNull();
  expect(mockWarn).toHaveBeenCalledTimes(1);
});

it('resetNetInfoModuleForTesting fuerza una nueva detección', () => {
  expect(getNetInfoModule()).toBeNull();
  resetNetInfoModuleForTesting();
  expect(getNetInfoModule()).toBeNull();
  expect(mockWarn).toHaveBeenCalledTimes(2);
});
