/**
 * Tests de `lib/analytics/screen-name.ts` — normalización de la ruta para
 * `screen_view`. Los segmentos dinámicos (ids) colapsan a `[id]` para mantener
 * la cardinalidad acotada y no filtrar ids/PII.
 */
import { normalizeScreen } from '../screen-name';

describe('normalizeScreen', () => {
  it('colapsa el id dinámico a [id] en las rutas con id', () => {
    expect(normalizeScreen('/plan/abc123')).toBe('/plan/[id]');
    expect(normalizeScreen('/follow/xyz-789')).toBe('/follow/[id]');
    expect(normalizeScreen('/place/9f8e7d')).toBe('/place/[id]');
  });

  it('colapsa también los sentinelas (new/preview) — cardinalidad uniforme', () => {
    expect(normalizeScreen('/plan/new')).toBe('/plan/[id]');
    expect(normalizeScreen('/plan/preview')).toBe('/plan/[id]');
  });

  it('deja intactas las rutas estáticas', () => {
    expect(normalizeScreen('/home')).toBe('/home');
    expect(normalizeScreen('/login')).toBe('/login');
    expect(normalizeScreen('/builder/wizard')).toBe('/builder/wizard');
    expect(normalizeScreen('/')).toBe('/');
  });

  it('ignora query string y hash', () => {
    expect(normalizeScreen('/plan/abc123?source=chat')).toBe('/plan/[id]');
    expect(normalizeScreen('/place/xyz#reviews')).toBe('/place/[id]');
  });

  it('normaliza la barra final y la raíz vacía', () => {
    expect(normalizeScreen('/favorites/')).toBe('/favorites');
    expect(normalizeScreen('')).toBe('/');
  });
});
