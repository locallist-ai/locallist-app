import {
  validatePickedVideo,
  resolveUploadMime,
  MAX_BYTES,
  MAX_DURATION_MS,
} from '../validate';
import type { PickedVideo } from '../native-picker';

const base: PickedVideo = {
  uri: 'file:///video.mp4',
  fileName: 'video.mp4',
  fileSize: 10 * 1024 * 1024,
  mimeType: 'video/mp4',
  durationMs: 30_000,
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
});
