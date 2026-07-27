/**
 * useImportUpload — behavioral coverage of the upload half of the import flow.
 * The picker + API are mocked; `lib/import/validate` and `import-errors` stay
 * REAL so the client validation and the error-code -> i18n-key mapping are
 * actually exercised. Each assertion fails against a plausible mutation of the
 * hook (wrong phase, dropped error case, missing abort).
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useImportUpload } from '../useImportUpload';
import { getAccessToken, importVideo } from '../../api';
import { pickVideo, isImagePickerAvailable } from '../native-picker';
import { track } from '../../analytics';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../analytics', () => ({ track: jest.fn() }));
jest.mock('../../api', () => ({
  getAccessToken: jest.fn(),
  importVideo: jest.fn(),
}));
jest.mock('../native-picker', () => ({
  pickVideo: jest.fn(),
  isImagePickerAvailable: jest.fn(() => true),
}));

const mockGetToken = getAccessToken as jest.Mock;
const mockImportVideo = importVideo as jest.Mock;
const mockPickVideo = pickVideo as jest.Mock;
const mockIsAvailable = isImagePickerAvailable as jest.Mock;
const mockTrack = track as jest.Mock;

const validAsset = {
  status: 'picked' as const,
  asset: {
    uri: 'file:///v.mp4',
    fileName: 'v.mp4',
    kind: 'video' as const,
    fileSize: 20 * 1024 * 1024,
    mimeType: 'video/mp4',
    durationMs: 60_000,
  },
};

const okUpload = {
  data: {
    candidates: [
      { name: 'Place A', matchedPlaceId: 'p1', matchedPlaceName: 'Place A', matchConfidence: 'high' },
      { name: 'Unknown Bar' },
    ],
    city: 'Miami',
  },
  error: null,
  errorBody: null,
  status: 200,
};

const setup = (platform: 'self' | 'tiktok' = 'self', creatorHandle = '') => {
  const presentGate = jest.fn();
  const view = renderHook(
    (props: { platform: 'self' | 'tiktok'; creatorHandle: string }) =>
      useImportUpload({ ...props, presentGate }),
    { initialProps: { platform, creatorHandle } },
  );
  return { ...view, presentGate };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailable.mockReturnValue(true);
  mockGetToken.mockResolvedValue('token');
});

it('éxito → fase pasa a results con candidatos + ciudad, y trackea uploaded', async () => {
  mockPickVideo.mockResolvedValue(validAsset);
  mockImportVideo.mockResolvedValue(okUpload);
  const { result } = setup();

  expect(result.current.phase).toBe('idle');
  await act(async () => {
    await result.current.chooseVideo();
  });

  await waitFor(() => expect(result.current.phase).toBe('results'));
  expect(result.current.candidates).toHaveLength(2);
  expect(result.current.city).toBe('Miami');
  expect(mockTrack).toHaveBeenCalledWith({
    event: 'import_video_uploaded',
    candidates: 2,
    matched: 1,
    platform: 'self',
    mediaKind: 'video',
  });
});

it('400 import_media_type_mismatch → errorKey dedicado, NO el genérico, vuelve a idle', async () => {
  mockPickVideo.mockResolvedValue(validAsset);
  mockImportVideo.mockResolvedValue({
    data: null,
    error: 'import_media_type_mismatch',
    errorBody: { error: 'import_media_type_mismatch' },
    status: 400,
  });
  const { result } = setup();

  await act(async () => {
    await result.current.chooseVideo();
  });

  await waitFor(() => expect(result.current.errorKey).toBe('import.errorMediaMismatch'));
  expect(result.current.phase).toBe('idle');
  // Non-vacuity: sin el case caería en errorGeneric.
  expect(result.current.errorKey).not.toBe('import.errorGeneric');
});

it('red caída (status 0) → errorKey genérico + retryable, y retry reutiliza el asset sin re-elegir', async () => {
  mockPickVideo.mockResolvedValue(validAsset);
  mockImportVideo
    .mockResolvedValueOnce({ data: null, error: 'Network error', errorBody: null, status: 0 })
    .mockResolvedValueOnce(okUpload);
  const { result } = setup();

  await act(async () => {
    await result.current.chooseVideo();
  });
  await waitFor(() => expect(result.current.errorKey).toBe('import.errorGeneric'));
  expect(result.current.retryable).toBe(true);

  await act(async () => {
    result.current.retry();
  });
  await waitFor(() => expect(result.current.phase).toBe('results'));
  expect(mockPickVideo).toHaveBeenCalledTimes(1);
  expect(mockImportVideo).toHaveBeenCalledTimes(2);
  expect(mockImportVideo.mock.calls[1][0].fileUri).toBe('file:///v.mp4');
});

it('validación cliente (>150MB) → errorKey sin llamada de red', async () => {
  mockPickVideo.mockResolvedValue({
    status: 'picked',
    asset: { ...validAsset.asset, fileSize: 200 * 1024 * 1024 },
  });
  const { result } = setup();

  await act(async () => {
    await result.current.chooseVideo();
  });

  await waitFor(() => expect(result.current.errorKey).toBe('import.errorTooLarge'));
  expect(mockImportVideo).not.toHaveBeenCalled();
});

it('invitado (sin token) → gate signup, sin abrir el picker', async () => {
  mockGetToken.mockResolvedValue(null);
  const { result, presentGate } = setup();

  await act(async () => {
    await result.current.chooseVideo();
  });

  expect(presentGate).toHaveBeenCalledWith({ type: 'signup_required' });
  expect(mockPickVideo).not.toHaveBeenCalled();
  expect(mockTrack).toHaveBeenCalledWith({ event: 'import_gate_hit', reason: 'signup' });
});

it('desmontar durante la subida aborta la petición en vuelo', async () => {
  mockPickVideo.mockResolvedValue(validAsset);
  let capturedSignal: AbortSignal | undefined;
  mockImportVideo.mockImplementation((opts: { signal?: AbortSignal }) => {
    capturedSignal = opts.signal;
    return new Promise(() => {});
  });
  const { result, unmount } = setup();

  await act(async () => {
    void result.current.chooseVideo();
  });
  await waitFor(() => expect(mockImportVideo).toHaveBeenCalled());
  expect(capturedSignal?.aborted).toBe(false);

  unmount();

  expect(capturedSignal?.aborted).toBe(true);
});
