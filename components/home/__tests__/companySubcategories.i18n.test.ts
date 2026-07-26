/**
 * COMPANY_SUBCATEGORIES: localización de los sub-tags de compañía del wizard.
 *
 * Contrato (mismo que las subcategorías de interés):
 *  - Cada opción lleva `labelKey` y la key existe en en.ts y es.ts (la sheet
 *    renderiza `t(labelKey)`, así que con app en ES sale español natural).
 *  - Los `id` que matchean Place.suitableFor en el backend NO cambian: son el
 *    contrato y este test los congela explícitamente.
 *  - El `label` estático queda como fallback EN y coincide con el valor en.ts
 *    (si alguien toca uno sin el otro, esto lo caza).
 */

import { COMPANY_SUBCATEGORIES } from '../constants';
import en from '../../../lib/i18n/en';
import es from '../../../lib/i18n/es';

/** Resuelve una key con puntos ('wizard.companySubWithKids') sobre un catálogo. */
function resolve(catalog: Record<string, unknown>, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const ALL_OPTIONS = Object.values(COMPANY_SUBCATEGORIES).flat();

describe('COMPANY_SUBCATEGORIES i18n', () => {
  it('toda opción tiene labelKey y la key existe en EN y ES', () => {
    for (const opt of ALL_OPTIONS) {
      expect(opt.labelKey).toBeDefined();
      expect(resolve(en, opt.labelKey!)).toBeDefined();
      expect(resolve(es, opt.labelKey!)).toBeDefined();
    }
  });

  it('el label estático (fallback) coincide con el valor EN del catálogo', () => {
    for (const opt of ALL_OPTIONS) {
      expect(resolve(en, opt.labelKey!)).toBe(opt.label);
    }
  });

  it('con app en ES los labels visibles salen en español natural (spot-check)', () => {
    const byId = Object.fromEntries(ALL_OPTIONS.map((o) => [o.id, resolve(es, o.labelKey!)]));
    expect(byId['with-kids']).toBe('Con niños');
    expect(byId['honeymoon']).toBe('Luna de miel');
    expect(byId['backpacker']).toBe('Mochilero');
    expect(byId['bachelorette']).toBe('Despedida de soltera');
    expect(byId['group-trip']).toBe('Viaje en grupo');
    expect(byId['digital-nomad']).toBe('Nómada digital');
  });

  it('los IDs que viajan al backend (Place.suitableFor) no cambian: contrato congelado', () => {
    expect(Object.keys(COMPANY_SUBCATEGORIES).sort()).toEqual(['couple', 'family', 'friends', 'solo']);
    expect(COMPANY_SUBCATEGORIES.solo.map((o) => o.id)).toEqual(['backpacker', 'digital-nomad', 'business', 'social']);
    expect(COMPANY_SUBCATEGORIES.couple.map((o) => o.id)).toEqual(['honeymoon', 'dating', 'anniversary']);
    expect(COMPANY_SUBCATEGORIES.family.map((o) => o.id)).toEqual(['with-kids', 'with-teens', 'multi-gen']);
    expect(COMPANY_SUBCATEGORIES.friends.map((o) => o.id)).toEqual(['bachelor', 'bachelorette', 'group-trip', 'birthday']);
  });
});
