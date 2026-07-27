import type { PlanStop } from '../types';
import type { MapStop } from '../../components/map/PlanMap';

/**
 * Convierte un `PlanStop` en un `MapStop` (sin número) o `null` si no tiene
 * coordenadas usables. El mapa no puede pintar un pin sin lat/lng finitos.
 */
export const mapStopFromPlanStop = (planStop: PlanStop): MapStop | null => {
  const lat = planStop.place?.latitude;
  const lng = planStop.place?.longitude;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: planStop.placeId,
    name: planStop.place?.name ?? 'Unknown',
    latitude: lat,
    longitude: lng,
    category: planStop.place?.category,
    orderIndex: planStop.orderIndex,
  };
};

/**
 * Construye los pines NUMERADOS del día a partir de los stops de UN SOLO día
 * (ya filtrados por `dayNumber` y ordenados por `orderIndex`, igual que el
 * `dayStops` del Follow screen).
 *
 * El NÚMERO del pin es la posición 1-based dentro del día COMPLETO, calculada
 * ANTES de descartar los stops sin coordenadas. Así el número coincide siempre
 * con el "N / M" que muestra el `FollowDaySheet` (que numera sobre el día
 * completo), incluso cuando un stop intermedio no tiene lat/lng y por tanto no
 * pinta pin: los pines posteriores conservan su número real y el pin activo
 * nunca contradice al sheet.
 */
export const buildDayMapStops = (dayStops: PlanStop[]): MapStop[] =>
  dayStops
    .map((stop, dayPosition): MapStop | null => {
      const mapStop = mapStopFromPlanStop(stop);
      return mapStop ? { ...mapStop, number: dayPosition + 1 } : null;
    })
    .filter((s): s is MapStop => s !== null);
