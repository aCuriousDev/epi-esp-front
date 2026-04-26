import type { AssetCategory, MapAsset } from './types';

export const FAVORITES_CATEGORY_ID = 'favoris';

/**
 * Case-insensitive search across asset display name AND path. Categories
 * with zero matches are dropped so the palette doesn't render empty
 * accordions while the user is typing.
 */
export function filterCategories(
  categories: AssetCategory[],
  query: string
): AssetCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return categories;
  return categories
    .map((cat) => ({
      ...cat,
      assets: cat.assets.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.path.toLowerCase().includes(q)
      ),
    }))
    .filter((cat) => cat.assets.length > 0);
}

/**
 * Build a synthetic "Favoris" category by picking assets out of the full
 * catalog that match the favorites whitelist. Missing paths (e.g. a typo
 * in favorites config) are silently skipped so one bad entry doesn't hide
 * the rest.
 */
export function pickFavoritesCategory(
  categories: AssetCategory[],
  favoritePaths: string[]
): AssetCategory {
  const byPath = new Map<string, MapAsset>();
  categories.forEach((cat) =>
    cat.assets.forEach((a) => byPath.set(a.path, a))
  );
  const assets: MapAsset[] = [];
  for (const p of favoritePaths) {
    const found = byPath.get(p);
    if (found) assets.push(found);
  }
  return { id: FAVORITES_CATEGORY_ID, name: 'Favoris', assets };
}
