/**
 * useImportUpload — owns the upload half of the import flow (F2 T5).
 *
 * Holds the phase machine (`idle` -> `uploading` -> `analyzing` -> `results`),
 * the picked-asset refs and the multipart upload with progress + abort-on-unmount.
 * The screen orchestrator owns the attribution inputs (`platform`/`creatorHandle`)
 * and passes them in; the results half (selection + create) lives in the results
 * component. Kept as a hook so the phase transitions and error mapping are unit
 * testable without rendering the whole screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { track, type ImportPlatform } from '../analytics';
import { logger } from '../logger';
import { mapGateError, type GateAction } from '../gate-errors';
import { getAccessToken, importVideo } from '../api';
import { pickVideo, isImagePickerAvailable, type PickedVideo } from './native-picker';
import { validatePickedVideo, resolveUploadMime } from './validate';
import { importErrorKey, extractCode, sanitizeHandle, VALIDATION_KEY } from './import-errors';
import type { ImportCandidate } from '../types';

export type ImportPhase = 'idle' | 'uploading' | 'analyzing' | 'results';

export interface UseImportUploadArgs {
  /** Attribution: where the (self-uploaded) clip came from. `self` = own content. */
  platform: ImportPlatform;
  /** Optional creator credit for third-party clips (sanitised, never logged). */
  creatorHandle: string;
  /** Presents a gate (signup / upsell) as UI. From `useGateHandler`. */
  presentGate: (action: GateAction, opts?: { onDismiss?: () => void }) => unknown;
}

export interface UseImportUpload {
  phase: ImportPhase;
  progress: number;
  candidates: ImportCandidate[];
  city: string | null;
  errorKey: string | null;
  /** The last upload failure is worth a retry that reuses the picked asset. */
  retryable: boolean;
  /** Opens the picker, validates and uploads. Re-entrancy guarded. */
  chooseVideo: () => Promise<void>;
  /** Re-uploads the last picked asset without re-picking. */
  retry: () => void;
}

export function useImportUpload({
  platform,
  creatorHandle,
  presentGate,
}: UseImportUploadArgs): UseImportUpload {
  const { t } = useTranslation();

  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [city, setCity] = useState<string | null>(null);
  // The last upload failure is worth a retry (network drop / timeout / 503):
  // gates and validation errors are not, re-firing them would just repeat.
  const [uploadRetryable, setUploadRetryable] = useState(false);

  // Synchronous re-entrancy guard: the token read below yields, so two taps in
  // the same frame must not both open the picker / fire two uploads.
  const busyRef = useRef(false);
  // Last picked asset, so a retryable failure can re-upload without re-picking.
  const lastAssetRef = useRef<PickedVideo | null>(null);
  // Abort the in-flight upload when the screen unmounts (iOS swipe-back during
  // uploading): never keep pushing up to 150 MB for a dead screen, and never
  // setState on an unmounted component.
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const doUpload = useCallback(
    async (asset: PickedVideo) => {
      lastAssetRef.current = asset;
      const controller = new AbortController();
      abortRef.current = controller;
      setErrorKey(null);
      setUploadRetryable(false);
      setProgress(0);
      setPhase('uploading');

      // Handle is attribution only, and only for third-party clips.
      const handle = platform !== 'self' ? sanitizeHandle(creatorHandle) || undefined : undefined;
      const res = await importVideo({
        fileUri: asset.uri,
        fileName: asset.fileName,
        mimeType: resolveUploadMime(asset),
        platform,
        creatorHandle: handle,
        signal: controller.signal,
        onProgress: (fraction) => {
          if (!mountedRef.current) return;
          setProgress(fraction);
          if (fraction >= 0.999) setPhase('analyzing');
        },
      });

      // Aborted (unmount) or unmounted while awaiting: drop the result, no setState.
      if (controller.signal.aborted || !mountedRef.current) return;

      if (res.data && res.data.candidates && res.data.candidates.length > 0) {
        const list = res.data.candidates;
        const matched = list.filter((c) => !!c.matchedPlaceId);
        setCandidates(list);
        setCity(res.data.city ?? null);
        setPhase('results');
        // `platform` + `mediaKind` are safe to log (attribution); the handle is NOT (PII).
        track({
          event: 'import_video_uploaded',
          candidates: list.length,
          matched: matched.length,
          platform,
          mediaKind: asset.kind,
        });
        return;
      }

      // Error (or an empty 200, treated as "no places"). Route gates to their
      // Alert; surface everything else as an inline banner back on the idle screen.
      const action = mapGateError(res.status, res.errorBody);
      if (action.type === 'signup_required') {
        track({ event: 'import_gate_hit', reason: 'signup' });
        presentGate(action);
        setPhase('idle');
        return;
      }
      if (action.type === 'upsell') {
        track({ event: 'import_gate_hit', reason: 'plus' });
        presentGate(action);
        setPhase('idle');
        return;
      }

      const code = extractCode(res.errorBody);
      if (res.status === 429 || code === 'import_limit_reached') {
        track({ event: 'import_gate_hit', reason: 'limit' });
      }
      const key = res.data ? 'import.errorNoPlaces' : importErrorKey(res.status, code);
      setErrorKey(key);
      // Network drop / timeout (status 0) and 503 are transient: offer a retry
      // that reuses the picked asset. Everything else needs a different video
      // or a different tier, retrying the same upload would just repeat it.
      setUploadRetryable(
        !res.data && (res.status === 0 || res.status === 503 || code === 'import_unavailable'),
      );
      setPhase('idle');
    },
    [presentGate, platform, creatorHandle],
  );

  const chooseVideo = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setErrorKey(null);

      // Guarded native module: no expo-image-picker in this binary → update notice.
      if (!isImagePickerAvailable()) {
        Alert.alert(t('import.updateNeededTitle'), t('import.updateNeededBody'), [{ text: t('common.ok') }]);
        return;
      }

      // Guest gate: no token → prompt signup before opening the picker (mirrors
      // the wizard: gate on TOKEN PRESENCE, never on a possibly-stale `user`).
      const token = await getAccessToken();
      if (!token) {
        track({ event: 'import_gate_hit', reason: 'signup' });
        presentGate({ type: 'signup_required' });
        return;
      }

      const picked = await pickVideo();
      if (picked.status === 'unavailable') {
        Alert.alert(t('import.updateNeededTitle'), t('import.updateNeededBody'), [{ text: t('common.ok') }]);
        return;
      }
      if (picked.status === 'denied') {
        Alert.alert(t('import.permissionDeniedTitle'), t('import.permissionDeniedBody'), [{ text: t('common.ok') }]);
        return;
      }
      if (picked.status === 'canceled') return;

      // `mediaKind` is only known once the user picked a video OR an image, so
      // the "started" signal fires here (not on tap): a real import began.
      track({ event: 'import_video_started', platform, mediaKind: picked.asset.kind });

      // Client validation BEFORE the network: reject known violations for free.
      const invalid = validatePickedVideo(picked.asset);
      if (invalid) {
        setErrorKey(VALIDATION_KEY[invalid]);
        return;
      }

      await doUpload(picked.asset);
    } catch (err) {
      logger.error('import: choose/upload failed', err);
      setErrorKey('import.errorGeneric');
      setPhase('idle');
    } finally {
      busyRef.current = false;
    }
  }, [t, presentGate, doUpload, platform]);

  const retry = useCallback(() => {
    const asset = lastAssetRef.current;
    if (asset) void doUpload(asset);
  }, [doUpload]);

  const retryable = uploadRetryable && lastAssetRef.current !== null;

  return { phase, progress, candidates, city, errorKey, retryable, chooseVideo, retry };
}
