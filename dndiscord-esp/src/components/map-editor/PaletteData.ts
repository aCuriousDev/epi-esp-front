import { ASSET_PACKS } from '../../config/assetPacks';
import type { MapAsset, MapAssetType, AssetCategory } from './types';

/**
 * Given a `basePath` and `fileName` under `/public/assets/...`, produce a
 * stable `MapAsset` with a human-readable display name. Kept as a pure
 * function so the palette builder, tests, and any future scripts can
 * reuse it.
 */
export function createAssetFromPath(
  basePath: string,
  fileName: string,
  type: MapAssetType,
  displayName?: string
): MapAsset {
  const id = fileName
    .replace(/\.(gltf|glb)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  const name =
    displayName ||
    fileName
      .replace(/\.(gltf|glb)$/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  return {
    id,
    name,
    path: `${basePath}/${fileName}`,
    type,
  };
}

export function createAssetsFromFiles(
  basePath: string,
  files: string[],
  type: MapAssetType
): MapAsset[] {
  return files.map((file) => createAssetFromPath(basePath, file, type));
}

export const CHARACTER_ASSETS: MapAsset[] = [
  { id: 'knight', name: 'Knight', path: '/models/characters/knight/knight.glb', type: 'character' },
  { id: 'rogue', name: 'Rogue', path: '/models/characters/rogue/rogue.glb', type: 'character' },
  { id: 'wizard', name: 'Wizard', path: '/models/characters/wizard/wizard.glb', type: 'character' },
];

export const ENEMY_ASSETS: MapAsset[] = [
  { id: 'skeleton_warrior', name: 'Skeleton Warrior', path: '/models/enemies/skeleton_warrior/skeleton_warrior.glb', type: 'enemy' },
  { id: 'skeleton_mage', name: 'Skeleton Mage', path: '/models/enemies/skeleton_mage/skeleton_mage.glb', type: 'enemy' },
  { id: 'skeleton_rogue', name: 'Skeleton Rogue', path: '/models/enemies/skeleton_rogue/skeleton_rogue.glb', type: 'enemy' },
];

/**
 * Full flattened catalog built from `ASSET_PACKS`, grouped by `catName`.
 * Characters + Enemies are appended last.
 */
export const ASSET_CATEGORIES: AssetCategory[] = (() => {
  const groupedByCatName = new Map<string, MapAsset[]>();

  Object.values(ASSET_PACKS).forEach((pack) => {
    const packAssets = createAssetsFromFiles(pack.basePath, pack.files, pack.type);
    const catName = pack.catName;
    if (!groupedByCatName.has(catName)) {
      groupedByCatName.set(catName, []);
    }
    groupedByCatName.get(catName)!.push(...packAssets);
  });

  const categories: AssetCategory[] = [];
  groupedByCatName.forEach((assets, catName) => {
    categories.push({
      id: catName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: catName,
      assets,
    });
  });

  categories.push({ id: 'enemies', name: 'Enemies', assets: ENEMY_ASSETS });
  categories.push({ id: 'characters', name: 'Characters', assets: CHARACTER_ASSETS });

  return categories;
})();
