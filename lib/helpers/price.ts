import type { TFunction } from 'i18next';

export function formatPriceLabel(
  priceRange: string | null | undefined,
  t: TFunction,
): string | null {
  if (!priceRange) return null;
  if (priceRange === 'FREE') return t('place.priceFree');
  return priceRange;
}
