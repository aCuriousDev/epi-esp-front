/**
 * Curated subset of the asset catalog. Shown by default in the map builder
 * palette ("Favoris" tab); the full catalog is still accessible via the
 * "Tous" tab. Also used as the preload list on editor mount so first-drop
 * placement is instant.
 *
 * Paths must correspond to entries in `ASSET_PACKS` (config/assetPacks.ts).
 * This file is intentionally hand-maintained — nothing on disk changes.
 */

export type FavoriteTag = 'ground' | 'wall' | 'prop' | 'nature' | 'light' | 'resource';

export interface FavoriteAsset {
  path: string;
  label: string;
  tag: FavoriteTag;
}

export const ASSET_FAVORITES: FavoriteAsset[] = [
  // Ground (~12)
  { path: '/assets/dungeon/floor_tile_small.gltf', label: 'Dalle', tag: 'ground' },
  { path: '/assets/dungeon/floor_tile_large.gltf', label: 'Dalle large', tag: 'ground' },
  { path: '/assets/dungeon/floor_tile_small_decorated.gltf', label: 'Dalle décorée', tag: 'ground' },
  { path: '/assets/dungeon/floor_dirt_small_A.gltf', label: 'Terre A', tag: 'ground' },
  { path: '/assets/dungeon/floor_dirt_small_B.gltf', label: 'Terre B', tag: 'ground' },
  { path: '/assets/dungeon/floor_wood_small.gltf', label: 'Parquet', tag: 'ground' },
  { path: '/assets/dungeon/floor_wood_small_dark.gltf', label: 'Parquet sombre', tag: 'ground' },
  { path: '/assets/blocks/grass.gltf', label: 'Herbe', tag: 'ground' },
  { path: '/assets/blocks/sand_A.gltf', label: 'Sable', tag: 'ground' },
  { path: '/assets/blocks/stone.gltf', label: 'Pierre', tag: 'ground' },
  { path: '/assets/blocks/snow.gltf', label: 'Neige', tag: 'ground' },
  { path: '/assets/blocks/water.gltf', label: 'Eau', tag: 'ground' },

  // Walls (~10)
  { path: '/assets/dungeon/wall.gltf', label: 'Mur', tag: 'wall' },
  { path: '/assets/dungeon/wall_half.gltf', label: 'Demi mur', tag: 'wall' },
  { path: '/assets/dungeon/wall_corner.gltf', label: 'Coin', tag: 'wall' },
  { path: '/assets/dungeon/wall_doorway.gltf', label: 'Porte', tag: 'wall' },
  { path: '/assets/dungeon/wall_archedwindow_open.gltf', label: 'Fenêtre', tag: 'wall' },
  { path: '/assets/dungeon/wall_broken.gltf', label: 'Mur brisé', tag: 'wall' },
  { path: '/assets/dungeon/wall_cracked.gltf', label: 'Mur fissuré', tag: 'wall' },
  { path: '/assets/dungeon/pillar.gltf', label: 'Pilier', tag: 'wall' },
  { path: '/assets/dungeon/column.gltf', label: 'Colonne', tag: 'wall' },
  { path: '/assets/blocks/bricks_B.gltf', label: 'Briques', tag: 'wall' },

  // Props (~15)
  { path: '/assets/dungeon/barrel_large.gltf', label: 'Tonneau', tag: 'prop' },
  { path: '/assets/dungeon/box_large.gltf', label: 'Caisse', tag: 'prop' },
  { path: '/assets/dungeon/crates_stacked.gltf', label: 'Caisses empilées', tag: 'prop' },
  { path: '/assets/dungeon/chest.gltf', label: 'Coffre', tag: 'prop' },
  { path: '/assets/dungeon/chair.gltf', label: 'Chaise', tag: 'prop' },
  { path: '/assets/dungeon/table_medium.gltf', label: 'Table', tag: 'prop' },
  { path: '/assets/dungeon/bed_frame.gltf', label: 'Lit', tag: 'prop' },
  { path: '/assets/dungeon/stairs.gltf', label: 'Escalier', tag: 'prop' },
  { path: '/assets/dungeon/shelf_large.gltf', label: 'Étagère', tag: 'prop' },
  { path: '/assets/dungeon/keg.gltf', label: 'Baril', tag: 'prop' },
  { path: '/assets/dungeon/banner_red.gltf', label: 'Bannière rouge', tag: 'prop' },
  { path: '/assets/dungeon/banner_blue.gltf', label: 'Bannière bleue', tag: 'prop' },
  { path: '/assets/dungeon/rubble_large.gltf', label: 'Gravats', tag: 'prop' },
  { path: '/assets/dungeon/trunk_large_A.gltf', label: 'Malle', tag: 'prop' },
  { path: '/assets/furniture/armchair.gltf', label: 'Fauteuil', tag: 'prop' },

  // Nature (~10)
  { path: '/assets/nature/Tree_1_A_Color1.gltf', label: 'Arbre', tag: 'nature' },
  { path: '/assets/nature/Tree_2_A_Color1.gltf', label: 'Arbre 2', tag: 'nature' },
  { path: '/assets/nature/Tree_Bare_1_A_Color1.gltf', label: 'Arbre mort', tag: 'nature' },
  { path: '/assets/nature/Bush_1_A_Color1.gltf', label: 'Buisson', tag: 'nature' },
  { path: '/assets/nature/Bush_2_A_Color1.gltf', label: 'Buisson 2', tag: 'nature' },
  { path: '/assets/nature/Rock_1_A_Color1.gltf', label: 'Rocher', tag: 'nature' },
  { path: '/assets/nature/Rock_2_A_Color1.gltf', label: 'Rocher 2', tag: 'nature' },
  { path: '/assets/nature/Rock_3_A_Color1.gltf', label: 'Rocher 3', tag: 'nature' },
  { path: '/assets/nature/Grass_1_A_Color1.gltf', label: 'Herbes', tag: 'nature' },
  { path: '/assets/halloween/tree_dead_large.gltf', label: 'Arbre mort XL', tag: 'nature' },

  // Lights (~5) — also rendered as placeable props; Phase 4 will add
  // PointLight + flicker spawning around these.
  { path: '/assets/dungeon/torch_lit.gltf', label: 'Torche', tag: 'light' },
  { path: '/assets/dungeon/torch_mounted.gltf', label: 'Torche murale', tag: 'light' },
  { path: '/assets/dungeon/candle_lit.gltf', label: 'Bougie', tag: 'light' },
  { path: '/assets/dungeon/candle_triple.gltf', label: 'Chandelier', tag: 'light' },
  { path: '/assets/halloween/lantern_standing.gltf', label: 'Lanterne', tag: 'light' },

  // Resources (~8)
  { path: '/assets/dungeon/chest_gold.gltf', label: 'Coffre or', tag: 'resource' },
  { path: '/assets/dungeon/coin_stack_large.gltf', label: 'Pile pièces', tag: 'resource' },
  { path: '/assets/dungeon/coin.gltf', label: 'Pièce', tag: 'resource' },
  { path: '/assets/dungeon/key.gltf', label: 'Clé', tag: 'resource' },
  { path: '/assets/dungeon/sword_shield.gltf', label: 'Épée & bouclier', tag: 'resource' },
  { path: '/assets/halloween/skull.gltf', label: 'Crâne', tag: 'resource' },
  { path: '/assets/halloween/bone_A.gltf', label: 'Os', tag: 'resource' },
  { path: '/assets/halloween/gravestone.gltf', label: 'Tombe', tag: 'resource' },
];

export const ASSET_FAVORITE_PATHS: string[] = ASSET_FAVORITES.map((f) => f.path);
