/**
 * Test de tipos de `Place.photoSource` (T5: atribución "Google").
 *
 * Foco: el campo es aditivo/opcional — un payload legacy sin `photoSource`
 * (pre-backend-T2) sigue siendo un `Place` válido y el acceso defensivo
 * (`place.photoSource ?? null`) no rompe. Esto es sobre todo una prueba de
 * tipos: si `Place` dejara de aceptar un payload sin el campo, `tsc` fallaría
 * al compilar este archivo antes de que Jest llegue a ejecutarlo.
 */

import type { Place } from '../types';

function legacyPlacePayload(): Omit<Place, 'photoSource'> {
  return {
    id: 'place-1',
    name: 'Café Central',
    category: 'Coffee',
    subcategories: [],
    neighborhood: null,
    city: 'Miami',
    whyThisPlace: 'Great espresso',
    bestFor: null,
    suitableFor: null,
    bestTime: null,
    priceRange: null,
    photos: ['https://cdn.example.com/a.jpg'],
    latitude: null,
    longitude: null,
    googleRating: null,
    googleReviewCount: null,
    source: 'curated',
    openingHours: null,
  };
}

describe('Place.photoSource (T5)', () => {
  it('un payload legacy sin photoSource sigue siendo un Place válido', () => {
    const legacy: Place = legacyPlacePayload();
    expect(legacy.photoSource).toBeUndefined();
    expect(legacy.photoSource ?? null).toBeNull();
  });

  it('acepta "google" y "external" además de null', () => {
    const google: Place = { ...legacyPlacePayload(), photoSource: 'google' };
    const external: Place = { ...legacyPlacePayload(), photoSource: 'external' };
    const none: Place = { ...legacyPlacePayload(), photoSource: null };

    expect(google.photoSource).toBe('google');
    expect(external.photoSource).toBe('external');
    expect(none.photoSource).toBeNull();
  });
});
