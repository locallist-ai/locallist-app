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

/**
 * Returns subcategory options for a given interest id by merging:
 * 1. Static entries from SUBCATEGORIES_BY_INTEREST (with emoji/icon metadata).
 * 2. Dynamic entries from the backend taxonomy not already in the static list.
 * New dynamic entries appear without emoji (plain text).
 */
export function getInterestSubcategories(
  interestId: string,
  taxonomy: TaxonomyData,
  locale: 'en' | 'es' = 'en',
): SubcategoryOption[] {
  const staticOpts = SUBCATEGORIES_BY_INTEREST[interestId] ?? [];
  const categoryKey = INTEREST_TO_CATEGORY[interestId];
  if (!categoryKey) return staticOpts;

  const dynamicKeys = taxonomy.subcategoriesByCategory[categoryKey] ?? [];
  const staticIds = new Set(staticOpts.map((o) => o.id));

  const dynamicExtras: SubcategoryOption[] = dynamicKeys
    .filter((key) => !staticIds.has(key))
    .map((key) => {
      const labelKey = `${categoryKey}.${key}`;
      const label = taxonomy.labels[locale]?.[labelKey] ?? key;
      return { id: key, label, emoji: '\u{1F4CD}' };
    });

  return [...staticOpts, ...dynamicExtras];
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
