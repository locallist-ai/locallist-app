/**
 * Tests de `isPhotoDisplayable` — la lógica pura de fallo de foto keyeada por
 * URL que comparten los 4 consumidores de `<Image>` crudo/`PhotoHero`
 * (FollowDaySheet featured + thumbs, EditableStopCard, PlaceSearchModal/PlaceRow,
 * PhotoHero).
 *
 * Foco:
 *  - Una URL mostrable que NO ha fallado se muestra.
 *  - La MISMA URL que falló (404 del proxy) se suprime → gradiente.
 *  - Una URL DISTINTA (p. ej. la del siguiente stop en la tarjeta destacada del
 *    follow, que permanece montada) se vuelve a intentar pese al fallo anterior:
 *    el fallo de un stop NO oculta la foto del siguiente ("bleed prevention").
 *  - Nada mostrable (null/relativa sin resolver) nunca se muestra.
 */

import { isPhotoDisplayable } from '../photo-url';

describe('isPhotoDisplayable', () => {
  const A = 'https://cdn.example.com/a.jpg';
  const B = 'https://cdn.example.com/b.jpg';

  it('muestra una URL mostrable que no ha fallado', () => {
    expect(isPhotoDisplayable(A, null)).toBe(true);
  });

  it('suprime la MISMA URL que falló (404 → gradiente)', () => {
    expect(isPhotoDisplayable(A, A)).toBe(false);
  });

  it('el fallo de un stop NO oculta la foto del siguiente (URL distinta se reintenta)', () => {
    // Tarjeta destacada del follow: falló A, ahora renderiza B → B se muestra.
    expect(isPhotoDisplayable(B, A)).toBe(true);
  });

  it('no muestra nada cuando no hay URL mostrable', () => {
    expect(isPhotoDisplayable(null, null)).toBe(false);
    expect(isPhotoDisplayable(undefined, null)).toBe(false);
    expect(isPhotoDisplayable('/places/x/photos/0', null)).toBe(false);
  });

  it('una URL mostrable con un fallo previo de OTRA URL sigue mostrándose', () => {
    expect(isPhotoDisplayable(A, B)).toBe(true);
  });
});
