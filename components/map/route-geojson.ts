import polyline from '@mapbox/polyline';
import type { RouteSegment } from '../../lib/types';

export type RoutePoint = { latitude: number; longitude: number };

/**
 * Construye el GeoJSON de la línea de ruta del mapa. Si hay routeSegments del
 * backend (filtrados por día activo) decodifica sus polylines (precisión 6);
 * si no, cae a una línea recta entre los stops.
 */
export function buildRouteGeoJSON(
  stops: RoutePoint[],
  routeSegments?: RouteSegment[],
  activeDayNumber?: number,
): GeoJSON.GeoJSON {
  const daySegments = routeSegments?.filter(
    (s) => activeDayNumber === undefined || s.dayNumber === activeDayNumber,
  ) ?? [];

  if (daySegments.length > 0) {
    return {
      type: 'FeatureCollection',
      features: daySegments.map((seg) => {
        const coords = polyline
          .decode(seg.encodedPolyline, 6)
          .map(([lat, lng]) => [lng, lat] as [number, number]);
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: coords },
          properties: {},
        };
      }),
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: stops.map((stop) => [stop.longitude, stop.latitude]),
        },
        properties: {},
      },
    ],
  };
}
