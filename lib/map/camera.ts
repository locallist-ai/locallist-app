/**
 * Lógica PURA de cámara del mapa de Follow Mode: cálculo de bbox/centro y
 * resolución del objetivo de cámara según el modo. Extraído de `PlanMap` para
 * poder testear sin montar MapLibre.
 */

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  center: [number, number]; // [lng, lat]
  bounds?: { ne: [number, number]; sw: [number, number] };
}

/**
 * Modo de cámara:
 *  - 'stop': la cámara sigue al pin activo (comportamiento por defecto).
 *  - 'user': la cámara sigue el punto azul del usuario.
 *  - 'free': el usuario ha movido el mapa a mano; no le secuestramos la cámara
 *    hasta que pulse recentrar.
 */
export type CameraMode = 'stop' | 'user' | 'free';

/** Centro + bounds a partir de los stops (para el encuadre inicial). */
export function computeBounds(stops: MapPoint[]): MapBounds {
  if (stops.length === 0) {
    return { center: [0, 0] };
  }

  let minLat = stops[0].latitude;
  let maxLat = stops[0].latitude;
  let minLng = stops[0].longitude;
  let maxLng = stops[0].longitude;

  for (const stop of stops) {
    minLat = Math.min(minLat, stop.latitude);
    maxLat = Math.max(maxLat, stop.latitude);
    minLng = Math.min(minLng, stop.longitude);
    maxLng = Math.max(maxLng, stop.longitude);
  }

  return {
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    bounds: { ne: [maxLng, maxLat], sw: [minLng, minLat] },
  };
}

/**
 * Coordenada a la que debe volar la cámara para un modo dado. `null` = no mover
 * (modo libre). En 'user' sin ubicación disponible cae al stop activo.
 */
export function resolveCameraTarget(
  mode: CameraMode,
  opts: { userCoordinate: MapPoint | null; activeStop: MapPoint | null },
): MapPoint | null {
  if (mode === 'free') return null;
  if (mode === 'user') return opts.userCoordinate ?? opts.activeStop;
  return opts.activeStop;
}

/** Al pulsar recentrar: seguir al usuario si hay ubicación, si no al stop. */
export function recenterMode(hasUserLocation: boolean): CameraMode {
  return hasUserLocation ? 'user' : 'stop';
}
