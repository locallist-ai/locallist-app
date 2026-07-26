/**
 * `getInterestSubcategories`: localización de las subcategorías del wizard.
 *
 * Contrato clave del barrido i18n:
 *  - Con la taxonomía cargada, el `label` VISIBLE se traduce al locale pedido
 *    (la sheet pinta `opt.label`), mapeando por `taxonomyKey ?? id`.
 *  - El `id` que viaja al backend NO cambia entre idiomas (solo el label).
 *  - Sin traducción disponible (taxonomía vacía / offline) se conserva el label
 *    inglés bundled como fallback y no se rompe el flujo.
 *  - Claves nuevas del backend sin representación estática se añaden como extras.
 */

import { getInterestSubcategories, taxonomyLocale } from '../useTaxonomy';
import { TAXONOMY_FALLBACK, type TaxonomyData } from '../../../lib/taxonomy-fallback';

const FULL = TAXONOMY_FALLBACK as unknown as TaxonomyData;

const labelById = (opts: { id: string; label: string }[]): Record<string, string> =>
  Object.fromEntries(opts.map((o) => [o.id, o.label]));

describe('getInterestSubcategories localization', () => {
  it('traduce los labels visibles al español con la taxonomía cargada', () => {
    const coffee = labelById(getInterestSubcategories('coffee', FULL, 'es'));
    // id estático 'bakery' → taxonomyKey 'bakery-cafe' → label ES.
    expect(coffee.bakery).toBe('Café Panadería');
    expect(coffee.specialty).toBe('Café de Especialidad');
    expect(coffee.tea).toBe('Salón de Té');

    const food = labelById(getInterestSubcategories('food', FULL, 'es'));
    // taxonomyKey distinta del id ('latin' → 'latin-american', 'asian' → 'asian-fusion').
    expect(food.latin).toBe('Latinoamericana');
    expect(food.asian).toBe('Fusión Asiática');
    expect(food.bakery).toBe('Panadería');
  });

  it('mantiene los labels en inglés cuando el locale es en', () => {
    const coffee = labelById(getInterestSubcategories('coffee', FULL, 'en'));
    expect(coffee.bakery).toBe('Bakery Cafe');
    expect(coffee.specialty).toBe('Specialty Coffee');

    const food = labelById(getInterestSubcategories('food', FULL, 'en'));
    expect(food.latin).toBe('Latin American');
  });

  it('los IDs que viajan al backend son idénticos en EN y ES (solo cambia el label)', () => {
    for (const interest of ['food', 'nightlife', 'coffee', 'outdoors', 'wellness', 'culture', 'shopping']) {
      const idsEn = getInterestSubcategories(interest, FULL, 'en').map((o) => o.id);
      const idsEs = getInterestSubcategories(interest, FULL, 'es').map((o) => o.id);
      expect(idsEs).toEqual(idsEn);
    }
  });

  it('sin traducción disponible conserva el label inglés bundled y no rompe (fallback)', () => {
    const empty: TaxonomyData = {
      categories: [],
      subcategoriesByCategory: {},
      labels: { en: {}, es: {} },
    };
    const coffee = getInterestSubcategories('coffee', empty, 'es');
    const byId = labelById(coffee);
    // El label cae al estático inglés; los ids se preservan intactos.
    expect(byId.bakery).toBe('Bakery Café');
    expect(byId.specialty).toBe('Specialty Coffee');
    expect(coffee.map((o) => o.id)).toEqual(['specialty', 'espresso', 'bakery', 'tea', 'juice', 'dessert']);
  });

  it('añade claves nuevas del backend no representadas como extras localizados', () => {
    const withExtra: TaxonomyData = {
      categories: ['Coffee'],
      subcategoriesByCategory: {
        Coffee: [...FULL.subcategoriesByCategory.Coffee, 'matcha'],
      },
      labels: {
        en: { ...FULL.labels.en, 'Coffee.matcha': 'Matcha' },
        es: { ...FULL.labels.es, 'Coffee.matcha': 'Matcha' },
      },
    };
    const coffee = getInterestSubcategories('coffee', withExtra, 'es');
    const extra = coffee.find((o) => o.id === 'matcha');
    expect(extra).toBeDefined();
    expect(extra?.label).toBe('Matcha');
    expect(extra?.emoji).toBe('\u{1F4CD}');
    // No duplica las estáticas: las 6 estáticas de coffee siguen presentes una sola vez.
    expect(coffee.filter((o) => o.id === 'bakery')).toHaveLength(1);
  });

  it('devuelve las estáticas sin tocar si el interest no mapea a una categoría', () => {
    const unknown = getInterestSubcategories('__nope__', FULL, 'es');
    expect(unknown).toEqual([]);
  });
});

describe('taxonomyLocale', () => {
  it('normaliza variantes regionales al par soportado', () => {
    expect(taxonomyLocale('es')).toBe('es');
    expect(taxonomyLocale('es-ES')).toBe('es');
    expect(taxonomyLocale('en')).toBe('en');
    expect(taxonomyLocale('en-US')).toBe('en');
    expect(taxonomyLocale(undefined)).toBe('en');
    expect(taxonomyLocale('fr')).toBe('en');
  });
});
