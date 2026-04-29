// Helpers de bulk operations testables. Pablo 2026-04-27 (audit follow-up D1):
// el bulk delete original hacía Promise.all sin cap → squeeze al rate limit
// global del backend con N≥10 planes. Extraído para que la lógica concurrente
// + partial failure handling sea testable sin React.

export interface BulkOpResult<TId> {
  succeeded: TId[];
  failed: TId[];
}

/**
 * Ejecuta `op(id)` para cada id en grupos de `concurrency` (chunked Promise.all
 * secuencial). Returns succeeded/failed split — los IDs cuyo `op` resolved
 * `false` o threw quedan en `failed`.
 *
 * No throws — atrapa excepciones de `op` y las cuenta como failed.
 */
export async function runBulkWithConcurrency<TId>(
  ids: TId[],
  op: (id: TId) => Promise<boolean>,
  concurrency = 3,
): Promise<BulkOpResult<TId>> {
  const succeeded: TId[] = [];
  const failed: TId[] = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (id) => {
        try {
          return { id, ok: await op(id) };
        } catch {
          return { id, ok: false };
        }
      }),
    );
    for (const { id, ok } of results) {
      (ok ? succeeded : failed).push(id);
    }
  }
  return { succeeded, failed };
}
