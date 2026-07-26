import { useEffect, useState } from 'react';
import { getTaxonomy, refreshTaxonomy, type TaxonomyData } from '../../lib/taxonomy';
import type { SubcategoryOption } from './constants';
import { SUBCATEGORIES_BY_INTEREST } from './constants';

// Maps an interest id (lowercase) to a CategoryKey (capitalized)
export const INTEREST_TO_CATEGORY: Record<string, string> = {
  food: 'Food',
  nightlife: 'Nightlife',
  coffee: 'Coffee',
  outdoors: 'Outdoors',
  wellness: 'Wellness',
  culture: 'Culture',
  shopping: 'Shopping',
};

/** Normaliza `i18n.language` (p.ej. 'es-ES', 'en-US') al par soportado por la taxonomía. */
export function taxonomyLocale(lang: string | undefined): 'en' | 'es' {
  return lang?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * Returns LOCALIZED subcategory options for a given interest id by merging:
 * 1. Static entries from SUBCATEGORIES_BY_INTEREST (emoji/icon metadata + the
 *    contract `id` that travels to the backend), with their visible `label`
 *    overridden by the backend taxonomy label for the requested locale. The
 *    lookup key is `taxonomyKey ?? id`; if the taxonomy has no translation the
 *    static English `label` is kept as a safe fallback (offline / fetch error).
 * 2. Dynamic entries present in the backend taxonomy but not represented by any
 *    static option (matched by taxonomyKey). These appear with a pin emoji and
 *    the localized label. Their `id` is the taxonomy key (new backend growth).
 *
 * The `id` of every static option is preserved verbatim (only the visible label
 * is localized), so the subcategory ids sent to the backend never change.
 */
export function getInterestSubcategories(
  interestId: string,
  taxonomy: TaxonomyData,
  locale: 'en' | 'es' = 'en',
): SubcategoryOption[] {
  const staticOpts = SUBCATEGORIES_BY_INTEREST[interestId] ?? [];
  const categoryKey = INTEREST_TO_CATEGORY[interestId];
  if (!categoryKey) return staticOpts;

  const labels = taxonomy.labels?.[locale] ?? {};
  const keyFor = (o: SubcategoryOption): string => o.taxonomyKey ?? o.id;

  // Localize static options: keep id/emoji/icon, swap only the visible label.
  const localizedStatic: SubcategoryOption[] = staticOpts.map((o) => {
    const label = labels[`${categoryKey}.${keyFor(o)}`];
    return label ? { ...o, label } : o;
  });

  // Dynamic extras: taxonomy keys with no static representation.
  const staticTaxKeys = new Set(staticOpts.map(keyFor));
  const dynamicKeys = taxonomy.subcategoriesByCategory[categoryKey] ?? [];
  const dynamicExtras: SubcategoryOption[] = dynamicKeys
    .filter((key) => !staticTaxKeys.has(key))
    .map((key) => {
      const label = labels[`${categoryKey}.${key}`] ?? key;
      return { id: key, label, emoji: '\u{1F4CD}' };
    });

  return [...localizedStatic, ...dynamicExtras];
}

export function useTaxonomy() {
  const [taxonomy, setTaxonomy] = useState<TaxonomyData>(getTaxonomy);

  useEffect(() => {
    let cancelled = false;
    refreshTaxonomy().then(() => {
      if (!cancelled) setTaxonomy(getTaxonomy());
    });
    return () => { cancelled = true; };
  }, []);

  return taxonomy;
}
