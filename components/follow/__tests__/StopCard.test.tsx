/**
 * Tests de `StopCard` (tarjeta de detalle del stop en Follow Mode).
 *
 * Foco (MINOR-3, ToS-crítico): StopCard lee la foto y su `photoSource` del MISMO
 * sitio que envía el backend y que ya lee FollowDaySheet — a nivel de place
 * (`stop.place.photos: string[]` + `stop.place.photoSource`), NO una forma
 * per-photo `{ url, photoSource }[]` que ningún DTO produce. Con `photoSource`
 * 'google' se renderiza la foto Y la atribución "Google"; con 'external'/null,
 * la foto sin atribución. Ninguna foto de Google queda sin atribución.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StopCard } from '../StopCard';
import type { PlanStop, Place } from '../../../lib/types';

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

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
  Ionicons: () => null,
}));

// El corazón de favoritos tira de auth/gate/router; se aísla del foco de fotos.
jest.mock('../../ui/FavoriteButton', () => ({ FavoriteButton: () => null }));

const HTTPS_PHOTO = 'https://cdn.example.com/photo.jpg';

const makePlace = (overrides: Partial<Place> = {}): Place => ({
  id: 'p1',
  name: 'Café Central',
  category: 'Coffee',
  subcategories: [],
  neighborhood: 'Downtown',
  city: 'Miami',
  whyThisPlace: 'Great espresso',
  bestFor: null,
  suitableFor: null,
  bestTime: null,
  priceRange: '$$',
  photos: [HTTPS_PHOTO],
  photoSource: 'google',
  latitude: 25.7,
  longitude: -80.1,
  googleRating: 4.6,
  googleReviewCount: 1200,
  source: 'curated',
  openingHours: null,
  ...overrides,
});

const makeStop = (place: Place | null): PlanStop => ({
  placeId: 'p1',
  dayNumber: 1,
  orderIndex: 0,
  timeBlock: 'morning',
  suggestedArrival: '09:00',
  suggestedDurationMin: 60,
  travelFromPrevious: null,
  place,
});

describe('StopCard', () => {
  it('con place.photoSource "google" renderiza la foto Y la atribución "Google"', () => {
    render(<StopCard stop={makeStop(makePlace({ photoSource: 'google' }))} />);
    // Foto mostrada (no gradiente) leyendo place.photos[0].
    const images = screen.UNSAFE_getAllByType(require('expo-image').Image);
    expect(images.some((img: any) => img.props.source?.uri === HTTPS_PHOTO)).toBe(true);
    // Atribución presente.
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();
  });

  it('con place.photoSource "external" muestra la foto SIN atribución', () => {
    render(<StopCard stop={makeStop(makePlace({ photoSource: 'external' }))} />);
    const images = screen.UNSAFE_getAllByType(require('expo-image').Image);
    expect(images.some((img: any) => img.props.source?.uri === HTTPS_PHOTO)).toBe(true);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('con place.photoSource null (o ausente) no muestra atribución', () => {
    render(<StopCard stop={makeStop(makePlace({ photoSource: null }))} />);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('renderiza el nombre del place desde stop.place (no una forma plana)', () => {
    render(<StopCard stop={makeStop(makePlace({ name: 'Café Central' }))} />);
    expect(screen.getByText('Café Central')).toBeTruthy();
  });
});
