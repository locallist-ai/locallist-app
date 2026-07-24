// Resuelve la URL de una foto de place servida por el proxy runtime del
// backend (T1-T4, ver locallist-api-net Shared/Dtos/PlacePhotoUrls). El
// backend sintetiza una URL absoluta cuando `Api:PublicBaseUrl` está
// configurada (prod/staging); si no (dev local por defecto), manda una ruta
// relativa tipo `/places/{id}/photos/0`. La app la resuelve contra su propia
// `EXPO_PUBLIC_API_URL` (misma base que usa lib/api.ts) para que sea
// perfectamente servible sin configurar nada en local.

const ABSOLUTE_URL_RE = /^https?:\/\//i;

/**
 * Devuelve una URL de foto lista para pasarle a `expo-image`:
 * - Absoluta (`http(s)://...`) → intacta.
 * - Relativa (empieza por `/`, p. ej. `/places/x/photos/0`) → resuelta contra
 *   `EXPO_PUBLIC_API_URL`.
 * - Cualquier otro caso (vacía, null, formato irreconocible, o relativa sin
 *   `EXPO_PUBLIC_API_URL` disponible) → `null`, para que el caller degrade a
 *   gradiente en vez de intentar cargar una URL rota.
 */
export function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (ABSOLUTE_URL_RE.test(url)) return url;
  if (!url.startsWith('/')) return null;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) return null;

  return `${apiUrl.replace(/\/+$/, '')}${url}`;
}

/** True si la URL (ya resuelta) es mostrable por expo-image (http/https). */
export function isDisplayablePhotoUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && ABSOLUTE_URL_RE.test(url);
}
