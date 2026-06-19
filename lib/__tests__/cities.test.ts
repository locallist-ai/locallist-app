/**
 * Tests del catálogo visual de ciudades (`lib/cities.ts`). El selector se
 * construye desde `GET /cities/live`; `cityFromLive` resuelve cada ciudad LIVE
 * a sus visuales (catálogo bundled si coincide, default si no).
 */

import { CITIES, cityFromLive } from '../cities';

describe('cityFromLive', () => {
  it('usa los visuales del catálogo cuando el nombre coincide', () => {
    const result = cityFromLive({ name: 'Miami' });
    const catalog = CITIES.find((c) => c.name === 'Miami')!;
    expect(result).toEqual(catalog);
    expect(result.iconName).toBe('palm-tree');
  });

  it('coincide case-insensitive con el catálogo', () => {
    const result = cityFromLive({ name: 'miami' });
    expect(result.iconName).toBe('palm-tree');
    // Conserva el nombre del catálogo (capitalizado), no el del backend.
    expect(result.name).toBe('Miami');
  });

  it('aplica un visual por defecto a una ciudad LIVE no catalogada', () => {
    const result = cityFromLive({ name: 'Lisboa' });
    expect(result.name).toBe('Lisboa');
    // Default usa icono (no emoji glyph) por consistencia de brand.
    expect(result.iconName).toBe('map-marker');
    expect(result.color).toBeTruthy();
  });
});
