import polyline from '@mapbox/polyline';
import { buildRouteGeoJSON } from '../route-geojson';
import type { RouteSegment } from '../../../lib/types';

// Tests de la lógica de ruta de PlanMap a través de `buildRouteGeoJSON`,
// la MISMA función que consume el useMemo del componente (extraída a
// `route-geojson.ts`), sin necesidad de montar MapLibre.

const decodeSegment = (encodedPolyline: string) =>
  polyline.decode(encodedPolyline, 6).map(([lat, lng]) => [lng, lat]);

describe('@mapbox/polyline decode (precision 6)', () => {
  it('decodifica una polyline6 a coordenadas [lng, lat]', () => {
    // Encode a known pair: Madrid (40.4168, -3.7038) -> Prado (40.4130, -3.6921)
    const encoded = polyline.encode(
      [
        [40.4168, -3.7038],
        [40.413, -3.6921],
      ],
      6,
    );
    const decoded = decodeSegment(encoded);
    expect(decoded[0]).toEqual(expect.arrayContaining([-3.7038, 40.4168]));
    expect(decoded[1]).toEqual(expect.arrayContaining([-3.6921, 40.413]));
    // Note: [lng, lat] order means decoded[i] = [lng, lat]
    expect(decoded[0][0]).toBeCloseTo(-3.7038, 3);
    expect(decoded[0][1]).toBeCloseTo(40.4168, 3);
  });

  it('round-trip encode/decode es estable', () => {
    const original: [number, number][] = [
      [40.4168, -3.7038],
      [40.42, -3.7],
      [40.43, -3.69],
    ];
    const encoded = polyline.encode(original, 6);
    const decoded = polyline.decode(encoded, 6);
    decoded.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(original[i][0], 4);
      expect(lng).toBeCloseTo(original[i][1], 4);
    });
  });
});

describe('buildRouteGeoJSON', () => {
  const makeSeg = (day: number, from: number, to: number, poly: string): RouteSegment => ({
    dayNumber: day,
    fromOrderIndex: from,
    toOrderIndex: to,
    encodedPolyline: poly,
    distanceMeters: 500,
    durationSeconds: 300,
  });

  const stops = [
    { latitude: 40.4168, longitude: -3.7038 },
    { latitude: 40.413, longitude: -3.6921 },
  ];

  const encodedA = polyline.encode([[40.4168, -3.7038], [40.413, -3.6921]], 6);
  const encodedB = polyline.encode([[40.413, -3.6921], [40.42, -3.69]], 6);

  const lineStrings = (geo: GeoJSON.GeoJSON) => {
    expect(geo.type).toBe('FeatureCollection');
    return (geo as GeoJSON.FeatureCollection).features.map(
      (f) => (f.geometry as GeoJSON.LineString).coordinates,
    );
  };

  it('con routeSegments produce una Feature por segmento del día activo, decodificada a [lng, lat]', () => {
    const segments = [makeSeg(1, 0, 1, encodedA), makeSeg(2, 0, 1, encodedB)];

    const geo = buildRouteGeoJSON(stops, segments, 1);

    const lines = lineStrings(geo);
    expect(lines).toHaveLength(1);
    // El segmento del día 2 queda fuera; el del día 1 se decodifica entero
    expect(lines[0]).toHaveLength(2);
    expect(lines[0][0][0]).toBeCloseTo(-3.7038, 3);
    expect(lines[0][0][1]).toBeCloseTo(40.4168, 3);
    expect(lines[0][1][0]).toBeCloseTo(-3.6921, 3);
    expect(lines[0][1][1]).toBeCloseTo(40.413, 3);
  });

  it('sin activeDayNumber incluye los segmentos de todos los días', () => {
    const segments = [makeSeg(1, 0, 1, encodedA), makeSeg(2, 0, 1, encodedB)];

    const geo = buildRouteGeoJSON(stops, segments, undefined);

    expect(lineStrings(geo)).toHaveLength(2);
  });

  it('sin routeSegments cae a una línea recta entre los stops', () => {
    const geo = buildRouteGeoJSON(stops, undefined);

    const lines = lineStrings(geo);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual([
      [-3.7038, 40.4168],
      [-3.6921, 40.413],
    ]);
  });

  it('si ningún segmento pertenece al día activo también cae a la línea recta', () => {
    const segments = [makeSeg(1, 0, 1, encodedA)];

    const geo = buildRouteGeoJSON(stops, segments, 3);

    const lines = lineStrings(geo);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual([
      [-3.7038, 40.4168],
      [-3.6921, 40.413],
    ]);
  });
});
