/**
 * Import-from-video screen (F2 T5) — behavioral coverage with the picker + API
 * mocked. `mapGateError` and `lib/import/validate` stay REAL so the gate mapping
 * and the client-side validation are actually exercised.
 *
 * Covers: native module missing → notice (no crash), client validation blocks
 * the upload with no network, guest → signup gate, free → Plus upsell mapping,
 * success → candidates painted (matches preselected, non-matched not selectable),
 * confirm → correct /import/plan call + navigation, and 429/422/503 messages.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import ImportVideoScreen from '../import-video';
import { getAccessToken, importVideo, createImportPlan } from '../../../lib/api';
import { pickVideo, isImagePickerAvailable } from '../../../lib/import/native-picker';
import { track } from '../../../lib/analytics';

// ── Mocks ──
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPresentGate = jest.fn();
jest.mock('../../../lib/useGateHandler', () => ({
  useGateHandler: () => ({ presentGate: mockPresentGate, presentClamped: jest.fn() }),
}));
jest.mock('../../../lib/auth', () => ({ useAuth: jest.fn(() => ({ isPro: false })) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/api', () => ({
  getAccessToken: jest.fn(),
  importVideo: jest.fn(),
  createImportPlan: jest.fn(),
}));
jest.mock('../../../lib/import/native-picker', () => ({
  pickVideo: jest.fn(),
  isImagePickerAvailable: jest.fn(() => true),
}));
// Keep the tier caps deterministic without pulling PNG assets / haptics.
jest.mock('../../../components/home/constants', () => ({
  maxDaysForTier: (isPro: boolean) => (isPro ? 14 : 3),
  PLUS_MAX_DAYS: 14,
  FREE_MAX_DAYS: 3,
}));

const mockGetToken = getAccessToken as jest.Mock;
const mockImportVideo = importVideo as jest.Mock;
const mockCreatePlan = createImportPlan as jest.Mock;
const mockPickVideo = pickVideo as jest.Mock;
const mockIsAvailable = isImagePickerAvailable as jest.Mock;
const mockTrack = track as jest.Mock;

const validAsset = {
  status: 'picked' as const,
  asset: {
    uri: 'file:///v.mp4',
    fileName: 'v.mp4',
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

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailable.mockReturnValue(true);
  mockGetToken.mockResolvedValue('token');
});

describe('import-video — picker + gates', () => {
  it('(a) sin módulo nativo → aviso "update needed" sin subir ni crashear', async () => {
    mockIsAvailable.mockReturnValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'import.updateNeededTitle',
        'import.updateNeededBody',
        expect.anything(),
      ),
    );
    expect(mockPickVideo).not.toHaveBeenCalled();
    expect(mockImportVideo).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('(b) validación cliente rechaza >150MB SIN llamada de red', async () => {
    mockPickVideo.mockResolvedValue({
      status: 'picked',
      asset: { ...validAsset.asset, fileSize: 200 * 1024 * 1024 },
    });
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() => expect(screen.getByText('import.errorTooLarge')).toBeTruthy());
    expect(mockImportVideo).not.toHaveBeenCalled();
  });

  it('(b2) validación cliente rechaza formato no soportado SIN red', async () => {
    mockPickVideo.mockResolvedValue({
      status: 'picked',
      asset: { ...validAsset.asset, fileName: 'clip.txt', mimeType: 'text/plain' },
    });
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() => expect(screen.getByText('import.errorUnsupported')).toBeTruthy());
    expect(mockImportVideo).not.toHaveBeenCalled();
  });

  it('(c) invitado (sin token) → gate signup, sin abrir el picker', async () => {
    mockGetToken.mockResolvedValue(null);
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() =>
      expect(mockPresentGate).toHaveBeenCalledWith({ type: 'signup_required' }),
    );
    expect(mockPickVideo).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith({ event: 'import_gate_hit', reason: 'signup' });
  });

  it('(c2) free → upsell Plus mapeado desde 403 import_requires_plus', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue({
      data: null,
      error: 'import_requires_plus',
      errorBody: { error: 'import_requires_plus' },
      status: 403,
    });
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() =>
      expect(mockPresentGate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'upsell', code: 'import_requires_plus' }),
      ),
    );
    expect(mockTrack).toHaveBeenCalledWith({ event: 'import_gate_hit', reason: 'plus' });
  });
});

describe('import-video — resultados y creación', () => {
  it('(d) éxito → candidatos pintados, match preseleccionado, no-match no seleccionable', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue(okUpload);
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() => expect(screen.getByText('Place A')).toBeTruthy());
    // Non-matched candidate visible for honesty.
    expect(screen.getByText('Unknown Bar')).toBeTruthy();
    expect(screen.getByText('import.notOnLocalList')).toBeTruthy();
    expect(screen.getByText('import.matchedBadgeHigh')).toBeTruthy();

    // Matched row preselected; non-matched row disabled (not selectable).
    const matched = screen.getByTestId('candidate-0');
    const unmatched = screen.getByTestId('candidate-1');
    expect(matched.props.accessibilityState.checked).toBe(true);
    expect(unmatched.props.accessibilityState.disabled).toBe(true);

    expect(mockTrack).toHaveBeenCalledWith({
      event: 'import_video_uploaded',
      candidates: 2,
      matched: 1,
      platform: 'self',
    });
  });

  it('(e) confirmar → POST /import/plan con los ids seleccionados + navega al plan', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue(okUpload);
    mockCreatePlan.mockResolvedValue({ data: { id: 'plan-123' }, error: null, errorBody: null, status: 200 });
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));
    await waitFor(() => expect(screen.getByTestId('import-create')).toBeTruthy());

    fireEvent.press(screen.getByTestId('import-create'));

    await waitFor(() =>
      expect(mockCreatePlan).toHaveBeenCalledWith({
        city: 'Miami',
        days: 1,
        placeIds: ['p1'],
        planName: undefined,
        platform: 'self',
      }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/plan/plan-123'));
    expect(mockTrack).toHaveBeenCalledWith({ event: 'import_plan_created', places: 1 });
  });

  it('(e2) deseleccionar el único match deshabilita crear y explica por qué', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue(okUpload);
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));
    await waitFor(() => expect(screen.getByTestId('candidate-0')).toBeTruthy());

    fireEvent.press(screen.getByTestId('candidate-0')); // deselect the only match
    await waitFor(() =>
      expect(screen.getByTestId('import-create').props.accessibilityState.disabled).toBe(true),
    );
    // Hint under the button: the grey button never goes unexplained.
    expect(screen.getByText('import.selectAtLeastOne')).toBeTruthy();
  });
});

describe('import-video — abort y reintento de red', () => {
  it('aborta la subida al desmontar (swipe-back iOS durante uploading)', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    let capturedSignal: AbortSignal | undefined;
    // Upload never settles: the screen dies mid-transfer.
    mockImportVideo.mockImplementation((opts: { signal?: AbortSignal }) => {
      capturedSignal = opts.signal;
      return new Promise(() => {});
    });
    const { unmount } = render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));
    await waitFor(() => expect(mockImportVideo).toHaveBeenCalled());
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    // The screen's unmount cleanup aborts the in-flight upload.
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('red caída (status 0) → mensaje CON reintentar que reutiliza el vídeo sin re-elegir', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo
      .mockResolvedValueOnce({ data: null, error: 'Network error', errorBody: null, status: 0 })
      .mockResolvedValueOnce(okUpload);
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-choose'));
    await waitFor(() => expect(screen.getByText('import.errorGeneric')).toBeTruthy());

    // Retry offered even though it's a generic network failure...
    fireEvent.press(screen.getByTestId('import-retry'));

    // ...and it re-uploads the SAME asset without reopening the picker.
    await waitFor(() => expect(screen.getByText('Place A')).toBeTruthy());
    expect(mockPickVideo).toHaveBeenCalledTimes(1);
    expect(mockImportVideo).toHaveBeenCalledTimes(2);
    expect(mockImportVideo.mock.calls[1][0].fileUri).toBe('file:///v.mp4');
  });
});

describe('import-video — errores de subida', () => {
  const uploadFails = async (status: number, code: string) => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue({ data: null, error: code, errorBody: { error: code }, status });
    render(<ImportVideoScreen />);
    fireEvent.press(screen.getByTestId('import-choose'));
  };

  it('(f) 429 import_limit_reached → mensaje de límite + gate limit', async () => {
    await uploadFails(429, 'import_limit_reached');
    await waitFor(() => expect(screen.getByText('import.errorLimit')).toBeTruthy());
    expect(mockTrack).toHaveBeenCalledWith({ event: 'import_gate_hit', reason: 'limit' });
  });

  it('(f) 422 no_places_found → mensaje de "sin sitios"', async () => {
    await uploadFails(422, 'no_places_found');
    await waitFor(() => expect(screen.getByText('import.errorNoPlaces')).toBeTruthy());
  });

  it('(f) 503 import_unavailable → mensaje + botón reintentar', async () => {
    await uploadFails(503, 'import_unavailable');
    await waitFor(() => expect(screen.getByText('import.errorUnavailable')).toBeTruthy());
    expect(screen.getByTestId('import-retry')).toBeTruthy();
  });
});

describe('import-video — atribución de plataforma', () => {
  it('(a) self por defecto → sin disclaimer ni handle, sube con platform=self', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue(okUpload);
    render(<ImportVideoScreen />);

    // 'self' is preselected: no third-party UI.
    expect(screen.queryByTestId('import-disclaimer')).toBeNull();
    expect(screen.queryByTestId('import-creator-handle')).toBeNull();

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() => expect(mockImportVideo).toHaveBeenCalled());
    const call = mockImportVideo.mock.calls[0][0];
    expect(call.platform).toBe('self');
    expect(call.creatorHandle).toBeUndefined();
    expect(mockTrack).toHaveBeenCalledWith({ event: 'import_video_started', platform: 'self' });
  });

  it('(b) elegir TikTok → disclaimer + campo handle visibles, sube con platform=tiktok&creatorHandle', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue(okUpload);
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-platform-tiktok'));

    // Disclaimer + optional handle appear only for third-party.
    expect(screen.getByTestId('import-disclaimer')).toBeTruthy();
    expect(screen.getByText('import.disclaimer')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('import-creator-handle'), '@localguide');

    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() => expect(mockImportVideo).toHaveBeenCalled());
    const call = mockImportVideo.mock.calls[0][0];
    expect(call.platform).toBe('tiktok');
    expect(call.creatorHandle).toBe('@localguide');
  });

  it('(e) analytics lleva platform pero NUNCA el handle (PII)', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue(okUpload);
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-platform-tiktok'));
    fireEvent.changeText(screen.getByTestId('import-creator-handle'), '@localguide');
    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith({ event: 'import_video_started', platform: 'tiktok' }),
    );
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith({
        event: 'import_video_uploaded',
        candidates: 2,
        matched: 1,
        platform: 'tiktok',
      }),
    );
    // No tracked event should carry the handle.
    const anyHandleLogged = mockTrack.mock.calls.some((c: unknown[]) =>
      JSON.stringify(c[0] ?? {}).includes('localguide'),
    );
    expect(anyHandleLogged).toBe(false);
  });

  it('(d) handle saneado: recorta espacios y aplica el tope de longitud', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue(okUpload);
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-platform-instagram'));
    // Surrounding whitespace trimmed; a 100-char handle capped to 64.
    fireEvent.changeText(screen.getByTestId('import-creator-handle'), `  ${'a'.repeat(100)}  `);
    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() => expect(mockImportVideo).toHaveBeenCalled());
    const call = mockImportVideo.mock.calls[0][0];
    expect(call.platform).toBe('instagram');
    expect(call.creatorHandle).toBe('a'.repeat(64));
  });

  it('(c) 403 third_party_import_disabled → mensaje "no disponible todavía" específico', async () => {
    mockPickVideo.mockResolvedValue(validAsset);
    mockImportVideo.mockResolvedValue({
      data: null,
      error: 'third_party_import_disabled',
      errorBody: { error: 'third_party_import_disabled' },
      status: 403,
    });
    render(<ImportVideoScreen />);

    fireEvent.press(screen.getByTestId('import-platform-tiktok'));
    fireEvent.press(screen.getByTestId('import-choose'));

    await waitFor(() => expect(screen.getByText('import.thirdPartyDisabled')).toBeTruthy());
    // Not a gate/upsell: the specific copy, not a generic error.
    expect(screen.queryByText('import.errorGeneric')).toBeNull();
  });
});
