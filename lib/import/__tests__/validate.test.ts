import {
  validatePickedVideo,
  resolveUploadMime,
  MAX_BYTES,
  MAX_IMAGE_BYTES,
  MAX_DURATION_MS,
} from '../validate';
import type { PickedVideo } from '../native-picker';

const base: PickedVideo = {
  uri: 'file:///video.mp4',
  fileName: 'video.mp4',
  kind: 'video',
  fileSize: 10 * 1024 * 1024,
  mimeType: 'video/mp4',
  durationMs: 30_000,
};

const imageBase: PickedVideo = {
  uri: 'file:///photo.jpg',
  fileName: 'photo.jpg',
  kind: 'image',
  fileSize: 5 * 1024 * 1024,
  mimeType: 'image/jpeg',
  durationMs: null,
};

describe('validatePickedVideo', () => {
  it('acepta un mp4 válido dentro de límites', () => {
    expect(validatePickedVideo(base)).toBeNull();
  });

  it('rechaza tamaño > 150 MB', () => {
    expect(validatePickedVideo({ ...base, fileSize: MAX_BYTES + 1 })).toBe('too_large');
  });

  it('rechaza duración > 10 min', () => {
    expect(validatePickedVideo({ ...base, durationMs: MAX_DURATION_MS + 1 })).toBe('too_long');
  });

  it('rechaza formato no soportado (mime y extensión inválidos)', () => {
    expect(
      validatePickedVideo({ ...base, fileName: 'clip.txt', mimeType: 'text/plain' }),
    ).toBe('unsupported_format');
  });

  it('acepta por extensión cuando el mime falta (mov sin mime)', () => {
    expect(validatePickedVideo({ ...base, fileName: 'clip.mov', mimeType: null })).toBeNull();
  });

  it('no bloquea cuando el picker no da metadatos (todo null)', () => {
    expect(
      validatePickedVideo({ ...base, fileSize: null, durationMs: null, mimeType: null, fileName: 'clip.webm' }),
    ).toBeNull();
  });

  it('el tamaño tiene prioridad sobre el formato', () => {
    expect(
      validatePickedVideo({ ...base, fileSize: MAX_BYTES + 1, fileName: 'clip.txt', mimeType: 'text/plain' }),
    ).toBe('too_large');
  });

  // ── Imagen: sin duración, cap 25 MB, formatos de imagen ──

  it('acepta un jpeg válido SIN comprobar duración (aunque venga con una absurda)', () => {
    // durationMs enorme: para imagen debe IGNORARSE, no disparar too_long.
    expect(
      validatePickedVideo({ ...imageBase, durationMs: MAX_DURATION_MS + 1 }),
    ).toBeNull();
  });

  it('rechaza imagen > 25 MB (cap de imagen, no el de vídeo)', () => {
    expect(validatePickedVideo({ ...imageBase, fileSize: MAX_IMAGE_BYTES + 1 })).toBe('too_large');
  });

  it('una imagen de 30 MB (válida como vídeo) se rechaza por el cap de imagen', () => {
    // 30 MB < 150 MB (vídeo) pero > 25 MB (imagen): el kind decide.
    expect(validatePickedVideo({ ...imageBase, fileSize: 30 * 1024 * 1024 })).toBe('too_large');
  });

  it('acepta png/webp/heic válidos', () => {
    expect(validatePickedVideo({ ...imageBase, fileName: 'a.png', mimeType: 'image/png' })).toBeNull();
    expect(validatePickedVideo({ ...imageBase, fileName: 'a.webp', mimeType: 'image/webp' })).toBeNull();
    expect(validatePickedVideo({ ...imageBase, fileName: 'a.heic', mimeType: 'image/heic' })).toBeNull();
  });

  it('acepta imagen por extensión cuando el mime falta (heic sin mime)', () => {
    expect(validatePickedVideo({ ...imageBase, fileName: 'a.heic', mimeType: null })).toBeNull();
  });

  it('rechaza un formato de imagen no soportado (gif)', () => {
    expect(
      validatePickedVideo({ ...imageBase, fileName: 'a.gif', mimeType: 'image/gif' }),
    ).toBe('unsupported_format');
  });

  it('un mime de vídeo NO cuela como imagen (kind manda)', () => {
    expect(
      validatePickedVideo({ ...imageBase, fileName: 'clip.mp4', mimeType: 'video/mp4' }),
    ).toBe('unsupported_format');
  });
});

describe('resolveUploadMime', () => {
  it('usa el mime del asset cuando es válido', () => {
    expect(resolveUploadMime({ ...base, mimeType: 'video/webm', fileName: 'a.webm' })).toBe('video/webm');
  });

  it('deriva el mime de la extensión mov → quicktime', () => {
    expect(resolveUploadMime({ ...base, mimeType: null, fileName: 'a.mov' })).toBe('video/quicktime');
  });

  it('cae a video/mp4 cuando no hay pistas', () => {
    expect(resolveUploadMime({ ...base, mimeType: null, fileName: 'noext' })).toBe('video/mp4');
  });

  it('usa el mime de imagen cuando es válido (png)', () => {
    expect(resolveUploadMime({ ...imageBase, mimeType: 'image/png', fileName: 'a.png' })).toBe('image/png');
  });

  it('deriva el mime de la extensión de imagen heic → image/heic', () => {
    expect(resolveUploadMime({ ...imageBase, mimeType: null, fileName: 'a.heic' })).toBe('image/heic');
  });

  it('cae a image/jpeg cuando es imagen sin pistas', () => {
    expect(resolveUploadMime({ ...imageBase, mimeType: null, fileName: 'noext' })).toBe('image/jpeg');
  });
});
