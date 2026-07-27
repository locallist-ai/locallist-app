/**
 * Carga perezosa y GUARDADA de expo-image-picker.
 *
 * Igual que `lib/trial-reminder/native-module.ts`: expo-image-picker es un
 * módulo NATIVO que llama a `requireNativeModule(...)` al evaluar su JS. Un
 * import estático mataría la app en cualquier binario SIN el módulo nativo
 * (todos los dev clients previos al rebuild que añade esta dependencia). Por eso
 * el `require` vive dentro de una función, en try/catch, con el resultado
 * cacheado a nivel de módulo: una sola detección por proceso y TODO el flujo de
 * import degrada a un aviso "necesita actualización" en vez de un crash.
 */
import { logger } from '../logger';

export type ImagePickerModule = typeof import('expo-image-picker');

/** undefined = aún no intentado; null = no disponible en este binario. */
let cached: ImagePickerModule | null | undefined;

export function getImagePickerModule(): ImagePickerModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-image-picker') as ImagePickerModule;
    } catch (err) {
      logger.warn(
        'import: expo-image-picker native module unavailable (binary predates rebuild?), video import disabled',
        err,
      );
      cached = null;
    }
  }
  return cached;
}

export function isImagePickerAvailable(): boolean {
  return getImagePickerModule() !== null;
}

/** Solo para tests: fuerza una nueva detección. */
export function resetImagePickerModuleForTesting(): void {
  cached = undefined;
}

/** Tipo de medio elegido: la validación y la subida difieren (imagen no tiene duración). */
export type MediaKind = 'video' | 'image';

/**
 * Medio elegido por el usuario (vídeo O imagen), normalizado a lo que necesita
 * la subida/validación. `kind` decide qué límites aplica `validate.ts`.
 */
export type PickedVideo = {
  uri: string;
  fileName: string;
  /** Vídeo o imagen: gobierna límites (duración solo vídeo) y caps de tamaño. */
  kind: MediaKind;
  /** Bytes del asset (si el picker los da). null = desconocido. */
  fileSize: number | null;
  /** Mime del asset (si el picker lo da). null = desconocido. */
  mimeType: string | null;
  /** Duración en ms (si el picker la da). null = desconocido; siempre null en imagen. */
  durationMs: number | null;
};

export type PickVideoResult =
  /** El módulo nativo no está en este binario (dev client previo al rebuild). */
  | { status: 'unavailable' }
  /** El usuario canceló el picker. */
  | { status: 'canceled' }
  /** El usuario denegó el acceso a la fototeca. */
  | { status: 'denied' }
  | { status: 'picked'; asset: PickedVideo };

/**
 * Clasifica el asset del picker en `video` | `image`. Usa `type` (fiable en
 * iOS/Android); si falta, cae al prefijo del mime. Live photos y pairedVideo se
 * tratan como imagen/vídeo respectivamente. Por defecto vídeo (comportamiento
 * previo) cuando no hay ninguna señal.
 */
function deriveKind(type: string | null | undefined, mimeType: string | null): MediaKind {
  if (type === 'image' || type === 'livePhoto') return 'image';
  if (type === 'video' || type === 'pairedVideo') return 'video';
  const mime = mimeType?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return 'image';
  return 'video';
}

/** Deriva un nombre de fichero desde la uri cuando el picker no da `fileName`. */
function deriveFileName(uri: string, kind: MediaKind): string {
  const tail = uri.split('/').pop() ?? '';
  const clean = tail.split('?')[0];
  if (clean.length > 0) return clean;
  return kind === 'image' ? 'image.jpg' : 'video.mp4';
}

/**
 * Abre la fototeca para elegir UN vídeo O UNA imagen. Pide permiso de fototeca
 * primero (iOS). Guardado por `getImagePickerModule`: sin el módulo nativo
 * resuelve `unavailable` sin lanzar.
 */
export async function pickVideo(): Promise<PickVideoResult> {
  const mod = getImagePickerModule();
  if (!mod) return { status: 'unavailable' };

  const permission = await mod.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result = await mod.launchImageLibraryAsync({
    mediaTypes: ['videos', 'images'],
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { status: 'canceled' };
  }

  const a = result.assets[0];
  const mimeType = a.mimeType ?? null;
  const kind = deriveKind(a.type, mimeType);
  return {
    status: 'picked',
    asset: {
      uri: a.uri,
      fileName: a.fileName ?? deriveFileName(a.uri, kind),
      kind,
      fileSize: typeof a.fileSize === 'number' ? a.fileSize : null,
      mimeType,
      // Las imágenes no tienen duración; forzamos null para no arrastrar ruido.
      durationMs: kind === 'video' && typeof a.duration === 'number' ? a.duration : null,
    },
  };
}
