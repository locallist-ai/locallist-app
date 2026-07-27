import type { TFunction } from 'i18next';
import { formatDistance, formatDuration, getTravelToStop } from '../eta';
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

describe('getTravelToStop', () => {
  it('lee el travelFromPrevious del stop en index (tramo para llegar a él)', () => {
    const dayStops = [stop(null, null), stop(1.2, 15)];
    expect(getTravelToStop(dayStops, 1)).toEqual({ distanceKm: 1.2, durationMin: 15 });
  });

  it('el primer stop del día no tiene tramo previo -> null', () => {
    const dayStops = [stop(null, null), stop(1.2, 15)];
    expect(getTravelToStop(dayStops, 0)).toBeNull();
  });

  it('index fuera de rango -> null', () => {
    expect(getTravelToStop([stop(1.2, 15)], 5)).toBeNull();
  });
});

describe('formatDistance', () => {
  it('por debajo de la frontera usa metros redondeados a 10', () => {
    expect(formatDistance(0.456, t)).toBe('units.distanceMeters|{"value":460}');
  });

  it('a partir de 1 km usa km con un decimal', () => {
    expect(formatDistance(1.25, t)).toBe('units.distanceKm|{"value":1.3}');
  });

  it('1 km justo ya es kilómetros', () => {
    expect(formatDistance(1, t)).toBe('units.distanceKm|{"value":1}');
  });

  it('en la frontera 0.995 km muestra "1 km", nunca "1000 m"', () => {
    expect(formatDistance(0.995, t)).toBe('units.distanceKm|{"value":1}');
  });

  it('justo por debajo de la frontera sigue en metros', () => {
    expect(formatDistance(0.994, t)).toBe('units.distanceMeters|{"value":990}');
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
