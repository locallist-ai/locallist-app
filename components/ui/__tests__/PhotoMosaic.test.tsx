/**
 * Tests de `PhotoMosaic` — atribución "Google" por tile (ToS de la Places
 * API) y degradación a gradiente por tile cuando la foto falla / no hay foto.
 *
 * Foco: un item `{ url, photoSource: 'google' }` muestra "Google" en su tile;
 * `external`/`null`/string plano no la muestra; una URL relativa se resuelve;
 * un error de carga (404 del proxy) de un tile cae a gradiente en ESE tile
 * sin afectar a los demás.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PhotoMosaic } from '../PhotoMosaic';

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-image', () => {
  const { Image: RNImage } = jest.requireActual('react-native');
  return { Image: RNImage };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

describe('PhotoMosaic', () => {
  it('muestra la atribución "Google" en el tile cuyo photoSource es google', () => {
    render(
      <PhotoMosaic
        photos={[
          { url: 'https://cdn.example.com/a.jpg', photoSource: 'google' },
          { url: 'https://cdn.example.com/b.jpg', photoSource: 'external' },
        ]}
      />,
    );
    // Un solo tile con atribución (el "google"), no dos.
    expect(screen.getAllByTestId('photo-attribution-google')).toHaveLength(1);
  });

  it('NO muestra atribución para strings planos (sin metadata de fuente)', () => {
    render(<PhotoMosaic photos={['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg']} />);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('resuelve URLs relativas del proxy contra EXPO_PUBLIC_API_URL', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.locallist.ai';
    render(
      <PhotoMosaic
        photos={[{ url: '/places/abc/photos/0', photoSource: 'google' }]}
      />,
    );
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();
    process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('sin fotos válidas degrada a gradiente (sin atribución, sin crash)', () => {
    render(<PhotoMosaic photos={[]} fallbackCategory="Culture" />);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('un error de carga (404 del proxy) en un tile oculta esa imagen y su atribución', () => {
    render(
      <PhotoMosaic
        photos={[
          { url: 'https://cdn.example.com/a.jpg', photoSource: 'google' },
          { url: 'https://cdn.example.com/b.jpg', photoSource: 'google' },
        ]}
      />,
    );
    expect(screen.getAllByTestId('photo-attribution-google')).toHaveLength(2);

    const images = screen.UNSAFE_getAllByType(require('expo-image').Image);
    fireEvent(images[0], 'error');

    // El tile que falló pierde su imagen y atribución; el otro sigue intacto.
    expect(screen.getAllByTestId('photo-attribution-google')).toHaveLength(1);
  });
});
