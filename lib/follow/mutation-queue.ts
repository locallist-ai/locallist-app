// Cola DURABLE de mutaciones de Follow Mode persistida a disco. Hoy el PATCH
// `/follow/{sessionId}/complete` es fire-and-forget: si no hay red se pierde y,
// acto seguido, `clearResume` borra el estado — el usuario termina el viaje y
// el servidor nunca se entera. Esta cola encola la mutación durablemente ANTES
// de limpiar nada y la reintenta de forma oportunista (al montar Follow Mode /
// arrancar el flujo), sin depender de netinfo.
//
// Fichero único `${documentDirectory}follow-mutations.json` con un array de
// mutaciones. Todas las escrituras (encolar y drenar) pasan por un mutex de
// proceso para que un enqueue concurrente nunca pise el rewrite del flush.

import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../logger';

export type QueuedMutation = {
  /** Clave de deduplicación: `complete:${sessionId}`. */
  id: string;
  type: 'complete';
  sessionId: string;
  planId: string;
  enqueuedAt: number;
};

/** Envía una mutación y devuelve el status HTTP (0 = fallo de red/abort). */
export type MutationSender = (mutation: QueuedMutation) => Promise<number>;

const FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}follow-mutations.json`
  : null;

// ─── Mutex de proceso (serializa read-modify-write del fichero) ───────────────
let opChain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = opChain.then(fn, fn);
  // La cadena no debe romperse por un rechazo: la envolvemos para el siguiente.
  opChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readQueue(): Promise<QueuedMutation[]> {
  if (!FILE) return [];
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMutation);
  } catch (err) {
    logger.warn('mutation-queue: fallo al leer la cola', err);
    return [];
  }
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  if (!FILE) return;
  try {
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(queue));
  } catch (err) {
    logger.warn('mutation-queue: fallo al escribir la cola', err);
  }
}

function isMutation(value: unknown): value is QueuedMutation {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as QueuedMutation).id === 'string' &&
    (value as QueuedMutation).type === 'complete' &&
    typeof (value as QueuedMutation).sessionId === 'string' &&
    typeof (value as QueuedMutation).planId === 'string'
  );
}

const completeId = (sessionId: string): string => `complete:${sessionId}`;

/**
 * Encola (durablemente) la mutación `/complete` para una sesión. Resuelve solo
 * cuando la escritura a disco ha terminado — el caller puede hacer `clearResume`
 * con la garantía de que la mutación sobrevive a un cierre de la app. No
 * duplica: si ya hay una entrada para esa sesión, es un no-op idempotente.
 */
export async function enqueueComplete(sessionId: string, planId: string): Promise<void> {
  if (!sessionId) return;
  await withLock(async () => {
    const queue = await readQueue();
    if (queue.some((m) => m.id === completeId(sessionId))) return;
    queue.push({
      id: completeId(sessionId),
      type: 'complete',
      sessionId,
      planId,
      enqueuedAt: Date.now(),
    });
    await writeQueue(queue);
  });
}

/**
 * Una mutación se SACA de la cola (éxito idempotente) cuando alcanzamos el
 * servidor con una respuesta definitiva: 2xx (hecho) o 4xx (p. ej. sesión ya
 * completada / no encontrada — reintentar no cambiaría nada). Se CONSERVA para
 * reintentar en fallo de red (status 0) o error de servidor (5xx).
 */
function shouldDrop(status: number): boolean {
  return status !== 0 && status < 500;
}

let flushInFlight: Promise<void> | null = null;

/**
 * Vacía la cola de forma oportunista. Reentrante-seguro: llamadas concurrentes
 * comparten el mismo flush en vuelo (no se dispara la mutación dos veces). El
 * rewrite final vuelve a leer la cola bajo el mutex y elimina solo las ids
 * drenadas, preservando cualquier mutación encolada mientras corría la red.
 */
export function flushQueue(send: MutationSender): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    try {
      const snapshot = await readQueue();
      if (snapshot.length === 0) return;

      const droppedIds = new Set<string>();
      for (const mutation of snapshot) {
        try {
          const status = await send(mutation);
          if (shouldDrop(status)) droppedIds.add(mutation.id);
        } catch (err) {
          // Un throw inesperado del sender se trata como transitorio: se conserva.
          logger.warn('mutation-queue: el sender lanzó, se conserva la mutación', err);
        }
      }

      if (droppedIds.size === 0) return;
      await withLock(async () => {
        const current = await readQueue();
        await writeQueue(current.filter((m) => !droppedIds.has(m.id)));
      });
    } finally {
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

/** Solo para tests / diagnóstico: snapshot de la cola persistida. */
export async function _peekQueue(): Promise<QueuedMutation[]> {
  return readQueue();
}
