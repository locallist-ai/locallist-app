import polyline from '@mapbox/polyline';
import { splitRouteGeoJSON } from '../route-split';
import type { RouteSegment } from '../../types';

const makeSeg = (day: number, from: number, to: number, poly: string): RouteSegment => ({
  dayNumber: day,
  fromOrderIndex: from,
  toOrderIndex: to,
  encodedPolyline: poly,
  distanceMeters: 500,
  durationSeconds: 300,
});

const encodedA = polyline.encode([[40.4168, -3.7038], [40.413, -3.6921]], 6);
const encodedB = polyline.encode([[40.413, -3.6921], [40.42, -3.69]], 6);

const lineCoords = (fc: GeoJSON.FeatureCollection) =>
  fc.features.map((f) => (f.geometry as GeoJSON.LineString).coordinates);

const stops = [
  { latitude: 40.4168, longitude: -3.7038, orderIndex: 0 },
  { latitude: 40.413, longitude: -3.6921, orderIndex: 1 },
  { latitude: 40.42, longitude: -3.69, orderIndex: 2 },
];

describe('splitRouteGeoJSON con routeSegments', () => {
  it('el tramo que TERMINA en el stop activo cuenta como recorrido (<=)', () => {
    const segments = [makeSeg(1, 0, 1, encodedA), makeSeg(1, 1, 2, encodedB)];

    const { traveled, upcoming } = splitRouteGeoJSON(stops, segments, 1, 1);

    // seg 0->1 (to=1 == activo) recorrido; seg 1->2 (to=2 > activo) pendiente.
    expect(traveled.features).toHaveLength(1);
    expect(upcoming.features).toHaveLength(1);
    expect(lineCoords(traveled)[0][0][0]).toBeCloseTo(-3.7038, 3);
    expect(lineCoords(upcoming)[0][1][0]).toBeCloseTo(-3.69, 3);
  });

  it('en el primer stop nada está recorrido y todo es pendiente', () => {
    const segments = [makeSeg(1, 0, 1, encodedA), makeSeg(1, 1, 2, encodedB)];

    const { traveled, upcoming } = splitRouteGeoJSON(stops, segments, 1, 0);

    expect(traveled.features).toHaveLength(0);
    expect(upcoming.features).toHaveLength(2);
  });

  it('ignora los segmentos de otros días', () => {
    const segments = [makeSeg(1, 0, 1, encodedA), makeSeg(2, 0, 1, encodedB)];

    const { traveled, upcoming } = splitRouteGeoJSON(stops, segments, 1, 1);

    expect(traveled.features).toHaveLength(1);
    expect(upcoming.features).toHaveLength(0);
  });
});

describe('splitRouteGeoJSON fallback línea recta (sin segmentos)', () => {
  it('parte la polyline de stops en el stop activo (corte incluido en ambos)', () => {
    const { traveled, upcoming } = splitRouteGeoJSON(stops, undefined, 1, 1);

    expect(lineCoords(traveled)).toEqual([
      [
        [-3.7038, 40.4168],
        [-3.6921, 40.413],
      ],
    ]);
    expect(lineCoords(upcoming)).toEqual([
      [
        [-3.6921, 40.413],
        [-3.69, 40.42],
      ],
    ]);
  });

  it('con menos de dos stops no produce líneas', () => {
    const { traveled, upcoming } = splitRouteGeoJSON([stops[0]], undefined, 1, 0);
    expect(traveled.features).toHaveLength(0);
    expect(upcoming.features).toHaveLength(0);
  });
});
