import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

export interface MapStop {
  latitude: number;
  longitude: number;
}

interface UseTilesCacheResult {
  tileUrl: string;
  isDownloading: boolean;
  hasCache: boolean;
}

const TILES_CACHE_DIR = `${FileSystem.cacheDirectory}maplibre-tiles/`;
const TILE_ZOOM_LEVELS = [12, 13, 14, 15, 16];

/**
 * Hook to manage offline tile caching for MapLibre
 * Downloads tiles for the bounding box of provided stops and caches them locally
 */
export const useOfflineTiles = (stops: MapStop[]): UseTilesCacheResult => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasCache, setHasCache] = useState(false);
  const [tileUrl, setTileUrl] = useState('https://tile.openstreetmap.org/{z}/{x}/{y}.png');

  useEffect(() => {
    if (stops.length === 0) return;

    const initializeTiles = async () => {
      try {
        // Check if cache dir exists
        const cacheInfo = await FileSystem.getInfoAsync(TILES_CACHE_DIR);
        if (cacheInfo.exists) {
          setHasCache(true);
          // Use local file:// URL for offline tiles
          setTileUrl(`file://${TILES_CACHE_DIR}{z}-{x}-{y}.png`);
          return;
        }

        // Create cache directory
        await FileSystem.makeDirectoryAsync(TILES_CACHE_DIR, {
          intermediates: true,
        });

        // Calculate bounding box
        const bounds = calculateBounds(stops);

        setIsDownloading(true);

        // Download tiles asynchronously (doesn't block UI)
        // Only download lower zoom levels to avoid huge storage
        const downloadZoomLevels = [12, 13, 14];

        for (const zoom of downloadZoomLevels) {
          const { x: minX, y: minY } = lngLatToTile(bounds.minLng, bounds.maxLat, zoom);
          const { x: maxX, y: maxY } = lngLatToTile(bounds.maxLng, bounds.minLat, zoom);

          // Limit tiles to avoid downloading too many (max 100 per zoom)
          const xRange = Math.min(maxX - minX + 1, 10);
          const yRange = Math.min(maxY - minY + 1, 10);

          for (let x = minX; x < minX + xRange; x++) {
            for (let y = minY; y < minY + yRange; y++) {
              try {
                const tileUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
                const filename = `${TILES_CACHE_DIR}${zoom}-${x}-${y}.png`;

                // Download tile (fire and forget, no await)
                FileSystem.downloadAsync(tileUrl, filename).catch(() => {
                  // Silently fail for individual tiles - network might be unreliable
                });
              } catch (_) {
                // Continue downloading other tiles
              }
            }
          }
        }

        setHasCache(true);
        setTileUrl(`file://${TILES_CACHE_DIR}{z}-{x}-{y}.png`);
      } catch (error) {
        console.warn('Failed to initialize offline tiles:', error);
        // Fall back to online tiles
        setTileUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
      } finally {
        setIsDownloading(false);
      }
    };

    initializeTiles();
  }, [stops]);

  return {
    tileUrl,
    isDownloading,
    hasCache,
  };
};

/**
 * Calculate bounding box from array of coordinates
 */
function calculateBounds(stops: MapStop[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = stops[0].latitude;
  let maxLat = stops[0].latitude;
  let minLng = stops[0].longitude;
  let maxLng = stops[0].longitude;

  stops.forEach((stop) => {
    minLat = Math.min(minLat, stop.latitude);
    maxLat = Math.max(maxLat, stop.latitude);
    minLng = Math.min(minLng, stop.longitude);
    maxLng = Math.max(maxLng, stop.longitude);
  });

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Convert lng/lat to Web Mercator tile coordinates
 */
function lngLatToTile(
  lng: number,
  lat: number,
  zoom: number
): { x: number; y: number } {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) /
        Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}
