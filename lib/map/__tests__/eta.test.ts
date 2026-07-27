import type { TFunction } from 'i18next';
import { formatDistance, formatDuration, getTravelToNextStop } from '../eta';
import type { PlanStop } from '../../types';

// t falso que devuelve la clave + los params, para verificar QUÉ rama i18n se elige.
const t = ((key: string, options?: Record<string, unknown>) =>
  `${key}|${JSON.stringify(options ?? {})}`) as unknown as TFunction;

const stop = (distance_km: number | null, duration_min: number | null): PlanStop => ({
  placeId: 'p',
  dayNumber: 1,
  orderIndex: 0,
  timeBlock: null,
  suggestedArrival: null,
  suggestedDurationMin: null,
  travelFromPrevious:
    distance_km == null && duration_min == null
      ? null
      : { distance_km: distance_km ?? 0, duration_min: duration_min ?? 0, mode: 'walking' },
  place: null,
});

describe('getTravelToNextStop', () => {
  it('lee el travelFromPrevious del SIGUIENTE stop del día', () => {
    const dayStops = [stop(0, 0), stop(1.2, 15)];
    expect(getTravelToNextStop(dayStops, 0)).toEqual({ distanceKm: 1.2, durationMin: 15 });
  });

  it('sin siguiente stop devuelve null', () => {
    const dayStops = [stop(1.2, 15)];
    expect(getTravelToNextStop(dayStops, 0)).toBeNull();
  });

  it('si el siguiente no tiene datos de viaje devuelve null', () => {
    const dayStops = [stop(0, 0), stop(null, null)];
    expect(getTravelToNextStop(dayStops, 0)).toBeNull();
  });
});

describe('formatDistance', () => {
  it('por debajo de 1 km usa metros redondeados a 10', () => {
    expect(formatDistance(0.456, t)).toBe('units.distanceMeters|{"value":460}');
  });

  it('a partir de 1 km usa km con un decimal', () => {
    expect(formatDistance(1.25, t)).toBe('units.distanceKm|{"value":1.3}');
  });

  it('1 km justo ya es kilómetros (frontera)', () => {
    expect(formatDistance(1, t)).toBe('units.distanceKm|{"value":1}');
  });
});

describe('formatDuration', () => {
  it('por debajo de 60 min usa minutos', () => {
    expect(formatDuration(45, t)).toBe('units.durationMin|{"value":45}');
  });

  it('60 min en punto usa horas', () => {
    expect(formatDuration(60, t)).toBe('units.durationHour|{"value":1}');
  });

  it('con minutos sobrantes usa horas + minutos', () => {
    expect(formatDuration(90, t)).toBe('units.durationHourMin|{"h":1,"min":30}');
  });
});
