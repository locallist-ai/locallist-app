/**
 * Validación cliente PURA del medio elegido, espejo de los límites del backend
 * (`POST /import/video`): vídeo 150 MB / 10 min (mp4·quicktime·webm) e imagen
 * 25 MB SIN duración (jpeg·png·webp·heic). Corre ANTES de subir para no gastar
 * red cuando el asset ya viola un límite conocido. El backend re-valida (fuente
 * de verdad); esto es un atajo, no la barrera.
 */
import type { PickedVideo } from './native-picker';

export const MAX_BYTES = 150 * 1024 * 1024; // 150 MB (vídeo)
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB (imagen, coherente con el backend)
export const MAX_DURATION_MS = 600 * 1000; // 10 min

/** Mimes de vídeo aceptados por el backend. */
export const ALLOWED_MIME: readonly string[] = ['video/mp4', 'video/quicktime', 'video/webm'];
/** Extensiones de vídeo aceptadas (fallback cuando el picker no da mime). */
export const ALLOWED_EXT: readonly string[] = ['mp4', 'mov', 'qt', 'webm'];

/** Mimes de imagen aceptados por el backend. */
export const ALLOWED_IMAGE_MIME: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];
/** Extensiones de imagen aceptadas (fallback cuando el picker no da mime). */
export const ALLOWED_IMAGE_EXT: readonly string[] = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

/** Mapa extensión → mime para construir la parte multipart cuando falta el mime. */
const EXT_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export type VideoValidationError = 'too_large' | 'too_long' | 'unsupported_format';

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return null;
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * Valida tamaño, duración y formato según el `kind` del asset. Devuelve el
 * primer error encontrado (en ese orden) o `null` si pasa. Para IMAGEN se salta
 * la duración (no tienen) y el cap de tamaño es 25 MB; para VÍDEO se conservan
 * 150 MB + 10 min. Campos desconocidos (null) NO bloquean: el backend re-valida,
 * y preferimos no rechazar por metadatos que el picker no expuso.
 */
export function validatePickedVideo(asset: PickedVideo): VideoValidationError | null {
  const isImage = asset.kind === 'image';
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_BYTES;
  if (asset.fileSize != null && asset.fileSize > maxBytes) return 'too_large';
  // La duración solo aplica a vídeo; las imágenes no la tienen.
  if (!isImage && asset.durationMs != null && asset.durationMs > MAX_DURATION_MS) return 'too_long';

  const allowedMime = isImage ? ALLOWED_IMAGE_MIME : ALLOWED_MIME;
  const allowedExt = isImage ? ALLOWED_IMAGE_EXT : ALLOWED_EXT;
  const mime = asset.mimeType?.toLowerCase() ?? null;
  const ext = extensionOf(asset.fileName);
  const mimeOk = mime != null && allowedMime.includes(mime);
  const extOk = ext != null && allowedExt.includes(ext);

  // Aceptamos si el mime es válido O (sin mime fiable) la extensión lo es.
  if (mimeOk || extOk) return null;
  return 'unsupported_format';
}

/**
 * Mime a enviar en la parte multipart: el del asset si es válido para su `kind`,
 * si no el derivado de la extensión, con un último recurso por tipo (`image/jpeg`
 * para imagen, `video/mp4` para vídeo).
 */
export function resolveUploadMime(asset: PickedVideo): string {
  const isImage = asset.kind === 'image';
  const allowedMime = isImage ? ALLOWED_IMAGE_MIME : ALLOWED_MIME;
  const mime = asset.mimeType?.toLowerCase() ?? null;
  if (mime && allowedMime.includes(mime)) return mime;
  const ext = extensionOf(asset.fileName);
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  return isImage ? 'image/jpeg' : 'video/mp4';
}
