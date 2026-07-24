/**
 * Tests de `resolvePhotoUrl` / `isDisplayablePhotoUrl` — resolución de la URL
 * de foto de un place servida por el proxy runtime del backend (T1-T4).
 *
 * Foco: una URL relativa (`/places/x/photos/0`, caso sin `Api:PublicBaseUrl`
 * configurada) se resuelve contra `EXPO_PUBLIC_API_URL`; una absoluta pasa
 * intacta; cualquier otro caso degrada a `null` para que el caller caiga a
 * gradiente en vez de intentar cargar una URL rota.
 */

import { resolvePhotoUrl, isDisplayablePhotoUrl } from '../photo-url';

describe('resolvePhotoUrl', () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = ORIGINAL_ENV;
  });

  it('resuelve una URL relativa contra EXPO_PUBLIC_API_URL', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.locallist.ai';
    expect(resolvePhotoUrl('/places/abc-123/photos/0')).toBe(
      'https://api.locallist.ai/places/abc-123/photos/0',
    );
  });

  it('no duplica la barra si EXPO_PUBLIC_API_URL termina en /', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.locallist.ai/';
    expect(resolvePhotoUrl('/places/abc-123/photos/0')).toBe(
      'https://api.locallist.ai/places/abc-123/photos/0',
    );
  });

  it('deja una URL absoluta https:// intacta', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.locallist.ai';
    expect(resolvePhotoUrl('https://cdn.googleusercontent.com/photo.jpg')).toBe(
      'https://cdn.googleusercontent.com/photo.jpg',
    );
  });

  it('deja una URL absoluta http:// intacta (dev local)', () => {
    expect(resolvePhotoUrl('http://localhost:5000/places/x/photos/0')).toBe(
      'http://localhost:5000/places/x/photos/0',
    );
  });

  it('devuelve null si es relativa y no hay EXPO_PUBLIC_API_URL disponible', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(resolvePhotoUrl('/places/abc-123/photos/0')).toBeNull();
  });

  it('devuelve null para null/undefined/vacío', () => {
    expect(resolvePhotoUrl(null)).toBeNull();
    expect(resolvePhotoUrl(undefined)).toBeNull();
    expect(resolvePhotoUrl('')).toBeNull();
  });

  it('devuelve null para un formato irreconocible (ni absoluto ni relativo)', () => {
    expect(resolvePhotoUrl('not-a-url')).toBeNull();
  });
});

describe('isDisplayablePhotoUrl', () => {
  it('true para http(s)', () => {
    expect(isDisplayablePhotoUrl('https://example.com/a.jpg')).toBe(true);
    expect(isDisplayablePhotoUrl('http://example.com/a.jpg')).toBe(true);
  });

  it('false para null/undefined/relativa sin resolver', () => {
    expect(isDisplayablePhotoUrl(null)).toBe(false);
    expect(isDisplayablePhotoUrl(undefined)).toBe(false);
    expect(isDisplayablePhotoUrl('/places/x/photos/0')).toBe(false);
  });
});
