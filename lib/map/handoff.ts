/**
 * Constructores PUROS de URLs de handoff a apps de mapas para navegación
 * turn-by-turn (a pie) desde un Follow Mode activo. Es la ÚNICA excepción
 * autorizada a la regla stay-in-app (2026-06-12): handoff explícito a la app
 * de mapas del usuario.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type HandoffProvider = 'apple' | 'google' | 'geo';

export interface HandoffTarget {
  provider: HandoffProvider;
  url: string;
}

/**
 * Formatea una coordenada de forma estable para una URL: separador decimal `.`
 * (nunca la coma de un locale), precisión acotada a 6 decimales (~0.11 m) y sin
 * ceros de cola. Las coordenadas no finitas caen a 0 para no romper la URL.
 */
function formatCoord(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Number(value.toFixed(6)));
}

/** Apple Maps: destino + modo a pie (`dirflg=w`). */
export function buildAppleMapsUrl({ latitude, longitude }: LatLng): string {
  return `http://maps.apple.com/?daddr=${formatCoord(latitude)},${formatCoord(longitude)}&dirflg=w`;
}

/** Google Maps (scheme propio): destino + navegación a pie. */
export function buildGoogleMapsUrl({ latitude, longitude }: LatLng): string {
  return `comgooglemaps://?daddr=${formatCoord(latitude)},${formatCoord(longitude)}&directionsmode=walking`;
}

/** Fallback universal `geo:` (último recurso si falla el open del elegido). */
export function buildGeoUrl({ latitude, longitude }: LatLng): string {
  return `geo:${formatCoord(latitude)},${formatCoord(longitude)}`;
}

/**
 * Opciones que se ofrecen al usuario. Apple Maps SIEMPRE está disponible en
 * iOS; Google Maps solo se ofrece si la app está instalada (lo decide el caller
 * con `Linking.canOpenURL('comgooglemaps://')`).
 */
export function resolveHandoffTargets(coord: LatLng, googleAvailable: boolean): HandoffTarget[] {
  const targets: HandoffTarget[] = [{ provider: 'apple', url: buildAppleMapsUrl(coord) }];
  if (googleAvailable) {
    targets.push({ provider: 'google', url: buildGoogleMapsUrl(coord) });
  }
  return targets;
}
