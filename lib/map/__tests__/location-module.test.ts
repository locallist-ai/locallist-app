/**
 * Sobre un binario SIN el módulo nativo de expo-location (dev client previo al
 * rebuild que lo añade), el `require` del paquete LANZA al evaluarse. Este suite
 * simula exactamente eso y verifica que la carga es perezosa+guardada y degrada
 * a no disponible, nunca un crash de arranque.
 */
import { logger } from '../../logger';
import {
  getLocationModule,
  isLocationAvailable,
  resetLocationModuleForTesting,
} from '../location-module';

jest.mock('expo-location', () => {
  throw new Error("Cannot find native module 'ExpoLocation'");
});
jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockWarn = logger.warn as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetLocationModuleForTesting();
});

it('el require que lanza queda contenido: módulo null, disponible=false, un solo warn', () => {
  expect(getLocationModule()).toBeNull();
  expect(isLocationAvailable()).toBe(false);
  // Detección cacheada: llamadas repetidas no re-lanzan ni re-loguean.
  expect(getLocationModule()).toBeNull();
  expect(mockWarn).toHaveBeenCalledTimes(1);
});

it('resetLocationModuleForTesting fuerza una nueva detección', () => {
  expect(getLocationModule()).toBeNull();
  resetLocationModuleForTesting();
  expect(getLocationModule()).toBeNull();
  expect(mockWarn).toHaveBeenCalledTimes(2);
});
