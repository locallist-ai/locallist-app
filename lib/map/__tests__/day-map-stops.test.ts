import { buildDayMapStops, mapStopFromPlanStop } from '../day-map-stops';
import type { PlanStop, Place } from '../../types';

// El número del pin sale de la posición del día COMPLETO (antes de filtrar por
// coords), para casar con el "N / M" del FollowDaySheet aunque un stop
// intermedio no tenga lat/lng. Estos tests fijan ese contrato.

const place = (name: string, coords: { lat?: number; lng?: number } = {}): Place =>
  ({
    id: `place-${name}`,
    name,
    category: 'Coffee',
    subcategories: [],
    neighborhood: 'Downtown',
    city: 'Miami',
    whyThisPlace: '',
    bestFor: null,
    suitableFor: null,
    bestTime: null,
    priceRange: '$$',
    photos: [],
    photoSource: null,
    latitude: coords.lat as number,
    longitude: coords.lng as number,
    googleRating: 4.5,
    googleReviewCount: 100,
    source: 'curated',
    openingHours: null,
  }) as Place;

const stop = (
  name: string,
  dayNumber: number,
  orderIndex: number,
  coords: { lat?: number; lng?: number },
): PlanStop => ({
  placeId: `place-${name}`,
  dayNumber,
  orderIndex,
  timeBlock: 'morning',
  suggestedArrival: '09:00',
  suggestedDurationMin: 60,
  travelFromPrevious: null,
  place: place(name, coords),
});

describe('buildDayMapStops', () => {
  it('numera por posición del día completo, saltando el stop sin coords', () => {
    // Día con A (ok), B (SIN coords), C (ok): B no pinta pin, pero C conserva
    // su número real (3), no el índice del array filtrado (que sería 2).
    const dayStops: PlanStop[] = [
      stop('A', 1, 0, { lat: 25.7, lng: -80.1 }),
      stop('B', 1, 1, {}),
      stop('C', 1, 2, { lat: 25.72, lng: -80.12 }),
    ];

    const pins = buildDayMapStops(dayStops);

    expect(pins.map((p) => p.id)).toEqual(['place-A', 'place-C']);
    // Mutación: numerar sobre el array YA filtrado daría [1, 2] y caería aquí.
    expect(pins.map((p) => p.number)).toEqual([1, 3]);
  });

  it('numera 1..N contiguos cuando todos los stops tienen coords', () => {
    const dayStops: PlanStop[] = [
      stop('A', 1, 0, { lat: 25.7, lng: -80.1 }),
      stop('B', 1, 1, { lat: 25.71, lng: -80.11 }),
      stop('C', 1, 2, { lat: 25.72, lng: -80.12 }),
    ];

    expect(buildDayMapStops(dayStops).map((p) => p.number)).toEqual([1, 2, 3]);
  });

  it('reinicia la numeración por día (se llama con el día ya filtrado)', () => {
    // El Follow screen re-filtra por día antes de llamar, así que el día 2
    // empieza otra vez en 1 (no continúa la numeración global del plan).
    const day2Stops: PlanStop[] = [
      stop('D', 2, 0, { lat: 40.4, lng: -3.7 }),
      stop('E', 2, 1, { lat: 40.41, lng: -3.69 }),
    ];

    const pins = buildDayMapStops(day2Stops);
    expect(pins.map((p) => p.number)).toEqual([1, 2]);
    expect(pins.map((p) => p.id)).toEqual(['place-D', 'place-E']);
  });

  it('mapStopFromPlanStop descarta coords ausentes o no finitas', () => {
    expect(mapStopFromPlanStop(stop('X', 1, 0, {}))).toBeNull();
    expect(mapStopFromPlanStop(stop('Y', 1, 0, { lat: NaN, lng: -80 }))).toBeNull();
    const ok = mapStopFromPlanStop(stop('Z', 1, 0, { lat: 25.7, lng: -80.1 }));
    expect(ok).toMatchObject({ id: 'place-Z', latitude: 25.7, longitude: -80.1 });
    // Sin número: el número lo pone buildDayMapStops sobre la posición del día.
    expect(ok?.number).toBeUndefined();
  });
});
