/**
 * Divide la línea de ruta del día activo en dos colecciones: lo YA recorrido
 * (hasta el stop activo, estilo atenuado) y lo PENDIENTE (estilo destacado).
 * Puro y testeable; PlanMap lo pinta como dos LineLayer.
 */
import polyline from '@mapbox/polyline';
import type { RouteSegment } from '../types';

export interface SplitStop {
  latitude: number;
  longitude: number;
  /** orderIndex del stop en el plan; si falta se usa la posición en el array. */
  orderIndex?: number;
}

export interface RouteSplit {
  traveled: GeoJSON.FeatureCollection;
  upcoming: GeoJSON.FeatureCollection;
}

const emptyFC = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

const lineFeature = (coordinates: [number, number][]): GeoJSON.Feature => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates },
  properties: {},
});

const lineFC = (coordinates: [number, number][]): GeoJSON.FeatureCollection =>
  coordinates.length >= 2
    ? { type: 'FeatureCollection', features: [lineFeature(coordinates)] }
    : emptyFC();

/** Índice del stop activo dentro del array (por orderIndex, con clamp). */
function resolveActiveIndex(stops: SplitStop[], activeOrderIndex: number): number {
  const byOrder = stops.findIndex((s) => s.orderIndex === activeOrderIndex);
  if (byOrder >= 0) return byOrder;
  return Math.max(0, Math.min(stops.length - 1, activeOrderIndex));
}

export function splitRouteGeoJSON(
  stops: SplitStop[],
  routeSegments: RouteSegment[] | undefined,
  activeDayNumber: number | undefined,
  activeOrderIndex: number,
): RouteSplit {
  const daySegments = (routeSegments ?? []).filter(
    (s) => activeDayNumber === undefined || s.dayNumber === activeDayNumber,
  );

  if (daySegments.length > 0) {
    const traveled = emptyFC();
    const upcoming = emptyFC();
    for (const seg of daySegments) {
      const coords = polyline
        .decode(seg.encodedPolyline, 6)
        .map(([lat, lng]) => [lng, lat] as [number, number]);
      const feature = lineFeature(coords);
      // Un segmento está recorrido cuando su stop DESTINO ya se ha alcanzado
      // (llegaste al stop activo => el tramo que termina en el o antes es pasado).
      if (seg.toOrderIndex <= activeOrderIndex) {
        traveled.features.push(feature);
      } else {
        upcoming.features.push(feature);
      }
    }
    return { traveled, upcoming };
  }

  // Fallback línea recta: parte la polyline de stops en el stop activo. El punto
  // de corte se incluye en AMBOS tramos para que la línea quede continua.
  const coords = stops.map((s) => [s.longitude, s.latitude] as [number, number]);
  if (coords.length < 2) return { traveled: emptyFC(), upcoming: emptyFC() };

  const activeIdx = resolveActiveIndex(stops, activeOrderIndex);
  return {
    traveled: lineFC(coords.slice(0, activeIdx + 1)),
    upcoming: lineFC(coords.slice(activeIdx)),
  };
}
