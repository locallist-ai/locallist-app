/**
 * Tests para `lib/bulk-ops.ts` — runBulkWithConcurrency.
 *
 * Audit follow-up E2 (2026-04-27): el bulk delete state machine antes vivía
 * inline en `app/(tabs)/plans.tsx` y no era testable. Extraído para garantizar
 * cap de concurrencia + correcto split succeeded/failed bajo:
 *   - happy path (todos OK)
 *   - all-fail
 *   - partial fail (algunos OK, otros 5xx)
 *   - exception en `op` (no debe crashear, cuenta como failed)
 *   - empty input
 *   - cap respetado (<= concurrency simultaneous in-flight)
 */

import { runBulkWithConcurrency } from '../bulk-ops';

describe('runBulkWithConcurrency', () => {
  it('returns todos succeeded en happy path', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const result = await runBulkWithConcurrency(ids, async () => true);
    expect(result.succeeded).toEqual(ids);
    expect(result.failed).toEqual([]);
  });

  it('returns todos failed cuando op resuelve false en todos', async () => {
    const ids = ['a', 'b', 'c'];
    const result = await runBulkWithConcurrency(ids, async () => false);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual(ids);
  });

  it('partial fail: separa correctamente succeeded vs failed', async () => {
    const ids = ['ok1', 'fail1', 'ok2', 'fail2', 'ok3'];
    const result = await runBulkWithConcurrency(ids, async (id) =>
      id.startsWith('ok'),
    );
    expect(result.succeeded.sort()).toEqual(['ok1', 'ok2', 'ok3']);
    expect(result.failed.sort()).toEqual(['fail1', 'fail2']);
  });

  it('atrapa exceptions de op y las cuenta como failed', async () => {
    const ids = ['a', 'b', 'c'];
    const result = await runBulkWithConcurrency(ids, async (id) => {
      if (id === 'b') throw new Error('boom');
      return true;
    });
    expect(result.succeeded.sort()).toEqual(['a', 'c']);
    expect(result.failed).toEqual(['b']);
  });

  it('returns vacío para input vacío', async () => {
    const result = await runBulkWithConcurrency([], async () => true);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('respeta el cap de concurrencia (peak in-flight ≤ concurrency)', async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    const ids = Array.from({ length: 10 }, (_, i) => i);

    await runBulkWithConcurrency(
      ids,
      async () => {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        // Pequeña espera para forzar overlap si concurrency permitiera más.
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return true;
      },
      3,
    );

    expect(peakInFlight).toBeLessThanOrEqual(3);
    expect(peakInFlight).toBe(3);
  });

  it('procesa todos los ids aunque haya fallos parciales en chunks intermedios', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const seen: string[] = [];
    const result = await runBulkWithConcurrency(
      ids,
      async (id) => {
        seen.push(id);
        return id !== 'c';
      },
      2,
    );
    // Garantiza que ningún id se queda sin procesar.
    expect(seen.sort()).toEqual(ids);
    expect(result.succeeded.sort()).toEqual(['a', 'b', 'd', 'e', 'f']);
    expect(result.failed).toEqual(['c']);
  });
});
