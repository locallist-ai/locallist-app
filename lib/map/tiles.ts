// Configuración del basemap ENV-CONDICIONAL.
//
// LocalList tiene un basemap vectorial auto-hospedado (Protomaps + PMTiles en
// Cloudflare R2, servido por un Worker en `tiles.locallist.ai`; ver el repo
// `locallist-tiles`. Ese basemap habilita descargas OFFLINE por plan
// (`OfflineManager`). Pero la infra AÚN no está desplegada, así que TODO el
// camino de nuestros tiles se enciende solo cuando `EXPO_PUBLIC_TILES_URL` está
// definida:
//
//   - definida  → usamos NUESTRO estilo Protomaps y habilitamos packs offline.
//   - sin definir → basemap online de OpenFreeMap (comportamiento actual), sin
//     packs. Es lo que corre HOY, sin ninguna dependencia de la infra.
//
// `process.env.EXPO_PUBLIC_TILES_URL` se lee EN CADA LLAMADA (no cacheada a
// nivel de módulo) para que sea testeable con `process.env` mutable, igual que
// `lib/helpers/photo-url.ts` con `EXPO_PUBLIC_API_URL`.

/**
 * Estilo online de fallback (comportamiento previo a este cambio). Se usa
 * cuando NO hay `EXPO_PUBLIC_TILES_URL`.
 */
export const ONLINE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Fichero de estilo generado que sirve el Worker (mismo nombre que produce
 * `scripts/build-style.mjs` en el repo de infra: `assets/style/miami-light.json`).
 * Miami es la única ciudad de lanzamiento.
 */
export const STYLE_FILENAME = 'miami-light.json';

/** Copyright de OpenStreetMap; se abre in-app con expo-web-browser (no Linking). */
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/**
 * Atribución visible cuando pintamos NUESTROS tiles.
 *
 * Los datos son OpenStreetMap (ODbL): `© OpenStreetMap contributors` es
 * OBLIGATORIO legalmente. La cartografía del basemap es Protomaps (BSD/CC0, no
 * exige crédito pero es cortés dárselo). Ver `ATTRIBUTION.md` del repo de infra
 * (`locallist-tiles`), que es la fuente de verdad de la obligación de licencia:
 * el stack es Protomaps, NO OpenMapTiles, así que atribuimos a Protomaps.
 */
export const ATTRIBUTION_OURS = '© OpenStreetMap contributors · Basemap © Protomaps';

/** Atribución del basemap online de OpenFreeMap (fallback). */
export const ATTRIBUTION_ONLINE = '© OpenStreetMap';

/** Lee y normaliza `EXPO_PUBLIC_TILES_URL` (sin barra final). `null` si no está. */
export function getTilesBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_TILES_URL;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

/** True cuando la infra de tiles está configurada (basemap propio + offline). */
export function tilesEnabled(): boolean {
  return getTilesBaseUrl() !== null;
}

/**
 * URL del estilo MapLibre a usar en `MapView.mapStyle` y en
 * `OfflineManager.createPack({ styleURL })`:
 *   - con infra → `${EXPO_PUBLIC_TILES_URL}/styles/miami-light.json`
 *   - sin infra → estilo online de OpenFreeMap
 *
 * Usar la MISMA URL para el render y para el pack es intencional: el pack offline
 * descarga y cachea el estilo + los recursos que referencia (tiles/glyphs/sprites)
 * por su URL, de modo que el `MapView` los resuelve luego desde el store offline.
 */
export function mapStyleURL(): string {
  const base = getTilesBaseUrl();
  return base ? `${base}/styles/${STYLE_FILENAME}` : ONLINE_STYLE_URL;
}

/** Atribución visible según el basemap activo. */
export function mapAttribution(): string {
  return tilesEnabled() ? ATTRIBUTION_OURS : ATTRIBUTION_ONLINE;
}
