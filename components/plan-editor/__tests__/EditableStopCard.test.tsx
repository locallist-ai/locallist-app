/**
 * Tests de `EditableStopCard` — consumidor de `<Image>` crudo en el editor.
 *
 * Foco:
 *  - Camino 404 → gradiente: un fallo de carga oculta la imagen (y su
 *    atribución) y cae al gradiente de categoría, nunca imagen rota.
 *  - MINOR-1: el estado de fallo se keyea por URL, así que al cambiar la foto
 *    ("Replace" que sustituye el place del stop) se REINTENTA la nueva URL en
 *    vez de quedarse en el gradiente por el 404 anterior.
 *  - La atribución "Google" aparece solo con place.photoSource === 'google'.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EditableStopCard } from '../EditableStopCard';
import type { PlanStop, Place } from '../../../lib/types';

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

const PHOTO_A = 'https://cdn.example.com/a.jpg';
const PHOTO_B = 'https://cdn.example.com/b.jpg';

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
  photos: [PHOTO_A],
  photoSource: 'google',
  latitude: 25.7,
  longitude: -80.1,
  googleRating: 4.6,
  googleReviewCount: 1200,
  source: 'curated',
  openingHours: null,
  ...overrides,
});

const makeStop = (place: Place): PlanStop & { id?: string } => ({
  id: 's1',
  placeId: place.id,
  dayNumber: 1,
  orderIndex: 0,
  timeBlock: 'morning',
  suggestedArrival: '09:00',
  suggestedDurationMin: 60,
  travelFromPrevious: null,
  place,
});

const baseProps = { drag: jest.fn(), isActive: false };

// Fotos actualmente mostradas (expo-image mockeado a RNImage). Usa la variante
// `query` porque `get` lanza cuando no hay ninguna (foto degradada a gradiente).
const photoUris = (): string[] =>
  screen
    .UNSAFE_queryAllByType(require('expo-image').Image)
    .map((img: any) => img.props.source?.uri)
    .filter(Boolean);

describe('EditableStopCard', () => {
  it('muestra la foto y la atribución "Google" con photoSource google', () => {
    render(<EditableStopCard stop={makeStop(makePlace({ photoSource: 'google' }))} {...baseProps} />);
    expect(photoUris()).toContain(PHOTO_A);
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();
  });

  it('un 404 oculta la imagen y su atribución (cae a gradiente)', () => {
    render(<EditableStopCard stop={makeStop(makePlace({ photoSource: 'google' }))} {...baseProps} />);
    fireEvent(screen.UNSAFE_getByType(require('expo-image').Image), 'error');
    // Sin imagen mostrada (gradiente) y sin atribución.
    expect(photoUris()).not.toContain(PHOTO_A);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });

  it('tras un 404, cambiar la URL (Replace) reintenta la nueva foto (no queda en gradiente)', () => {
    const { rerender } = render(
      <EditableStopCard stop={makeStop(makePlace({ photos: [PHOTO_A] }))} {...baseProps} />,
    );
    fireEvent(screen.UNSAFE_getByType(require('expo-image').Image), 'error');
    expect(photoUris()).not.toContain(PHOTO_A);

    // "Replace": el stop pasa a otro place con otra foto → se reintenta.
    rerender(
      <EditableStopCard stop={makeStop(makePlace({ id: 'p2', photos: [PHOTO_B] }))} {...baseProps} />,
    );
    expect(photoUris()).toContain(PHOTO_B);
    expect(screen.getByTestId('photo-attribution-google')).toBeTruthy();
  });

  it('no muestra atribución con photoSource external', () => {
    render(<EditableStopCard stop={makeStop(makePlace({ photoSource: 'external' }))} {...baseProps} />);
    expect(photoUris()).toContain(PHOTO_A);
    expect(screen.queryByTestId('photo-attribution-google')).toBeNull();
  });
});
