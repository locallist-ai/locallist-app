/**
 * Tests de `PhotoHero` — atribución "Google" (ToS de la Places API) y
 * degradación a gradiente cuando la foto falla / no hay foto.
 *
 * Foco: `photoSource === 'google'` muestra la etiqueta "Google" superpuesta;
 * `external`/`null`/omitido no la muestra; sin URL válida o con un error de
 * carga (404 del proxy) cae al gradiente de categoría, nunca a imagen rota.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PhotoHero } from '../PhotoHero';

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});

jest.mock('expo-image', () => {
  const { Image: RNImage } = jest.requireActual('react-native');
  return { Image: RNImage };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

describe('PhotoHero', () => {
  const HTTPS_URL = 'https://cdn.example.com/photo.jpg';

  it('muestra la atribución "Google" cuando photoSource es google', () => {
    render(<PhotoHero imageUrl={HTTPS_URL} photoSource="google" />);
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();
    expect(screen.getByText('Google')).toBeTruthy();
  });

  it('NO muestra atribución cuando photoSource es external', () => {
    render(<PhotoHero imageUrl={HTTPS_URL} photoSource="external" />);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('NO muestra atribución cuando photoSource es null/omitido', () => {
    render(<PhotoHero imageUrl={HTTPS_URL} />);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('resuelve una URL relativa del proxy contra EXPO_PUBLIC_API_URL y sigue mostrando la atribución', () => {
    const original = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.locallist.ai';
    render(<PhotoHero imageUrl="/places/abc/photos/0" photoSource="google" />);
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();
    process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('sin URL de foto degrada al gradiente de categoría (sin atribución)', () => {
    render(<PhotoHero photoSource="google" fallbackCategory="Food" />);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('un error de carga (404 del proxy) oculta la imagen y la atribución, no deja imagen rota', () => {
    render(<PhotoHero imageUrl={HTTPS_URL} photoSource="google" />);
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();

    fireEvent(screen.UNSAFE_getByType(require('expo-image').Image), 'error');

    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });
});
