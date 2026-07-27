/**
 * photo-prefetch — precarga silenciosa de las fotos del día activo a la caché de
 * expo-image. Mockeamos `Image.prefetch` y verificamos que se invoca con las
 * urls resueltas de la primera foto de cada stop (dedup, saltando stops sin
 * foto) y que un fallo del prefetch no propaga.
 *
 * No-vacuidad: `invoca prefetch con las urls del día` falla si el helper no
 * llama a Image.prefetch; `sin fotos → no invoca` falla si llamara siempre.
 */
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(() => Promise.resolve(true)) } }));

import { Image } from 'expo-image';
import { dayPhotoUrls, prefetchDayPhotos } from '../photo-prefetch';
import type { PlanStop } from '../../types';

const prefetch = Image.prefetch as jest.Mock;

const stop = (placeId: string, photos: string[] | null): PlanStop =>
  ({
    placeId,
    dayNumber: 1,
    orderIndex: 0,
    timeBlock: null,
    suggestedArrival: null,
    suggestedDurationMin: null,
    travelFromPrevious: null,
    place: photos === null ? null : ({ id: placeId, photos } as never),
  }) as unknown as PlanStop;

beforeEach(() => jest.clearAllMocks());

describe('dayPhotoUrls', () => {
  it('toma la primera foto (absoluta) de cada stop', () => {
    const urls = dayPhotoUrls([
      stop('p1', ['https://cdn/a.jpg', 'https://cdn/a2.jpg']),
      stop('p2', ['https://cdn/b.jpg']),
    ]);
    expect(urls).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });

  it('salta stops sin place o sin fotos', () => {
    const urls = dayPhotoUrls([
      stop('p1', ['https://cdn/a.jpg']),
      stop('p2', null),
      stop('p3', []),
    ]);
    expect(urls).toEqual(['https://cdn/a.jpg']);
  });

  it('deduplica urls repetidas', () => {
    const urls = dayPhotoUrls([
      stop('p1', ['https://cdn/a.jpg']),
      stop('p2', ['https://cdn/a.jpg']),
    ]);
    expect(urls).toEqual(['https://cdn/a.jpg']);
  });
});

describe('prefetchDayPhotos', () => {
  it('invoca Image.prefetch con las urls del día', () => {
    prefetchDayPhotos([
      stop('p1', ['https://cdn/a.jpg']),
      stop('p2', ['https://cdn/b.jpg']),
    ]);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });

  it('no invoca prefetch cuando no hay fotos', () => {
    prefetchDayPhotos([stop('p1', null), stop('p2', [])]);
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('no propaga si Image.prefetch rechaza (offline)', () => {
    prefetch.mockReturnValueOnce(Promise.reject(new Error('offline')));
    expect(() => prefetchDayPhotos([stop('p1', ['https://cdn/a.jpg'])])).not.toThrow();
  });

  it('no propaga si Image.prefetch lanza sincrónicamente', () => {
    prefetch.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => prefetchDayPhotos([stop('p1', ['https://cdn/a.jpg'])])).not.toThrow();
  });
});
