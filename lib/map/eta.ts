/**
 * ETA / distancia PLANIFICADA al próximo stop (no GPS en vivo): usa los datos
 * que ya trae el modelo (`PlanStop.travelFromPrevious`, que en el stop k es el
 * viaje desde k-1). Formateo de unidades vía i18n. Puro y testeable.
 */
import type { TFunction } from 'i18next';
import type { PlanStop } from '../types';

export interface Travel {
  distanceKm: number;
  durationMin: number;
}

/**
 * Viaje planificado del stop activo al SIGUIENTE del día. Lee el
 * `travelFromPrevious` del próximo stop. `null` si no hay siguiente o el dato
 * no existe.
 */
export function getTravelToNextStop(dayStops: PlanStop[], activeIndex: number): Travel | null {
  const next = dayStops[activeIndex + 1];
  const travel = next?.travelFromPrevious;
  if (!travel) return null;

  const distanceKm =
    typeof travel.distance_km === 'number' && Number.isFinite(travel.distance_km)
      ? travel.distance_km
      : null;
  const durationMin =
    typeof travel.duration_min === 'number' && Number.isFinite(travel.duration_min)
      ? travel.duration_min
      : null;

  if (distanceKm == null && durationMin == null) return null;
  return { distanceKm: distanceKm ?? 0, durationMin: durationMin ?? 0 };
}

/** Distancia: metros (redondeo a 10 m) por debajo de 1 km, km con 1 decimal si no. */
export function formatDistance(distanceKm: number, t: TFunction): string {
  const safe = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  if (safe < 1) {
    const meters = Math.round((safe * 1000) / 10) * 10;
    return t('units.distanceMeters', { value: meters });
  }
  const km = Math.round(safe * 10) / 10;
  return t('units.distanceKm', { value: km });
}

/** Duración: min por debajo de 60, si no h (y h+min cuando sobran minutos). */
export function formatDuration(durationMin: number, t: TFunction): string {
  const safe = Number.isFinite(durationMin) && durationMin > 0 ? Math.round(durationMin) : 0;
  if (safe < 60) {
    return t('units.durationMin', { value: safe });
  }
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return minutes === 0
    ? t('units.durationHour', { value: hours })
    : t('units.durationHourMin', { h: hours, min: minutes });
}
