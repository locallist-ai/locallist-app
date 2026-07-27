/**
 * Validación cliente PURA del vídeo elegido, espejo de los límites del backend
 * (`POST /import/video`): 150 MB, 10 min, mp4/quicktime/webm. Corre ANTES de
 * subir para no gastar red cuando el asset ya viola un límite conocido. El
 * backend re-valida (fuente de verdad); esto es un atajo, no la barrera.
 */
import type { PickedVideo } from './native-picker';

export const MAX_BYTES = 150 * 1024 * 1024; // 150 MB
export const MAX_DURATION_MS = 600 * 1000; // 10 min

/** Mimes aceptados por el backend. */
export const ALLOWED_MIME: readonly string[] = ['video/mp4', 'video/quicktime', 'video/webm'];
/** Extensiones aceptadas (fallback cuando el picker no da mime). */
export const ALLOWED_EXT: readonly string[] = ['mp4', 'mov', 'qt', 'webm'];

/** Mapa extensión → mime para construir la parte multipart cuando falta el mime. */
const EXT_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  webm: 'video/webm',
};

export type VideoValidationError = 'too_large' | 'too_long' | 'unsupported_format';

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return null;
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * Valida tamaño, duración y formato. Devuelve el primer error encontrado (en
 * ese orden) o `null` si pasa. Campos desconocidos (null) NO bloquean: el
 * backend re-valida, y preferimos no rechazar por metadatos que el picker no
 * expuso.
 */
export function validatePickedVideo(asset: PickedVideo): VideoValidationError | null {
  if (asset.fileSize != null && asset.fileSize > MAX_BYTES) return 'too_large';
  if (asset.durationMs != null && asset.durationMs > MAX_DURATION_MS) return 'too_long';

  const mime = asset.mimeType?.toLowerCase() ?? null;
  const ext = extensionOf(asset.fileName);
  const mimeOk = mime != null && ALLOWED_MIME.includes(mime);
  const extOk = ext != null && ALLOWED_EXT.includes(ext);

  // Aceptamos si el mime es válido O (sin mime fiable) la extensión lo es.
  if (mimeOk || extOk) return null;
  return 'unsupported_format';
}

/**
 * Mime a enviar en la parte multipart: el del asset si es válido, si no el
 * derivado de la extensión, con `video/mp4` como último recurso.
 */
export function resolveUploadMime(asset: PickedVideo): string {
  const mime = asset.mimeType?.toLowerCase() ?? null;
  if (mime && ALLOWED_MIME.includes(mime)) return mime;
  const ext = extensionOf(asset.fileName);
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  return 'video/mp4';
}
