/**
 * Pure helpers shared by the import flow (hook + results): backend error-code to
 * i18n-key mapping, client validation-error to i18n-key, handle sanitisation and
 * the error-body code extractor. Kept framework-free so both `useImportUpload`
 * (upload path) and `ImportResults` (create path) reuse the SAME mapping — a
 * single source of truth for every import error string.
 */
import type { VideoValidationError } from './validate';

/** The backend validates the handle with a strict regex; we only keep the client
 *  input sane (trim + hard cap) so we never send obvious garbage. */
export const MAX_HANDLE = 64;

export function sanitizeHandle(raw: string): string {
  return raw.trim().slice(0, MAX_HANDLE);
}

/** Backend error code to i18n key. Falls back on status, then generic. */
export function importErrorKey(status: number, code: string | null): string {
  switch (code) {
    case 'import_unsupported_format':
      return 'import.errorUnsupported';
    case 'import_too_large':
      return 'import.errorTooLarge';
    case 'import_video_too_long':
      return 'import.errorTooLong';
    case 'import_missing_file':
      return 'import.errorMissingFile';
    case 'import_invalid_request':
      return 'import.errorInvalidRequest';
    case 'no_places_found':
      return 'import.errorNoPlaces';
    case 'import_unavailable':
      return 'import.errorUnavailable';
    case 'import_limit_reached':
      return 'import.errorLimit';
    case 'third_party_import_disabled':
      return 'import.thirdPartyDisabled';
    case 'import_invalid_places':
      return 'import.errorInvalidPlaces';
    case 'import_too_many_places':
      return 'import.errorTooManyPlaces';
    case 'import_media_type_mismatch':
      return 'import.errorMediaMismatch';
    default:
      break;
  }
  if (status === 429) return 'import.errorLimit';
  if (status === 503) return 'import.errorUnavailable';
  return 'import.errorGeneric';
}

export const VALIDATION_KEY: Record<VideoValidationError, string> = {
  too_large: 'import.errorTooLarge',
  too_long: 'import.errorTooLong',
  unsupported_format: 'import.errorUnsupported',
};

export function extractCode(errorBody: unknown): string | null {
  const code = (errorBody as { error?: unknown } | null)?.error;
  return typeof code === 'string' ? code : null;
}
