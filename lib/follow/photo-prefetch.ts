// Prefetch silencioso de las fotos del DÍA ACTIVO de Follow Mode. Metemos en la
// caché de disco de expo-image (memory-disk) la foto que pinta cada StopCard
// (`place.photos[0]`, resuelta igual que PhotoHero) para que se vean offline si
// el usuario pierde la red más adelante. Solo el día actual (no todo el plan),
// sin bloquear la UI y tolerante a fallos: si no hay red, `Image.prefetch`
// simplemente no rellena la caché y no pasa nada.

import { Image } from 'expo-image';
import { logger } from '../logger';
import { resolvePhotoUrl, isDisplayablePhotoUrl } from '../helpers/photo-url';
import type { PlanStop } from '../types';

/** URLs mostrables (http/https) de la primera foto de cada stop, deduplicadas. */
export function dayPhotoUrls(stops: PlanStop[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const stop of stops) {
    const resolved = resolvePhotoUrl(stop.place?.photos?.[0]);
    if (isDisplayablePhotoUrl(resolved) && !seen.has(resolved)) {
      seen.add(resolved);
      urls.push(resolved);
    }
  }
  return urls;
}

/**
 * Dispara el prefetch de las fotos del día. Fire-and-forget: no devuelve promesa
 * ni bloquea; cada fallo se traga en silencio.
 */
export function prefetchDayPhotos(stops: PlanStop[]): void {
  const urls = dayPhotoUrls(stops);
  if (urls.length === 0) return;
  try {
    // expo-image acepta un array de urls; el prefetch es asíncrono y silencioso.
    void Promise.resolve(Image.prefetch(urls)).catch((err) => {
      logger.debug('photo-prefetch: prefetch falló (probablemente offline)', err);
    });
  } catch (err) {
    logger.debug('photo-prefetch: no se pudo iniciar el prefetch', err);
  }
}
