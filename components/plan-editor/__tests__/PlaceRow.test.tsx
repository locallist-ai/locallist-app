/**
 * Tests de `PlaceRow` (fila de resultado en `PlaceSearchModal`) — consumidor de
 * `<Image>` crudo.
 *
 * Foco:
 *  - Camino 404 → gradiente: un fallo de carga oculta la imagen y su atribución.
 *  - MINOR-1: el estado de fallo se keyea por URL; una fila reciclada (FlatList)
 *    con otra foto la reintenta en vez de quedarse en gradiente.
 *  - Atribución "Google" solo con item.photoSource === 'google'.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PlaceRow } from '../PlaceSearchModal';
import type { Place } from '../../../lib/types';

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

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

// PlaceSearchModal importa lib/api en el módulo (arrastra la cadena de
// RevenueCat, no transformable en jest). PlaceRow no lo usa; se corta aquí.
jest.mock('../../../lib/api', () => ({ api: jest.fn() }));

const PHOTO_A = 'https://cdn.example.com/a.jpg';
const PHOTO_B = 'https://cdn.example.com/b.jpg';

const makePlace = (overrides: Partial<Place> = {}): Place => ({
  id: 'p1',
  name: 'Café Central',
  category: 'Coffee',
  subcategories: [],
  neighborhood: 'Downtown',
  city: 'Miami',
  whyThisPlace: '',
  bestFor: null,
  suitableFor: null,
  bestTime: null,
  priceRange: '$$',
  photos: [PHOTO_A],
  photoSource: 'google',
  latitude: null,
  longitude: null,
  googleRating: null,
  googleReviewCount: null,
  source: 'curated',
  openingHours: null,
  ...overrides,
});

const photoUris = (): string[] =>
  screen
    .UNSAFE_queryAllByType(require('expo-image').Image)
    .map((img: any) => img.props.source?.uri)
    .filter(Boolean);

describe('PlaceRow', () => {
  it('muestra la foto y la atribución "Google" con photoSource google', () => {
    render(<PlaceRow item={makePlace({ photoSource: 'google' })} onPress={jest.fn()} />);
    expect(photoUris()).toContain(PHOTO_A);
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();
  });

  it('un 404 oculta la imagen y su atribución (cae a gradiente)', () => {
    render(<PlaceRow item={makePlace({ photoSource: 'google' })} onPress={jest.fn()} />);
    fireEvent(screen.UNSAFE_getByType(require('expo-image').Image), 'error');
    expect(photoUris()).not.toContain(PHOTO_A);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('tras un 404, una fila reciclada con otra foto la reintenta', () => {
    const { rerender } = render(
      <PlaceRow item={makePlace({ photos: [PHOTO_A] })} onPress={jest.fn()} />,
    );
    fireEvent(screen.UNSAFE_getByType(require('expo-image').Image), 'error');
    expect(photoUris()).not.toContain(PHOTO_A);

    rerender(<PlaceRow item={makePlace({ id: 'p2', photos: [PHOTO_B] })} onPress={jest.fn()} />);
    expect(photoUris()).toContain(PHOTO_B);
  });

  it('no muestra atribución con photoSource external', () => {
    render(<PlaceRow item={makePlace({ photoSource: 'external' })} onPress={jest.fn()} />);
    expect(photoUris()).toContain(PHOTO_A);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });
});
