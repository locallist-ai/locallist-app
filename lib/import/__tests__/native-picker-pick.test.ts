/**
 * Camino "feliz" del picker CON el módulo nativo disponible (mock funcional).
 * Complementa `native-picker.test.ts` (que simula el binario SIN el módulo):
 * aquí verificamos que el picker se abre para vídeos E imágenes y que el asset
 * se normaliza con el `kind`, `mimeType` y `durationMs` correctos según el tipo.
 */
import {
  pickVideo,
  resetImagePickerModuleForTesting,
} from '../native-picker';

const mockRequestPermission = jest.fn();
const mockLaunch = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestPermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunch(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetImagePickerModuleForTesting();
  mockRequestPermission.mockResolvedValue({ granted: true });
});

it('abre el picker para vídeos E imágenes', async () => {
  mockLaunch.mockResolvedValue({ canceled: true, assets: [] });
  await pickVideo();
  expect(mockLaunch).toHaveBeenCalledWith(
    expect.objectContaining({ mediaTypes: expect.arrayContaining(['videos', 'images']) }),
  );
});

it('normaliza un VÍDEO: kind=video, conserva mime y duración', async () => {
  mockLaunch.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///v.mp4', fileName: 'v.mp4', type: 'video', mimeType: 'video/mp4', duration: 5000, fileSize: 1000 }],
  });
  const res = await pickVideo();
  expect(res).toEqual({
    status: 'picked',
    asset: { uri: 'file:///v.mp4', fileName: 'v.mp4', kind: 'video', fileSize: 1000, mimeType: 'video/mp4', durationMs: 5000 },
  });
});

it('normaliza una IMAGEN: kind=image, mime de imagen y durationMs=null', async () => {
  mockLaunch.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///photo.jpg', fileName: 'photo.jpg', type: 'image', mimeType: 'image/jpeg', fileSize: 2000 }],
  });
  const res = await pickVideo();
  expect(res.status).toBe('picked');
  if (res.status !== 'picked') throw new Error('expected picked');
  expect(res.asset.kind).toBe('image');
  expect(res.asset.mimeType).toBe('image/jpeg');
  expect(res.asset.durationMs).toBeNull();
});

it('imagen sin `type`: cae al prefijo del mime (image/*) para el kind', async () => {
  mockLaunch.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///x', fileName: 'x.png', mimeType: 'image/png', fileSize: 100 }],
  });
  const res = await pickVideo();
  if (res.status !== 'picked') throw new Error('expected picked');
  expect(res.asset.kind).toBe('image');
});
