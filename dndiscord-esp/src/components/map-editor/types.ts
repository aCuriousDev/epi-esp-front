import type { AbstractMesh } from '@babylonjs/core';

export type MapAssetType =
  | 'floor'
  | 'wall'
  | 'block'
  | 'water'
  | 'character'
  | 'enemy'
  | 'nature'
  | 'furniture'
  | 'decoration'
  | 'resource';

export interface MapAsset {
  id: string;
  name: string;
  path: string;
  type: MapAssetType;
  icon?: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  assets: MapAsset[];
}

/**
 * A single asset stacked on a grid cell. Height/bottomY/topY are in the
 * cell's local Y space (ground = 0) so stacks can be computed without
 * re-measuring bounding boxes.
 */
export interface StackedAsset {
  mesh: AbstractMesh;
  asset: MapAsset;
  height: number;
  bottomY: number;
  topY: number;
}
