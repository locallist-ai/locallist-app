// Persistencia a disco del plan COMPLETO de Follow Mode para arranque en frío
// sin red. Complementa a `resume-store` (que solo guarda la POSICIÓN
// {dayNumber, orderIndex}): aquí guardamos el DTO íntegro necesario para
// renderizar el mapa, la ruta y las tarjetas de stop offline.
//
// Usamos `expo-file-system/legacy` a propósito (no safe-store): safe-store cae
// a RAM cuando SecureStore no está disponible, y un plan que solo vive en RAM
// no sobrevive a un cold-start — justo el caso que queremos cubrir. El fichero
// vive en `${documentDirectory}follow-plans/{planId}.json`.

import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../logger';
import type { PlanDetailResponse } from '../types';

const DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}follow-plans/`
  : null;

// planId es un UUID en la práctica, pero lo codificamos por si acaso para no
// generar rutas con `/` u otros caracteres problemáticos en el nombre.
const fileUri = (planId: string): string | null =>
  DIR ? `${DIR}${encodeURIComponent(planId)}.json` : null;

const tmpUri = (uri: string): string => `${uri}.tmp`;

async function ensureDir(): Promise<boolean> {
  if (!DIR) return false;
  try {
    // intermediates: true no lanza si el directorio ya existe.
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    return true;
  } catch (err) {
    logger.warn('plan-store: no se pudo crear el directorio', err);
    return false;
  }
}

/**
 * Persiste el plan completo a disco. Tolerante: cualquier fallo (sin
 * documentDirectory, disco lleno, permisos) se traga y se loguea — nunca
 * revienta el flujo de Follow Mode, para el que esto es best-effort.
 */
export async function savePlan(planId: string, plan: PlanDetailResponse): Promise<void> {
  if (!planId || !plan) return;
  const uri = fileUri(planId);
  if (!uri) return;
  const tmp = tmpUri(uri);
  try {
    if (!(await ensureDir())) return;
    // Escritura ATÓMICA (N3): tmp + rename. Un crash a media escritura no deja el
    // JSON del plan corrupto (loadPlan → null perdería el cold-start offline).
    await FileSystem.writeAsStringAsync(tmp, JSON.stringify(plan));
    await FileSystem.moveAsync({ from: tmp, to: uri });
  } catch (err) {
    logger.warn('plan-store: fallo al guardar el plan', err);
    try {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
    } catch {
      /* best-effort */
    }
  }
}

// Shape mínima RENDERIZABLE (N4): no basta con que exista `days`; exigimos al
// menos un día con al menos un stop y campos mínimos, para no pintar una pantalla
// de Follow Mode vacía a partir de un fichero técnicamente-JSON pero inservible.
function isPlanShape(value: unknown): value is PlanDetailResponse {
  if (value === null || typeof value !== 'object') return false;
  const plan = value as PlanDetailResponse;
  if (typeof plan.name !== 'string') return false;
  if (!Array.isArray(plan.days) || plan.days.length === 0) return false;
  return plan.days.some(
    (d) => d != null && Array.isArray(d.stops) && d.stops.length > 0,
  );
}

/**
 * Lee el plan persistido. Devuelve null si no existe, si el JSON está corrupto
 * o si no tiene la shape mínima esperada (nunca lanza).
 */
export async function loadPlan(planId: string): Promise<PlanDetailResponse | null> {
  const uri = fileUri(planId);
  if (!uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed: unknown = JSON.parse(raw);
    return isPlanShape(parsed) ? parsed : null;
  } catch (err) {
    logger.warn('plan-store: fallo al leer el plan persistido', err);
    return null;
  }
}

/** Borra el plan persistido (idempotente; ausencia no es error). */
export async function removePlan(planId: string): Promise<void> {
  const uri = fileUri(planId);
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (err) {
    logger.warn('plan-store: fallo al borrar el plan persistido', err);
  }
}
