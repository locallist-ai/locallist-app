/**
 * mutation-queue — cola durable del `/complete` de Follow Mode. FS en memoria
 * (stateful) sobre `expo-file-system/legacy` para ejercitar la persistencia
 * real. Se prueba: durabilidad (resuelve solo tras escribir), no-duplicación,
 * supervivencia a fallo de red + drenado posterior, reglas idempotentes de
 * drop, flush reentrante-seguro y preservación de encolados concurrentes.
 *
 * No-vacuidad: `sobrevive a fallo de red y drena` falla si `shouldDrop` sacara
 * la mutación en status 0; `no duplica` falla sin el guard por id; `durabilidad`
 * falla si enqueue no esperara la escritura (evidenciado en el reporte).
 */
jest.mock('expo-file-system/legacy', () => {
  const files = new Map<string, string>();
  return {
    __files: files,
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn(async (uri: string) => ({ exists: files.has(uri), uri })),
    readAsStringAsync: jest.fn(async (uri: string) => {
      if (!files.has(uri)) throw new Error('ENOENT');
      return files.get(uri)!;
    }),
    writeAsStringAsync: jest.fn(async (uri: string, contents: string) => {
      files.set(uri, contents);
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from)!);
      files.delete(from);
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      files.delete(uri);
    }),
  };
});

import * as FileSystem from 'expo-file-system/legacy';
import {
  enqueueComplete,
  flushQueue,
  _peekQueue,
  type QueuedMutation,
} from '../mutation-queue';

const fs = FileSystem as unknown as {
  __files: Map<string, string>;
  writeAsStringAsync: jest.Mock;
  moveAsync: jest.Mock;
  deleteAsync: jest.Mock;
};

const FILE = 'file:///doc/follow-mutations.json';
const TMP = `${FILE}.tmp`;
const DAY_MS = 24 * 60 * 60 * 1000;

const mutation = (sessionId: string, enqueuedAt: number) => ({
  id: `complete:${sessionId}`,
  type: 'complete' as const,
  sessionId,
  planId: `plan-${sessionId}`,
  enqueuedAt,
});

beforeEach(() => {
  fs.__files.clear();
  jest.clearAllMocks();
});

describe('enqueueComplete', () => {
  it('persiste la mutación (planId + sessionId)', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    const q = await _peekQueue();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ type: 'complete', sessionId: 'sess-1', planId: 'plan-1' });
  });

  it('no duplica al encolar dos veces la misma sesión', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    await enqueueComplete('sess-1', 'plan-1');
    expect(await _peekQueue()).toHaveLength(1);
  });

  it('encola sesiones distintas por separado', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    await enqueueComplete('sess-2', 'plan-2');
    expect(await _peekQueue()).toHaveLength(2);
  });

  it('durabilidad: no resuelve hasta que la escritura a disco termina', async () => {
    // Resolver capturado sincrónicamente (el executor corre al crear la promesa)
    // para que `releaseWrite` esté siempre definido cuando lo llamemos.
    let releaseWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    fs.writeAsStringAsync.mockImplementationOnce(async (uri: string, contents: string) => {
      await writeGate;
      fs.__files.set(uri, contents);
    });

    let resolved = false;
    const p = enqueueComplete('sess-1', 'plan-1').then(() => {
      resolved = true;
    });

    // Deja que enqueue llegue a la escritura (aún bloqueada por writeGate).
    await new Promise((r) => setImmediate(r));
    expect(resolved).toBe(false);

    releaseWrite();
    await p;
    expect(resolved).toBe(true);
    expect(await _peekQueue()).toHaveLength(1);
  });
});

describe('flushQueue — reglas idempotentes de drop', () => {
  it('sobrevive a un fallo de red (status 0) y drena en el reintento', async () => {
    await enqueueComplete('sess-1', 'plan-1');

    // 1er intento: sin red → se CONSERVA.
    await flushQueue(async () => 0);
    expect(await _peekQueue()).toHaveLength(1);

    // 2º intento: 200 → se DRENA.
    await flushQueue(async () => 200);
    expect(await _peekQueue()).toHaveLength(0);
  });

  it.each([200, 204, 400, 404, 409, 410, 422])(
    'drena ante status terminal %i (éxito / ya-no-aplica)',
    async (status) => {
      await enqueueComplete('sess-1', 'plan-1');
      await flushQueue(async () => status);
      expect(await _peekQueue()).toHaveLength(0);
    },
  );

  it.each([0, 408, 429, 401, 403, 500, 503])(
    'CONSERVA ante status retryable %i (no pierde el /complete)',
    async (status) => {
      await enqueueComplete('sess-1', 'plan-1');
      await flushQueue(async () => status);
      expect(await _peekQueue()).toHaveLength(1);
    },
  );

  it('429/408 se conservan y drenan cuando el server responde 200', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    await flushQueue(async () => 429); // rate limit
    expect(await _peekQueue()).toHaveLength(1);
    await flushQueue(async () => 408); // timeout
    expect(await _peekQueue()).toHaveLength(1);
    await flushQueue(async () => 200); // por fin
    expect(await _peekQueue()).toHaveLength(0);
  });

  it('conserva la mutación si el sender lanza', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    await flushQueue(async () => {
      throw new Error('boom');
    });
    expect(await _peekQueue()).toHaveLength(1);
  });

  it('drena cada mutación con exactamente un envío', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    await enqueueComplete('sess-2', 'plan-2');
    const send = jest.fn(async () => 200);
    await flushQueue(send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(await _peekQueue()).toHaveLength(0);
  });
});

describe('flushQueue — concurrencia', () => {
  it('flushes concurrentes comparten el mismo en-vuelo (no doble envío)', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    const send = jest.fn(
      (_m: QueuedMutation) => new Promise<number>((r) => setTimeout(() => r(200), 5)),
    );
    await Promise.all([flushQueue(send), flushQueue(send)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await _peekQueue()).toHaveLength(0);
  });

  it('preserva una mutación encolada MIENTRAS corre el flush', async () => {
    await enqueueComplete('sess-1', 'plan-1');

    let sawFirst = false;
    const send = jest.fn(async (m: QueuedMutation) => {
      if (m.sessionId === 'sess-1' && !sawFirst) {
        sawFirst = true;
        // Llega una nueva mutación en mitad del envío de la red.
        await enqueueComplete('sess-2', 'plan-2');
      }
      return 200;
    });

    await flushQueue(send);

    // sess-1 drenada; sess-2 (encolada durante el flush) sobrevive.
    const q = await _peekQueue();
    expect(q).toHaveLength(1);
    expect(q[0].sessionId).toBe('sess-2');
  });
});

describe('backstop de crecimiento (N2)', () => {
  it('poda entradas más viejas que el TTL (30 días) al leer', async () => {
    const now = Date.now();
    fs.__files.set(
      FILE,
      JSON.stringify([
        mutation('old', now - 31 * DAY_MS), // caducada
        mutation('fresh', now - 2 * DAY_MS), // vigente
      ]),
    );
    const q = await _peekQueue();
    expect(q.map((m) => m.sessionId)).toEqual(['fresh']);
  });

  it('conserva entradas sin enqueuedAt (payload viejo) por edad', async () => {
    fs.__files.set(FILE, JSON.stringify([{ id: 'complete:x', type: 'complete', sessionId: 'x', planId: 'p' }]));
    expect(await _peekQueue()).toHaveLength(1);
  });

  it('capa el tamaño a las 200 más recientes', async () => {
    const now = Date.now();
    // Orden de inserción cronológico (como el enqueue real: push al final):
    // s0 el más viejo, s204 el más nuevo.
    const many = Array.from({ length: 205 }, (_, i) => mutation(`s${i}`, now - (205 - i) * 1000));
    fs.__files.set(FILE, JSON.stringify(many));
    const q = await _peekQueue();
    expect(q).toHaveLength(200);
    // Se descartan las 5 más viejas (s0..s4); sobreviven las más recientes.
    expect(q.some((m) => m.sessionId === 's0')).toBe(false);
    expect(q.some((m) => m.sessionId === 's204')).toBe(true);
  });
});

describe('escritura atómica (N3)', () => {
  it('escribe al .tmp y luego renombra sobre el destino', async () => {
    await enqueueComplete('sess-1', 'plan-1');
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(TMP, expect.any(String));
    expect(fs.moveAsync).toHaveBeenCalledWith({ from: TMP, to: FILE });
  });

  it('un fallo a media escritura NO corrompe el fichero bueno existente', async () => {
    // Cola sana ya en disco.
    await enqueueComplete('sess-1', 'plan-1');
    const goodBefore = fs.__files.get(FILE);
    expect(goodBefore).toBeDefined();

    // La siguiente escritura falla tras dejar un tmp a medias (move nunca corre).
    fs.moveAsync.mockRejectedValueOnce(new Error('crash durante rename'));
    await enqueueComplete('sess-2', 'plan-2');

    // El destino sigue siendo la versión buena anterior (no corrupto, no vacío).
    expect(fs.__files.get(FILE)).toBe(goodBefore);
    const q = await _peekQueue();
    expect(q).toHaveLength(1);
    expect(q[0].sessionId).toBe('sess-1');
  });

  it('limpia el .tmp a medias cuando la escritura falla', async () => {
    fs.moveAsync.mockRejectedValueOnce(new Error('crash'));
    await enqueueComplete('sess-1', 'plan-1');
    expect(fs.deleteAsync).toHaveBeenCalledWith(TMP, { idempotent: true });
  });
});
