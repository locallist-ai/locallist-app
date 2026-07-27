/**
 * plan-store — persistencia a disco del plan de Follow Mode para cold-start
 * offline. Mockeamos `expo-file-system/legacy` con un FS en memoria (stateful)
 * para ejercitar el round-trip save→load real, y forzamos errores/corrupción
 * para verificar la tolerancia (null, nunca throw).
 *
 * No-vacuidad: `carga round-trip` falla si save no persiste; `shape inválida →
 * null` falla si loadPlan no valida (evidenciado en el reporte de la tarea).
 */
import type { PlanDetailResponse } from '../../types';

jest.mock('expo-file-system/legacy', () => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    __files: files,
    __dirs: dirs,
    documentDirectory: 'file:///doc/',
    makeDirectoryAsync: jest.fn(async (uri: string) => {
      dirs.add(uri);
    }),
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
import { savePlan, loadPlan, removePlan } from '../plan-store';

const fs = FileSystem as unknown as {
  __files: Map<string, string>;
  __dirs: Set<string>;
  makeDirectoryAsync: jest.Mock;
  getInfoAsync: jest.Mock;
  readAsStringAsync: jest.Mock;
  writeAsStringAsync: jest.Mock;
  moveAsync: jest.Mock;
  deleteAsync: jest.Mock;
};

const URI = 'file:///doc/follow-plans/plan-1.json';
const TMP = `${URI}.tmp`;

const makePlan = (): PlanDetailResponse =>
  ({
    id: 'plan-1',
    name: 'Weekend in Miami',
    city: 'Miami',
    type: 'ai',
    description: null,
    durationDays: 2,
    tripContext: null,
    isPublic: false,
    days: [
      { dayNumber: 1, stops: [{ placeId: 'p1', dayNumber: 1, orderIndex: 0 } as never] },
    ],
    routeSegments: [],
  }) as unknown as PlanDetailResponse;

beforeEach(() => {
  fs.__files.clear();
  fs.__dirs.clear();
  jest.clearAllMocks();
});

describe('savePlan / loadPlan round-trip', () => {
  it('persiste el plan completo y lo recupera intacto', async () => {
    const plan = makePlan();
    await savePlan('plan-1', plan);
    expect(await loadPlan('plan-1')).toEqual(plan);
  });

  it('escribe atómicamente: tmp + rename sobre la ruta esperada (N3)', async () => {
    await savePlan('plan-1', makePlan());
    expect(fs.writeAsStringAsync).toHaveBeenCalledWith(TMP, expect.any(String));
    expect(fs.moveAsync).toHaveBeenCalledWith({ from: TMP, to: URI });
  });

  it('crea el directorio (intermediates) antes de escribir', async () => {
    await savePlan('plan-1', makePlan());
    expect(fs.makeDirectoryAsync).toHaveBeenCalledWith('file:///doc/follow-plans/', {
      intermediates: true,
    });
  });

  it('un fallo en el rename NO corrompe el plan bueno anterior (N3)', async () => {
    await savePlan('plan-1', makePlan());
    const goodBefore = fs.__files.get(URI);

    const mutated = { ...makePlan(), name: 'Corrupted attempt' };
    fs.moveAsync.mockRejectedValueOnce(new Error('crash durante rename'));
    await savePlan('plan-1', mutated as never);

    expect(fs.__files.get(URI)).toBe(goodBefore);
    expect((await loadPlan('plan-1'))?.name).toBe('Weekend in Miami');
    expect(fs.deleteAsync).toHaveBeenCalledWith(TMP, { idempotent: true });
  });
});

describe('loadPlan tolerancia', () => {
  it('devuelve null si el fichero no existe', async () => {
    expect(await loadPlan('missing')).toBeNull();
  });

  it('devuelve null con JSON corrupto (no revienta)', async () => {
    fs.__files.set(URI, '{ this is not json');
    expect(await loadPlan('plan-1')).toBeNull();
  });

  it('devuelve null si falta el array days (shape inválida)', async () => {
    fs.__files.set(URI, JSON.stringify({ id: 'plan-1', name: 'x' }));
    expect(await loadPlan('plan-1')).toBeNull();
  });

  it('devuelve null si days está vacío (no renderizable, N4)', async () => {
    fs.__files.set(URI, JSON.stringify({ name: 'x', days: [] }));
    expect(await loadPlan('plan-1')).toBeNull();
  });

  it('devuelve null si ningún día tiene stops (N4)', async () => {
    fs.__files.set(
      URI,
      JSON.stringify({ name: 'x', days: [{ dayNumber: 1, stops: [] }] }),
    );
    expect(await loadPlan('plan-1')).toBeNull();
  });

  it('devuelve null si falta el nombre (N4)', async () => {
    fs.__files.set(
      URI,
      JSON.stringify({ days: [{ dayNumber: 1, stops: [{ placeId: 'p1' }] }] }),
    );
    expect(await loadPlan('plan-1')).toBeNull();
  });

  it('devuelve null si la lectura lanza', async () => {
    fs.__files.set(URI, 'x');
    fs.readAsStringAsync.mockRejectedValueOnce(new Error('io'));
    expect(await loadPlan('plan-1')).toBeNull();
  });
});

describe('savePlan tolerancia', () => {
  it('no lanza si la escritura falla', async () => {
    fs.writeAsStringAsync.mockRejectedValueOnce(new Error('disk full'));
    await expect(savePlan('plan-1', makePlan())).resolves.toBeUndefined();
  });

  it('no lanza si makeDirectory falla y no intenta escribir', async () => {
    fs.makeDirectoryAsync.mockRejectedValueOnce(new Error('perm'));
    await expect(savePlan('plan-1', makePlan())).resolves.toBeUndefined();
    expect(fs.writeAsStringAsync).not.toHaveBeenCalled();
  });
});

describe('removePlan', () => {
  it('borra el fichero de forma idempotente', async () => {
    await savePlan('plan-1', makePlan());
    await removePlan('plan-1');
    expect(fs.deleteAsync).toHaveBeenCalledWith(URI, { idempotent: true });
    expect(await loadPlan('plan-1')).toBeNull();
  });

  it('no lanza si el borrado falla', async () => {
    fs.deleteAsync.mockRejectedValueOnce(new Error('io'));
    await expect(removePlan('plan-1')).resolves.toBeUndefined();
  });
});
