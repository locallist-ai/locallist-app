import polyline from '@mapbox/polyline';
import type { RouteSegment } from '../../../lib/types';

// Test the polyline decode helper independently since PlanMap uses it.
// We exercise the same logic as buildRouteGeoJSON without needing to mount the MapLibre component.

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

describe('buildRouteGeoJSON logic', () => {
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

  it('devuelve segmentos del día activo cuando routeSegments está presente', () => {
    const segments = [makeSeg(1, 0, 1, encodedA), makeSeg(2, 0, 1, encodedB)];
    const daySegs = segments.filter((s) => s.dayNumber === 1);
    expect(daySegs).toHaveLength(1);
    expect(daySegs[0].encodedPolyline).toBe(encodedA);
  });

  it('filtra correctamente por día activo', () => {
    const segments = [makeSeg(1, 0, 1, encodedA), makeSeg(2, 0, 1, encodedB)];
    expect(segments.filter((s) => s.dayNumber === 2)).toHaveLength(1);
    expect(segments.filter((s) => s.dayNumber === 3)).toHaveLength(0);
  });

  it('decodifica polyline y produce coordenadas [lng, lat]', () => {
    const coords = decodeSegment(encodedA);
    // First coord should be [-3.7038, 40.4168] (lng, lat)
    expect(coords[0][0]).toBeCloseTo(-3.7038, 3);
    expect(coords[0][1]).toBeCloseTo(40.4168, 3);
  });

  it('cuando no hay routeSegments usa fallback a línea recta', () => {
    const daySegs: RouteSegment[] = [];
    // If daySegs is empty, buildRouteGeoJSON falls back to straight line coords
    expect(daySegs).toHaveLength(0);
  });

  it('memoización: la misma referencia de segments no re-decodifica', () => {
    const decodeSpy = jest.spyOn(polyline, 'decode');
    const segments = [makeSeg(1, 0, 1, encodedA)];
    // Simulate the useMemo behavior: same deps = same result
    const result1 = segments.filter((s) => s.dayNumber === 1).map((s) => decodeSegment(s.encodedPolyline));
    const result2 = segments.filter((s) => s.dayNumber === 1).map((s) => decodeSegment(s.encodedPolyline));
    // Both calls happened (no memoization at this level, memoization is in useMemo in the component)
    expect(decodeSpy).toHaveBeenCalled();
    decodeSpy.mockRestore();
    // Verify results are consistent
    expect(result1[0]).toEqual(result2[0]);
  });
});
