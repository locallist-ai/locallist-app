import * as FileSystem from 'expo-file-system/legacy';
import { logger } from './logger';
import { TAXONOMY_FALLBACK, type TaxonomyData } from './taxonomy-fallback';
export type { TaxonomyData } from './taxonomy-fallback';

const CACHE_FILE = `${FileSystem.cacheDirectory}taxonomy_v1.json`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let memoryCache: TaxonomyData | null = null;
let lastEtag: string | null = null;

function getApiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? '';
}

export async function loadTaxonomy(): Promise<void> {
  if (memoryCache) return;

  // Try reading from file cache first
  try {
    const info = await FileSystem.getInfoAsync(CACHE_FILE);
    if (info.exists && info.modificationTime && Date.now() - info.modificationTime * 1000 < CACHE_TTL_MS) {
      const raw = await FileSystem.readAsStringAsync(CACHE_FILE);
      const parsed = JSON.parse(raw) as { data: TaxonomyData; etag?: string };
      memoryCache = parsed.data;
      lastEtag = parsed.etag ?? null;
      return;
    }
  } catch {
    // Fall through to network fetch
  }

  await refreshTaxonomy();
}

export async function refreshTaxonomy(): Promise<void> {
  const apiUrl = getApiUrl();
  if (!apiUrl) return;

  try {
    const headers: Record<string, string> = {};
    if (lastEtag) headers['If-None-Match'] = lastEtag;

    const res = await fetch(`${apiUrl}/taxonomy`, { headers });

    if (res.status === 304 && memoryCache) return; // still fresh

    if (!res.ok) {
      logger.warn('[taxonomy] fetch failed', { status: res.status });
      return;
    }

    const etag = res.headers.get('ETag') ?? undefined;
    const data = (await res.json()) as TaxonomyData;
    memoryCache = data;
    lastEtag = etag ?? null;

    await FileSystem.writeAsStringAsync(
      CACHE_FILE,
      JSON.stringify({ data, etag }),
    ).catch(() => {});
  } catch (err) {
    logger.warn('[taxonomy] network error', err);
  }
}

export function getTaxonomy(): TaxonomyData {
  return memoryCache ?? (TAXONOMY_FALLBACK as unknown as TaxonomyData);
}
