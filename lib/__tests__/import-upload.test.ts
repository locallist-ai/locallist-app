/**
 * Wiring XHR REAL de `importVideo` (lib/api): abort cooperativo y presupuesto
 * de timeout. El screen test mockea `importVideo` entero, así que este suite es
 * el único que verifica que un `AbortSignal` de verdad mata el XHR (nunca se
 * sigue subiendo 150 MB para una pantalla muerta) y que los eventos tardíos del
 * request moribundo no re-resuelven.
 */

// api.ts arrastra analytics → purchases (react-native-purchases, intransformable
// en jest) e i18n (expo-localization): se mockean igual que en el resto de suites.
jest.mock('../analytics', () => ({ trackPlanLimitIfGate403: jest.fn() }));
jest.mock('../i18n', () => ({ __esModule: true, default: { language: 'en' } }));
jest.mock('../safe-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('stored-token'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// ── XHR y FormData falsos ──

type Handler = (() => void) | null;

class MockXHR {
  static instances: MockXHR[] = [];

  method = '';
  url = '';
  headers: Record<string, string> = {};
  timeout = 0;
  status = 0;
  responseText = '';
  sent = false;
  abortCalls = 0;

  onload: Handler = null;
  onerror: Handler = null;
  ontimeout: Handler = null;
  onabort: Handler = null;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };

  constructor() {
    MockXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send() {
    this.sent = true;
  }

  abort() {
    this.abortCalls += 1;
    this.onabort?.();
  }

  respond(status: number, body: string) {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }
}

class MockFormData {
  parts: Array<[string, unknown]> = [];
  append(name: string, value: unknown) {
    this.parts.push([name, value]);
  }
}

(global as Record<string, unknown>).XMLHttpRequest = MockXHR as unknown;
(global as Record<string, unknown>).FormData = MockFormData as unknown;

process.env.EXPO_PUBLIC_API_URL = 'https://api.test';

// Require DESPUÉS de fijar el env y los globals: api.ts lee ambos al evaluarse.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { importVideo } = require('../api') as typeof import('../api');

const baseUpload = {
  fileUri: 'file:///v.mp4',
  fileName: 'v.mp4',
  mimeType: 'video/mp4',
};

async function xhrSpawned(): Promise<MockXHR> {
  // El await del token dentro de importVideo cede el event loop; esperamos a
  // que el XHR exista de verdad.
  for (let i = 0; i < 20 && MockXHR.instances.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
  expect(MockXHR.instances.length).toBeGreaterThan(0);
  return MockXHR.instances[MockXHR.instances.length - 1];
}

beforeEach(() => {
  MockXHR.instances = [];
  jest.clearAllMocks();
});

it('abortar el signal mata el XHR y resuelve "Request aborted" (status 0)', async () => {
  const controller = new AbortController();
  const promise = importVideo({ ...baseUpload, signal: controller.signal });
  const xhr = await xhrSpawned();
  expect(xhr.sent).toBe(true);

  controller.abort();

  const res = await promise;
  expect(xhr.abortCalls).toBe(1);
  expect(res.status).toBe(0);
  expect(res.error).toBe('Request aborted');
  expect(res.data).toBeNull();

  // Un onload tardío del request moribundo NO re-resuelve ni lanza.
  expect(() => xhr.respond(200, '{"candidates":[]}')).not.toThrow();
});

it('un signal ya abortado ni siquiera abre el XHR', async () => {
  const controller = new AbortController();
  controller.abort();
  const res = await importVideo({ ...baseUpload, signal: controller.signal });
  expect(res.status).toBe(0);
  expect(res.error).toBe('Request aborted');
  expect(MockXHR.instances.length).toBe(0);
});

it('presupuesto de timeout = 240s (subida 150MB + extracción no caben en 120s)', async () => {
  const promise = importVideo({ ...baseUpload });
  const xhr = await xhrSpawned();
  expect(xhr.timeout).toBe(240_000);
  expect(xhr.method).toBe('POST');
  expect(xhr.url).toBe('https://api.test/import/video?platform=self');
  expect(xhr.headers.Authorization).toBe('Bearer stored-token');

  xhr.respond(200, JSON.stringify({ candidates: [{ name: 'A' }] }));
  const res = await promise;
  expect(res.status).toBe(200);
  expect(res.data?.candidates).toHaveLength(1);
});

it('ontimeout resuelve status 0 "Request timed out" (el caller ofrece reintentar)', async () => {
  const promise = importVideo({ ...baseUpload });
  const xhr = await xhrSpawned();

  xhr.ontimeout?.();

  const res = await promise;
  expect(res.status).toBe(0);
  expect(res.error).toBe('Request timed out');
});
