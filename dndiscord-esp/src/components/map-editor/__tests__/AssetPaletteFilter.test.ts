import { describe, it, expect } from 'vitest';
import {
  filterCategories,
  pickFavoritesCategory,
  FAVORITES_CATEGORY_ID,
} from '../AssetPaletteFilter';
import type { AssetCategory, MapAsset, MapAssetType } from '../types';

const cat = (id: string, name: string, assets: MapAsset[]): AssetCategory => ({
  id,
  name,
  assets,
});
const a = (
  id: string,
  name: string,
  path: string,
  type: MapAssetType = 'decoration'
): MapAsset => ({ id, name, path, type });

const FIXTURES: AssetCategory[] = [
  cat('donjon', 'Donjon', [
    a('torch_lit', 'Torche', '/assets/dungeon/torch_lit.gltf'),
    a('chest', 'Coffre', '/assets/dungeon/chest.gltf'),
  ]),
  cat('nature', 'Nature', [
    a('tree1', 'Arbre', '/assets/nature/Tree_1_A_Color1.gltf', 'nature'),
  ]),
];

describe('AssetPaletteFilter.filterCategories', () => {
  it('returns the input unchanged when the query is empty', () => {
    expect(filterCategories(FIXTURES, '')).toEqual(FIXTURES);
  });

  it('returns the input unchanged when the query is whitespace only', () => {
    expect(filterCategories(FIXTURES, '   ')).toEqual(FIXTURES);
  });

  it('matches on the asset display name (case-insensitive)', () => {
    const out = filterCategories(FIXTURES, 'TORCH');
    expect(out).toHaveLength(1);
    expect(out[0].assets).toHaveLength(1);
    expect(out[0].assets[0].id).toBe('torch_lit');
  });

  it('drops categories that have zero matching assets', () => {
    const out = filterCategories(FIXTURES, 'arbre');
    expect(out.map((c) => c.id)).toEqual(['nature']);
  });

  it('matches on path too, not just display name', () => {
    const out = filterCategories(FIXTURES, 'Tree_1_A');
    expect(out).toHaveLength(1);
    expect(out[0].assets[0].id).toBe('tree1');
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterCategories(FIXTURES, 'zzz-nope')).toEqual([]);
  });
});

describe('AssetPaletteFilter.pickFavoritesCategory', () => {
  it('returns a pseudo-category whose assets are favorites that exist in the catalog', () => {
    const favPaths = [
      '/assets/dungeon/torch_lit.gltf',
      '/assets/does-not-exist.gltf',
    ];
    const out = pickFavoritesCategory(FIXTURES, favPaths);
    expect(out.id).toBe(FAVORITES_CATEGORY_ID);
    expect(out.assets).toHaveLength(1);
    expect(out.assets[0].id).toBe('torch_lit');
  });

  it('preserves the order of favPaths rather than catalog order', () => {
    const favPaths = [
      '/assets/nature/Tree_1_A_Color1.gltf',
      '/assets/dungeon/chest.gltf',
      '/assets/dungeon/torch_lit.gltf',
    ];
    const out = pickFavoritesCategory(FIXTURES, favPaths);
    expect(out.assets.map((a) => a.id)).toEqual([
      'tree1',
      'chest',
      'torch_lit',
    ]);
  });

  it('returns an empty category when no favorites match', () => {
    const out = pickFavoritesCategory(FIXTURES, ['/assets/missing.gltf']);
    expect(out.assets).toEqual([]);
  });
});
