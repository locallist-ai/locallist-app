// Wrapper PURO y testeable sobre `OfflineManager` de maplibre-react-native para
// packs offline por plan.
//
// El basemap propio (`tiles.locallist.ai`, Protomaps/PMTiles) permite empaquetar
// una región offline por plan con `OfflineManager.createPack`. La API JS vive en
// el módulo maplibre YA compilado en el binario, así que NO hace falta rebuild;
// aun así cargamos el manager de forma perezosa+guardada (mismo patrón que
// `lib/map/location-module.ts`) para (a) poder mockearlo en tests sin device y
// (b) degradar con elegancia si el módulo o el submódulo offline no existieran.
//
// Verificaciones que SOLO se pueden confirmar en device con la infra desplegada
// (documentadas en el reporte): que el pack captura glyphs+sprites, render 100%
// offline en airplane-mode, tamaño real del pmtiles y que los `.pbf` no van
// doble-gzip.

import { logger } from '../logger';
import { mapStyleURL, tilesEnabled } from './tiles';

/** Coordenada mínima que necesita `computeBounds` (subset de un stop del plan). */
export interface OfflineStop {
  latitude: number;
  longitude: number;
}

/** BBox en el formato ne/sw (igual que `lib/map/camera.ts`). */
export interface PackBounds {
  ne: [number, number]; // [lng, lat]
  sw: [number, number]; // [lng, lat]
}

export interface PackInfo {
  name: string;
  planId: string | null;
  createdAt: number;
}

/** Resultado de `ensurePack`. */
export type EnsurePackResult =
  | 'created' // pack nuevo, descarga en curso
  | 'exists' // ya existía (no se recrea)
  | 'disabled' // sin `EXPO_PUBLIC_TILES_URL` (basemap online, sin offline)
  | 'unavailable' // módulo nativo offline ausente
  | 'error'; // createPack lanzó

// z0-15 sobre el bbox de Miami ≈ 1108 tiles (spike del repo de infra), muy por
// debajo del techo nativo (~6000). maxZoom ≤ 15 + bbox ceñido mantiene los packs
// pequeños; 3 packs ≈ 3.3k tiles, dentro del límite global.
export const PACK_MIN_ZOOM = 0;
export const PACK_MAX_ZOOM = 15;
export const TILE_COUNT_LIMIT = 6000;
export const DEFAULT_MAX_PACKS = 3;
/** Padding por defecto del bbox (km) para no cortar el mapa en los bordes. */
export const PACK_PADDING_KM = 2;

const PACK_PREFIX = 'plan-';

/** Nombre canónico del pack de un plan. */
export function packName(planId: string): string {
  return `${PACK_PREFIX}${planId}`;
}

// ---- carga perezosa+guardada del OfflineManager -------------------------------

export type OfflinePackStatusLike = {
  name: string;
  state: number;
  percentage: number;
  completedResourceCount: number;
  requiredResourceCount: number;
};

export type OfflinePackLike = {
  readonly name: string | null;
  readonly metadata: Record<string, unknown> | null;
  status(): Promise<OfflinePackStatusLike>;
};

export type PackProgressListener = (pack: OfflinePackLike, status: OfflinePackStatusLike) => void;
export type PackErrorListener = (pack: OfflinePackLike, err: { name: string; message: string }) => void;

export interface OfflineManagerLike {
  createPack(
    options: {
      name: string;
      styleURL: string;
      bounds: [[number, number], [number, number]];
      minZoom?: number;
      maxZoom?: number;
      metadata?: Record<string, unknown>;
    },
    progressListener: PackProgressListener,
    errorListener: PackErrorListener,
  ): Promise<void>;
  getPacks(): Promise<OfflinePackLike[]>;
  getPack(name: string): Promise<OfflinePackLike | undefined>;
  deletePack(name: string): Promise<void>;
  setTileCountLimit(limit: number): void;
  subscribe(
    name: string,
    progressListener: PackProgressListener,
    errorListener: PackErrorListener,
  ): Promise<void>;
  unsubscribe(name: string): void;
}

/** undefined = aún no intentado; null = no disponible en este binario. */
let cachedManager: OfflineManagerLike | null | undefined;

export function getOfflineManager(): OfflineManagerLike | null {
  if (cachedManager === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@maplibre/maplibre-react-native') as {
        OfflineManager?: OfflineManagerLike;
      };
      cachedManager = mod.OfflineManager ?? null;
      if (!cachedManager) {
        logger.warn('offline packs: OfflineManager missing from maplibre module, offline disabled');
      }
    } catch (err) {
      logger.warn('offline packs: maplibre native module unavailable, offline disabled', err);
      cachedManager = null;
    }
  }
  return cachedManager;
}

/** Solo para tests: fuerza una nueva detección. */
export function resetOfflineManagerForTesting(): void {
  cachedManager = undefined;
}

// ---- geometría ----------------------------------------------------------------

const KM_PER_DEG_LAT = 111.32;
const MAX_WEB_MERCATOR_LAT = 85; // MapLibre no proyecta más allá de ±85°.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * BBox (ne/sw) que cubre todos los stops del plan con `paddingKm` de margen.
 * `null` si no hay stops. El padding en longitud se escala por la latitud (los
 * meridianos se juntan hacia los polos). Se recorta a rangos web-mercator
 * válidos para que `createPack` no reciba coordenadas fuera de proyección.
 */
export function computeBounds(
  stops: OfflineStop[],
  paddingKm: number = PACK_PADDING_KM,
): PackBounds | null {
  if (stops.length === 0) return null;

  let minLat = stops[0].latitude;
  let maxLat = stops[0].latitude;
  let minLng = stops[0].longitude;
  let maxLng = stops[0].longitude;
  for (const s of stops) {
    minLat = Math.min(minLat, s.latitude);
    maxLat = Math.max(maxLat, s.latitude);
    minLng = Math.min(minLng, s.longitude);
    maxLng = Math.max(maxLng, s.longitude);
  }

  const latPad = paddingKm / KM_PER_DEG_LAT;
  const midLat = (minLat + maxLat) / 2;
  // cos(lat) ~ 0 cerca de los polos: evita dividir por ~0 (padding lng enorme).
  const cosLat = Math.max(Math.cos((midLat * Math.PI) / 180), 0.01);
  const lngPad = paddingKm / (KM_PER_DEG_LAT * cosLat);

  return {
    ne: [clamp(maxLng + lngPad, -180, 180), clamp(maxLat + latPad, -MAX_WEB_MERCATOR_LAT, MAX_WEB_MERCATOR_LAT)],
    sw: [clamp(minLng - lngPad, -180, 180), clamp(minLat - latPad, -MAX_WEB_MERCATOR_LAT, MAX_WEB_MERCATOR_LAT)],
  };
}

/** ne/sw → el par `[[neLng,neLat],[swLng,swLat]]` que espera `createPack`. */
export function toCreatePackBounds(bounds: PackBounds): [[number, number], [number, number]] {
  return [bounds.ne, bounds.sw];
}

// ---- operaciones sobre packs --------------------------------------------------

const NO_OP_PROGRESS: PackProgressListener = () => {};
const NO_OP_ERROR: PackErrorListener = () => {};

/**
 * Asegura el pack offline del plan. Idempotente: si ya existe no lo recrea.
 * Llama `setTileCountLimit` EXPLÍCITO antes de `createPack` (contrato del spike).
 * Degrada sin lanzar: devuelve un status que el caller usa para caer a online.
 */
export async function ensurePack(
  planId: string,
  bounds: PackBounds,
  listeners?: { onProgress?: PackProgressListener; onError?: PackErrorListener },
): Promise<EnsurePackResult> {
  if (!tilesEnabled()) return 'disabled';
  const manager = getOfflineManager();
  if (!manager) return 'unavailable';

  const name = packName(planId);
  const onProgress = listeners?.onProgress ?? NO_OP_PROGRESS;
  const onError = listeners?.onError ?? NO_OP_ERROR;

  try {
    const existing = await manager.getPack(name).catch(() => undefined);
    if (existing) {
      // Re-suscribe para recibir el status actual (descarga en curso o completa).
      await manager.subscribe(name, onProgress, onError).catch(() => undefined);
      return 'exists';
    }

    // Techo de tiles EXPLÍCITO antes de crear (spike: z0-15 Miami ≈ 1108 tiles).
    manager.setTileCountLimit(TILE_COUNT_LIMIT);

    await manager.createPack(
      {
        name,
        styleURL: mapStyleURL(),
        bounds: toCreatePackBounds(bounds),
        minZoom: PACK_MIN_ZOOM,
        maxZoom: PACK_MAX_ZOOM,
        metadata: { planId, createdAt: Date.now() },
      },
      onProgress,
      onError,
    );
    return 'created';
  } catch (err) {
    logger.warn('offline packs: ensurePack failed, falling back to online', err);
    return 'error';
  }
}

/** Lista SOLO nuestros packs (`plan-*`), con planId/createdAt de su metadata. */
export async function listPacks(): Promise<PackInfo[]> {
  const manager = getOfflineManager();
  if (!manager) return [];
  const packs = await manager.getPacks().catch(() => [] as OfflinePackLike[]);
  return packs
    .filter((p) => typeof p.name === 'string' && p.name.startsWith(PACK_PREFIX))
    .map((p) => {
      const meta = p.metadata ?? {};
      const planId = typeof meta.planId === 'string' ? meta.planId : null;
      const createdAt = typeof meta.createdAt === 'number' ? meta.createdAt : 0;
      return { name: p.name as string, planId, createdAt };
    });
}

/** Status actual del pack de un plan (`null` si no existe o el módulo falta). */
export async function getPackStatus(planId: string): Promise<OfflinePackStatusLike | null> {
  const manager = getOfflineManager();
  if (!manager) return null;
  const pack = await manager.getPack(packName(planId)).catch(() => undefined);
  if (!pack) return null;
  return pack.status().catch(() => null);
}

/** Cancela las suscripciones de listeners del pack (llamar al desmontar). */
export function unsubscribePack(planId: string): void {
  const manager = getOfflineManager();
  if (manager) manager.unsubscribe(packName(planId));
}

/** Borra el pack de un plan (idempotente aguas abajo del nativo). */
export async function deletePack(planId: string): Promise<void> {
  const manager = getOfflineManager();
  if (!manager) return;
  await manager.deletePack(packName(planId)).catch((err) => {
    logger.warn('offline packs: deletePack failed', err);
  });
}

/**
 * Evicción LRU: conserva los `maxPacks` más recientes (por `metadata.createdAt`)
 * y borra los más viejos. Devuelve los nombres borrados. Cap por defecto = 3
 * planes.
 */
export async function evictLRU(maxPacks: number = DEFAULT_MAX_PACKS): Promise<string[]> {
  const manager = getOfflineManager();
  if (!manager) return [];
  const packs = await listPacks();
  if (packs.length <= maxPacks) return [];

  // createdAt ascendente = más viejo primero.
  const sorted = [...packs].sort((a, b) => a.createdAt - b.createdAt);
  const toDelete = sorted.slice(0, packs.length - maxPacks);
  const deleted: string[] = [];
  for (const pack of toDelete) {
    await manager.deletePack(pack.name).catch((err) => {
      logger.warn('offline packs: evictLRU delete failed', err);
    });
    deleted.push(pack.name);
  }
  return deleted;
}
