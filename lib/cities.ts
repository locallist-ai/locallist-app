import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LiveCity } from './types';

export interface City {
  name: string;
  emoji: string;
  color: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
}

/**
 * Catálogo visual de ciudades (icono/color/emoji). NO es la fuente de verdad de
 * cobertura: el selector se construye desde `GET /cities/live` (allowlist del
 * backend). Esto solo aporta visuales por nombre y sirve de fallback offline
 * cuando la red falla. Mantener en sync con la allowlist `Coverage:LiveCities`.
 */
export const CITIES: City[] = [
  { name: 'Miami', emoji: '\u{1F334}', color: '#f97316', iconName: 'palm-tree' },
];

// Visual por defecto para una ciudad LIVE sin entrada en el catálogo: usamos
// icono (no emoji glyph) por consistencia con el brand.
const DEFAULT_CITY: Omit<City, 'name'> = {
  emoji: '\u{1F30D}',
  color: '#0ea5e9',
  iconName: 'map-marker',
};

/**
 * Resuelve una ciudad LIVE del backend a una `City` con visuales: usa la entrada
 * del catálogo si coincide el nombre (case-insensitive), o un visual por defecto.
 */
export function cityFromLive(live: Pick<LiveCity, 'name'>): City {
  const match = CITIES.find(
    (c) => c.name.toLowerCase() === live.name.toLowerCase(),
  );
  if (match) return match;
  return { name: live.name, ...DEFAULT_CITY };
}
