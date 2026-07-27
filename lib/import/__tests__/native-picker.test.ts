/**
 * Guard del módulo nativo (requisito del repo, espejo de trial-reminder):
 * sobre un binario SIN expo-image-picker (dev client previo al rebuild) el
 * `require` del paquete LANZA al evaluarse. Este suite lo simula y verifica que
 * la carga es perezosa+guardada y `pickVideo` degrada a `unavailable` — nunca un
 * crash. Jest no montaría el módulo nativo real, así que esto es lo único que
 * caza la regresión.
 */
import { logger } from '../../logger';
import {
  getImagePickerModule,
  isImagePickerAvailable,
  resetImagePickerModuleForTesting,
  pickVideo,
} from '../native-picker';

// Simula el binario sin módulo nativo: requireNativeModule lanza al evaluar el JS.
jest.mock('expo-image-picker', () => {
  throw new Error("Cannot find native module 'ExpoImagePicker'");
});
jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockWarn = logger.warn as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetImagePickerModuleForTesting();
});

it('el require que lanza queda contenido: módulo null, disponible=false, un solo warn', () => {
  expect(getImagePickerModule()).toBeNull();
  expect(isImagePickerAvailable()).toBe(false);
  // Detección cacheada: llamadas repetidas no re-lanzan ni re-loguean.
  expect(getImagePickerModule()).toBeNull();
  expect(mockWarn).toHaveBeenCalledTimes(1);
});

it('pickVideo degrada a "unavailable" sin lanzar', async () => {
  await expect(pickVideo()).resolves.toEqual({ status: 'unavailable' });
});
