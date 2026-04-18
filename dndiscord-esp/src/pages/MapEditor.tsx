import { Component, onMount, onCleanup, createSignal, For, Show, createEffect } from "solid-js";
import { A, useParams, useSearchParams, useNavigate } from "@solidjs/router";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-solid";
import { saveMap, loadMap, generateMapId, loadDungeon, saveDungeon, type SavedMapData, type SavedCellData, type SavedAssetData, type SavedLightData, type DungeonData } from "../services/mapStorage";
import {
	Engine,
	Scene,
	ArcRotateCamera,
	HemisphericLight,
	DirectionalLight,
	Vector3,
	Mesh,
	AbstractMesh,
	Color3,
	Color4,
	StandardMaterial,
	PBRMaterial,
	PointerEventTypes,
	MeshBuilder,
	TransformNode,
	BoundingInfo,
	PointLight,
	ShadowGenerator,
	GlowLayer,
} from "@babylonjs/core";
import { ModelLoader } from "../engine/ModelLoader";
import { gridToWorld, GRID_SIZE, TILE_SIZE } from "../game";
import { getCollisionProperties, doesAssetBlockMovement } from "../game/utils/CollisionUtils";
import type { MapAsset, AssetCategory, StackedAsset } from "../components/map-editor/types";
import {
	CHARACTER_ASSETS,
	ENEMY_ASSETS,
	ASSET_CATEGORIES,
} from "../components/map-editor/PaletteData";
import { ASSET_FAVORITE_PATHS } from "../config/assetFavorites";
import {
	filterCategories,
	pickFavoritesCategory,
} from "../components/map-editor/AssetPaletteFilter";
import {
	LIGHT_PRESETS,
	LIGHT_PRESET_IDS,
	type LightPresetId,
} from "../config/lightPresets";
import "@babylonjs/loaders";

/**
 * Verbose per-mesh positioning/placement logs. Firing them on every
 * preview hover created thousands of lines per second. Flip this to
 * true when actually debugging stacking or commit-height issues.
 */
const MAPEDITOR_DEBUG = false;

/**
 * Classe représentant une cellule de la grille avec ses données
 * Totalement découplée du visuel, data-driven
 */
class GridCell {
	public readonly x: number;
	public readonly z: number;
	private groundMesh: Mesh | null = null;
	private groundTopY: number = 0; // Hauteur du sommet du sol (pour empiler correctement au-dessus)
	private stackedAssets: StackedAsset[] = []; // Pile ordonnée du bas vers le haut
	private cellNode: TransformNode | null = null; // TransformNode parent de la cellule

	constructor(x: number, z: number) {
		this.x = x;
		this.z = z;
	}

	/**
	 * Initialise le TransformNode parent de la cellule
	 */
	public initializeCellNode(scene: Scene): void {
		if (this.cellNode) return;
		
		const worldPos = gridToWorld({ x: this.x, z: this.z });
		this.cellNode = new TransformNode(`cell_${this.x}_${this.z}`, scene);
		this.cellNode.position.set(worldPos.x, 0, worldPos.z);
	}

	/**
	 * Obtient le TransformNode parent de la cellule
	 */
	public getCellNode(): TransformNode | null {
		return this.cellNode;
	}

	/**
	 * Définit le mesh de sol de la cellule (positionné à y=0 dans l'espace local)
	 */
	public setGround(groundMesh: Mesh | null): void {
		if (this.groundMesh) {
			this.groundMesh.dispose();
		}
		this.groundMesh = groundMesh;
		if (this.cellNode && groundMesh) {
			groundMesh.parent = this.cellNode;
			groundMesh.position.y = 0; // Sol toujours à y=0 dans l'espace local
		} else {
			this.groundTopY = 0; // Réinitialiser si pas de sol
		}
	}

	/**
	 * Obtient le mesh de sol
	 */
	public getGround(): Mesh | null {
		return this.groundMesh;
	}

	/**
	 * Définit la hauteur du sommet du sol (topY)
	 * Appelé après le positionnement du sol pour que l'empilement se fasse au-dessus
	 */
	public setGroundTopY(topY: number): void {
		this.groundTopY = topY;
	}

	/**
	 * Obtient la hauteur du sommet du sol
	 */
	public getGroundTopY(): number {
		return this.groundTopY;
	}

	/**
	 * Ajoute un asset à la pile (empilement vertical)
	 */
	public addAsset(stackedAsset: StackedAsset): void {
		// Vérifier que le mesh est bien parenté au TransformNode de la cellule
		if (this.cellNode && stackedAsset.mesh.parent !== this.cellNode) {
			stackedAsset.mesh.parent = this.cellNode;
		}
		
		// Ajouter à la pile (ordre bas -> haut)
		this.stackedAssets.push(stackedAsset);
	}

	/**
	 * Retire un asset de la pile par son mesh
	 */
	public removeAsset(mesh: AbstractMesh): boolean {
		const index = this.stackedAssets.findIndex(sa => sa.mesh === mesh);
		if (index !== -1) {
			this.stackedAssets.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Retire tous les assets de la pile
	 */
	public clearAssets(): void {
		this.stackedAssets.forEach(sa => sa.mesh.dispose());
		this.stackedAssets = [];
	}

	/**
	 * Obtient la hauteur totale cumulée de tous les assets empilés
	 * Retourne groundTopY si aucun asset n'est empilé (pour empiler au-dessus du sol)
	 */
	public getStackHeight(): number {
		if (this.stackedAssets.length === 0) return this.groundTopY;
		const topAsset = this.stackedAssets[this.stackedAssets.length - 1];
		return Math.max(topAsset.topY, this.groundTopY);
	}

	/**
	 * Obtient la pile d'assets (lecture seule)
	 */
	public getStackedAssets(): readonly StackedAsset[] {
		return this.stackedAssets;
	}

	/**
	 * Obtient tous les meshes de la cellule (sol + assets)
	 */
	public getAllMeshes(): AbstractMesh[] {
		const meshes: AbstractMesh[] = [];
		if (this.groundMesh) {
			meshes.push(this.groundMesh);
		}
		this.stackedAssets.forEach(sa => meshes.push(sa.mesh));
		return meshes;
	}

	/**
	 * Recalcule les positions Y de tous les assets empilés
	 * Utilisé après suppression d'un asset au milieu de la pile, ou après changement de sol
	 * @param assetStackManager - Le gestionnaire d'empilement pour repositionner les meshes
	 */
	public restackAssets(assetStackManager: AssetStackManager): void {
		let currentHeight = this.groundTopY;
		for (const stackedAsset of this.stackedAssets) {
			// Repositionner le mesh au sommet courant de la pile
			assetStackManager.positionMeshAtHeight(stackedAsset.mesh, currentHeight, 0);
			
			// Recalculer les positions Y relatives
			const newPositions = assetStackManager.calculateCellRelativeYPositions(stackedAsset.mesh, 0);
			stackedAsset.bottomY = newPositions.bottomY;
			stackedAsset.topY = newPositions.topY;
			stackedAsset.height = newPositions.height;
			
			currentHeight = stackedAsset.topY;
		}
	}

	/**
	 * Nettoie complètement la cellule
	 */
	public dispose(): void {
		if (this.groundMesh) {
			this.groundMesh.dispose();
			this.groundMesh = null;
		}
		this.clearAssets();
		if (this.cellNode) {
			this.cellNode.dispose();
			this.cellNode = null;
		}
	}

	/**
	 * Calcule les propriétés de collision de cette cellule
	 * Utilise la même logique que le jeu pour déterminer walkable, movementCost, etc.
	 * Prend en compte les assets qui affectent cette cellule (même s'ils sont dans d'autres cellules)
	 */
	public getCollisionProperties(gridManager?: GridManager): { walkable: boolean; movementCost: number; blocksMovement: boolean } {
		// Par défaut, cellule walkable
		let walkable = true;
		let movementCost = 1;
		let blocksMovement = false;

		// Collecter tous les assets qui affectent cette cellule
		const affectingAssets: Array<{ mesh: AbstractMesh; assetType: string }> = [];

		// Vérifier le ground d'abord
		if (this.groundMesh) {
			const metadata = this.groundMesh.metadata as any;
			const groundType = metadata?.assetType || "floor";
			affectingAssets.push({ mesh: this.groundMesh, assetType: groundType });
		}

		// Vérifier les assets empilés dans cette cellule
		for (const stackedAsset of this.stackedAssets) {
			const metadata = stackedAsset.mesh.metadata as any;
			const assetType = metadata?.assetType || stackedAsset.asset.type;
			affectingAssets.push({ mesh: stackedAsset.mesh, assetType });
		}

		// Vérifier les assets d'autres cellules qui affectent cette cellule (assets multi-cellules)
		if (gridManager) {
			const externalAssets = gridManager.getAssetsAffectingCell(this.x, this.z);
			for (const externalMesh of externalAssets) {
				// Éviter les doublons (si l'asset est déjà dans cette cellule)
				if (!affectingAssets.some(a => a.mesh === externalMesh)) {
					const metadata = externalMesh.metadata as any;
					const assetType = metadata?.assetType || "floor";
					affectingAssets.push({ mesh: externalMesh, assetType });
				}
			}
		}

		// Traiter tous les assets qui affectent cette cellule
		for (const { assetType } of affectingAssets) {
			const assetProps = getCollisionProperties(assetType);

			// Si cet asset bloque le mouvement, mettre à jour les propriétés
			if (assetProps.blocksMovement) {
				walkable = assetProps.walkable;
				movementCost = assetProps.movementCost;
				blocksMovement = true;
				// Le premier asset bloquant gagne
				break;
			}

			// Si l'asset ne bloque pas mais a un coût de mouvement plus élevé, l'utiliser
			if (assetProps.movementCost > movementCost) {
				movementCost = assetProps.movementCost;
			}
		}

		return { walkable, movementCost, blocksMovement };
	}

	/**
	 * Exporte les données de la cellule pour la sauvegarde
	 * @param getAffectedCells - Fonction optionnelle pour obtenir les cellules affectées par un mesh (multi-cases)
	 */
	public exportData(getAffectedCells?: (meshName: string) => { x: number; z: number }[]): { x: number; z: number; ground?: any; stackedAssets: any[] } {
		const stackedAssets = this.stackedAssets.map(sa => {
			const metadata = sa.mesh.metadata as any;
			const data: any = {
				assetId: metadata?.assetId || sa.asset.id,
				assetPath: metadata?.assetPath || sa.asset.path,
				assetType: metadata?.assetType || sa.asset.type,
				scale: sa.mesh.scaling.x, // Assume uniform scaling
				rotationY: sa.mesh.rotation.y,
				positionY: sa.mesh.position.y,
			};
			// Inclure les cellules affectées pour les assets multi-cases
			if (getAffectedCells) {
				const affected = getAffectedCells(sa.mesh.name);
				if (affected.length > 1) {
					data.affectedCells = affected;
				}
			}
			return data;
		});

		let ground: any = undefined;
		if (this.groundMesh) {
			const metadata = this.groundMesh.metadata as any;
			ground = {
				assetId: metadata?.assetId || "unknown",
				assetPath: metadata?.assetPath || "unknown",
				assetType: metadata?.assetType || "floor",
				scale: this.groundMesh.scaling.x,
				rotationY: this.groundMesh.rotation.y,
				positionY: this.groundMesh.position.y,
			};
			// Inclure les cellules affectées pour les sols multi-cases
			if (getAffectedCells) {
				const affected = getAffectedCells(this.groundMesh.name);
				if (affected.length > 1) {
					ground.affectedCells = affected;
				}
			}
		}

		return {
			x: this.x,
			z: this.z,
			ground,
			stackedAssets,
		};
	}
}

/**
 * Gestionnaire de la grille - gère toutes les cellules de manière centralisée
 */
class GridManager {
	private cells: Map<string, GridCell> = new Map();
	private scene: Scene;
	// Map pour tracker quels assets affectent quelles cellules (pour les assets multi-cellules)
	// Key: mesh unique name, Value: Set de clés de cellules affectées
	private assetCellMap: Map<string, Set<string>> = new Map();

	constructor(scene: Scene) {
		this.scene = scene;
		this.initializeGrid();
	}

	/**
	 * Initialise toutes les cellules de la grille
	 */
	private initializeGrid(): void {
		for (let x = 0; x < GRID_SIZE; x++) {
			for (let z = 0; z < GRID_SIZE; z++) {
				const cell = new GridCell(x, z);
				cell.initializeCellNode(this.scene);
				this.cells.set(`${x},${z}`, cell);
			}
		}
	}

	/**
	 * Obtient une cellule par ses coordonnées
	 */
	public getCell(x: number, z: number): GridCell | null {
		return this.cells.get(`${x},${z}`) || null;
	}

	/**
	 * Obtient toutes les cellules
	 */
	public getAllCells(): GridCell[] {
		return Array.from(this.cells.values());
	}

	/**
	 * Nettoie toutes les cellules
	 */
	public dispose(): void {
		this.cells.forEach(cell => cell.dispose());
		this.cells.clear();
	}

	/**
	 * Exporte toutes les cellules pour la sauvegarde
	 * Inclut les données multi-cases (affectedCells) pour chaque asset
	 */
	public exportData(): Array<{ x: number; z: number; ground?: any; stackedAssets: any[] }> {
		// Créer une fonction de lookup pour convertir assetCellMap en coordonnées
		const getAffectedCells = (meshName: string): { x: number; z: number }[] => {
			const cellKeys = this.assetCellMap.get(meshName);
			if (!cellKeys) return [];
			return Array.from(cellKeys).map(key => {
				const [x, z] = key.split(',').map(Number);
				return { x, z };
			});
		};

		const cellsData: Array<{ x: number; z: number; ground?: any; stackedAssets: any[] }> = [];
		this.cells.forEach(cell => {
			const cellData = cell.exportData(getAffectedCells);
			// Ne sauvegarder que les cellules qui ont du contenu
			if (cellData.ground || cellData.stackedAssets.length > 0) {
				cellsData.push(cellData);
			}
		});
		return cellsData;
	}

	/**
	 * Enregistre qu'un asset affecte plusieurs cellules
	 */
	public registerAssetCells(meshName: string, cellKeys: string[]): void {
		this.assetCellMap.set(meshName, new Set(cellKeys));
	}

	/**
	 * Supprime l'enregistrement d'un asset
	 */
	public unregisterAsset(meshName: string): void {
		this.assetCellMap.delete(meshName);
	}

	/**
	 * Obtient toutes les cellules affectées par un asset
	 */
	public getCellsAffectedByAsset(meshName: string): GridCell[] {
		const cellKeys = this.assetCellMap.get(meshName);
		if (!cellKeys) return [];
		
		const cells: GridCell[] = [];
		cellKeys.forEach(key => {
			const cell = this.cells.get(key);
			if (cell) cells.push(cell);
		});
		return cells;
	}

	/**
	 * Obtient tous les assets qui affectent une cellule donnée
	 */
	public getAssetsAffectingCell(cellX: number, cellZ: number): AbstractMesh[] {
		const cellKey = `${cellX},${cellZ}`;
		const affectedMeshes: AbstractMesh[] = [];
		const foundMeshNames = new Set<string>();
		
		this.assetCellMap.forEach((cellKeys, meshName) => {
			if (cellKeys.has(cellKey) && !foundMeshNames.has(meshName)) {
				// Trouver le mesh par son nom dans toutes les cellules
				for (const cell of this.cells.values()) {
					const stackedAssets = cell.getStackedAssets();
					for (const stackedAsset of stackedAssets) {
						if (stackedAsset.mesh.name === meshName) {
							affectedMeshes.push(stackedAsset.mesh);
							foundMeshNames.add(meshName);
							return; // Sortir de la boucle forEach
						}
					}
					const ground = cell.getGround();
					if (ground && ground.name === meshName) {
						affectedMeshes.push(ground);
						foundMeshNames.add(meshName);
						return; // Sortir de la boucle forEach
					}
				}
			}
		});
		
		return affectedMeshes;
	}
}

/**
 * Gestionnaire de l'empilement d'assets
 * Calcule les hauteurs dynamiquement depuis les bounding boxes combinées
 */
class AssetStackManager {
	private scene: Scene;
	private modelLoader: ModelLoader;

	constructor(scene: Scene, modelLoader: ModelLoader) {
		this.scene = scene;
		this.modelLoader = modelLoader;
	}

	/**
	 * Charge un mesh GLB sans correction d'origine
	 * L'origine sera corrigée après le scaling et le parenting
	 */
	public async loadModel(asset: MapAsset, uniqueName: string): Promise<AbstractMesh> {
		const mesh = await this.modelLoader.loadModel(asset.path, uniqueName);
		
		// Attendre que le mesh soit complètement chargé
		await new Promise(resolve => setTimeout(resolve, 50));
		
		return mesh;
	}

	/**
	 * Calcule la bounding box combinée complète (X, Y, Z) d'un mesh et de tous ses enfants
	 */
	public getCombinedWorldBoundsFull(mesh: AbstractMesh): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } | null {
		// Forcer le recalcul des matrices world pour tout le monde
		mesh.computeWorldMatrix(true);
		const childMeshes = mesh.getChildMeshes(false);
		childMeshes.forEach(child => child.computeWorldMatrix(true));
		
		let globalMinX = Infinity, globalMaxX = -Infinity;
		let globalMinY = Infinity, globalMaxY = -Infinity;
		let globalMinZ = Infinity, globalMaxZ = -Infinity;
		let hasValidBounds = false;
		
		// Vérifier le mesh racine lui-même
		const rootBounding = mesh.getBoundingInfo();
		if (rootBounding) {
			const min = rootBounding.boundingBox.minimumWorld;
			const max = rootBounding.boundingBox.maximumWorld;
			if (isFinite(min.x) && isFinite(max.x) && isFinite(min.y) && isFinite(max.y) && isFinite(min.z) && isFinite(max.z)) {
				globalMinX = Math.min(globalMinX, min.x);
				globalMaxX = Math.max(globalMaxX, max.x);
				globalMinY = Math.min(globalMinY, min.y);
				globalMaxY = Math.max(globalMaxY, max.y);
				globalMinZ = Math.min(globalMinZ, min.z);
				globalMaxZ = Math.max(globalMaxZ, max.z);
				hasValidBounds = true;
			}
		}
		
		// Parcourir tous les meshes enfants
		for (const childMesh of childMeshes) {
			if (childMesh instanceof AbstractMesh) {
				const boundingInfo = childMesh.getBoundingInfo();
				if (boundingInfo) {
					const min = boundingInfo.boundingBox.minimumWorld;
					const max = boundingInfo.boundingBox.maximumWorld;
					if (isFinite(min.x) && isFinite(max.x) && isFinite(min.y) && isFinite(max.y) && isFinite(min.z) && isFinite(max.z)) {
						globalMinX = Math.min(globalMinX, min.x);
						globalMaxX = Math.max(globalMaxX, max.x);
						globalMinY = Math.min(globalMinY, min.y);
						globalMaxY = Math.max(globalMaxY, max.y);
						globalMinZ = Math.min(globalMinZ, min.z);
						globalMaxZ = Math.max(globalMaxZ, max.z);
						hasValidBounds = true;
					}
				}
			}
		}
		
		if (!hasValidBounds) {
			return null;
		}
		
		return { minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY, minZ: globalMinZ, maxZ: globalMaxZ };
	}

	/**
	 * Calcule la bounding box combinée d'un mesh et de tous ses enfants (Y seulement, pour compatibilité)
	 * C'est essentiel pour les modèles GLB où le mesh racine n'a pas de géométrie
	 */
	private getCombinedWorldBounds(mesh: AbstractMesh): { minY: number; maxY: number } | null {
		// Forcer le recalcul des matrices world pour tout le monde
		mesh.computeWorldMatrix(true);
		const childMeshes = mesh.getChildMeshes(false);
		childMeshes.forEach(child => child.computeWorldMatrix(true));
		
		let globalMinY = Infinity;
		let globalMaxY = -Infinity;
		let hasValidBounds = false;
		
		// Vérifier le mesh racine lui-même
		const rootBounding = mesh.getBoundingInfo();
		if (rootBounding) {
			const rootMin = rootBounding.boundingBox.minimumWorld.y;
			const rootMax = rootBounding.boundingBox.maximumWorld.y;
			// Vérifier que la bounding box est valide (pas 0,0 ou Infinity)
			if (isFinite(rootMin) && isFinite(rootMax) && rootMax > rootMin) {
				globalMinY = Math.min(globalMinY, rootMin);
				globalMaxY = Math.max(globalMaxY, rootMax);
				hasValidBounds = true;
			}
		}
		
		// Parcourir tous les meshes enfants et calculer la bounding box combinée
		for (const childMesh of childMeshes) {
			if (childMesh instanceof AbstractMesh) {
				const boundingInfo = childMesh.getBoundingInfo();
				if (boundingInfo) {
					const minY = boundingInfo.boundingBox.minimumWorld.y;
					const maxY = boundingInfo.boundingBox.maximumWorld.y;
					// Vérifier que la bounding box est valide
					if (isFinite(minY) && isFinite(maxY) && maxY > minY) {
						globalMinY = Math.min(globalMinY, minY);
						globalMaxY = Math.max(globalMaxY, maxY);
						hasValidBounds = true;
					}
				}
			}
		}
		
		if (!hasValidBounds) {
			console.warn('No valid bounding box found for mesh:', mesh.name);
			return null;
		}
		
		return { minY: globalMinY, maxY: globalMaxY };
	}

	/**
	 * Calcule la hauteur réelle d'un mesh depuis sa bounding box combinée (après transforms)
	 */
	public calculateMeshHeight(mesh: AbstractMesh): number {
		const bounds = this.getCombinedWorldBounds(mesh);
		if (!bounds) return 0;
		return bounds.maxY - bounds.minY;
	}

	/**
	 * Calcule le Y minimum du mesh en espace world (le point le plus bas)
	 */
	public calculateWorldBottomY(mesh: AbstractMesh): number {
		const bounds = this.getCombinedWorldBounds(mesh);
		if (!bounds) return 0;
		return bounds.minY;
	}

	/**
	 * Calcule le Y maximum du mesh en espace world (le point le plus haut)
	 */
	public calculateWorldTopY(mesh: AbstractMesh): number {
		const bounds = this.getCombinedWorldBounds(mesh);
		if (!bounds) return 0;
		return bounds.maxY;
	}

	/**
	 * Calcule les positions Y (bas et haut) relatives à la cellule parente
	 * Prend en compte le scaling et toutes les transformations
	 */
	public calculateCellRelativeYPositions(mesh: AbstractMesh, cellWorldY: number = 0): { bottomY: number; topY: number; height: number } {
		const bounds = this.getCombinedWorldBounds(mesh);
		if (!bounds) {
			return { bottomY: 0, topY: 0, height: 0 };
		}
		
		const height = bounds.maxY - bounds.minY;
		
		// Convertir les coordonnées world en coordonnées relatives à la cellule
		const bottomY = bounds.minY - cellWorldY;
		const topY = bounds.maxY - cellWorldY;
		
		return { bottomY, topY, height };
	}

	/**
	 * Crée un StackedAsset à partir d'un mesh positionné et d'un asset
	 * Le mesh doit être déjà positionné correctement dans la cellule
	 */
	public createStackedAsset(mesh: AbstractMesh, asset: MapAsset, cellWorldY: number = 0): StackedAsset {
		const { bottomY, topY, height } = this.calculateCellRelativeYPositions(mesh, cellWorldY);
		
		if (MAPEDITOR_DEBUG) console.log(`Created StackedAsset: ${asset.name} - bottomY: ${bottomY.toFixed(3)}, topY: ${topY.toFixed(3)}, height: ${height.toFixed(3)}`);
		
		return {
			mesh,
			asset,
			height,
			bottomY,
			topY,
		};
	}

	/**
	 * Positionne un mesh pour que son bas soit à une hauteur Y donnée dans l'espace de la cellule
	 * Prend en compte le scaling et toutes les transformations actuelles du mesh
	 * @param mesh - Le mesh à positionner (doit être déjà parenté et scalé)
	 * @param targetBottomY - La hauteur Y cible pour le bas du mesh (dans l'espace cellule)
	 * @param cellWorldY - La position Y world de la cellule (généralement 0)
	 */
	public positionMeshAtHeight(mesh: AbstractMesh, targetBottomY: number, cellWorldY: number = 0): void {
		const bounds = this.getCombinedWorldBounds(mesh);
		if (!bounds) {
			console.warn('Cannot position mesh - no valid bounding box:', mesh.name);
			return;
		}
		
		// Obtenir la position actuelle du bas du mesh en world space
		const currentWorldBottomY = bounds.minY;
		
		// Calculer où le bas devrait être en world space
		const targetWorldBottomY = cellWorldY + targetBottomY;
		
		// Calculer l'offset nécessaire
		const offsetY = targetWorldBottomY - currentWorldBottomY;
		
		if (MAPEDITOR_DEBUG) console.log(`Positioning ${mesh.name}: currentBottom=${currentWorldBottomY.toFixed(3)}, targetBottom=${targetWorldBottomY.toFixed(3)}, offset=${offsetY.toFixed(3)}`);
		
		// Appliquer l'offset à la position du mesh
		mesh.position.y += offsetY;
		
		// Mettre à jour la matrice pour tous les enfants aussi
		mesh.computeWorldMatrix(true);
		mesh.getChildMeshes(false).forEach(child => child.computeWorldMatrix(true));
	}

	/**
	 * Positionne un mesh au sommet de la pile d'une cellule
	 * @param mesh - Le mesh à positionner (doit être déjà parenté et scalé)
	 * @param cell - La cellule cible
	 */
	public positionMeshOnStack(mesh: AbstractMesh, cell: GridCell): void {
		const stackHeight = cell.getStackHeight();
		if (MAPEDITOR_DEBUG) console.log(`Placing on stack at height: ${stackHeight.toFixed(3)}`);
		this.positionMeshAtHeight(mesh, stackHeight, 0);
	}
}

// Palette data (CHARACTER_ASSETS / ENEMY_ASSETS / ASSET_CATEGORIES) lives in
// src/components/map-editor/PaletteData.ts and is imported at the top.

export default function MapEditor() {
	const params = useParams<{ mapId?: string }>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	// Dungeon context from URL params
	const getDungeonId = () => searchParams.dungeon as string | undefined;
	const getRoomIndex = () => {
		const r = searchParams.room;
		return r !== undefined ? parseInt(r as string) : undefined;
	};
	
	let canvasRef!: HTMLCanvasElement;
	let engine: Engine | null = null;
	let scene: Scene | null = null;
	let camera: ArcRotateCamera | null = null;
	let modelLoader: ModelLoader | null = null;
	let gridManager: GridManager | null = null;
	let assetStackManager: AssetStackManager | null = null;
	let editorShadowGenerator: ShadowGenerator | null = null;
	let editorGlowLayer: GlowLayer | null = null;
	
	const [mapId, setMapId] = createSignal<string | null>(null);
	const [mapName, setMapName] = createSignal<string>("Nouvelle Map");
	const [dungeonData, setDungeonData] = createSignal<DungeonData | null>(null);
	const [selectedAsset, setSelectedAsset] = createSignal<MapAsset | null>(null);
	const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set());
	const [activePaletteTab, setActivePaletteTab] = createSignal<"favoris" | "tous">("favoris");
	const [searchQuery, setSearchQuery] = createSignal("");

	const visibleCategories = () => {
		const base = activePaletteTab() === "favoris"
			? [pickFavoritesCategory(ASSET_CATEGORIES, ASSET_FAVORITE_PATHS)]
			: ASSET_CATEGORIES;
		return filterCategories(base, searchQuery());
	};
	const [rotationAngle, setRotationAngle] = createSignal(0);
	const [deleteMode, setDeleteMode] = createSignal(false);
	const [editMode, setEditMode] = createSignal(false);
	const [editingAsset, setEditingAsset] = createSignal<{ asset: MapAsset; cell: GridCell; mesh: AbstractMesh } | null>(null);
	const [isLoading, setIsLoading] = createSignal(false);
	const [showCollisions, setShowCollisions] = createSignal(false);
	const [collisionPreviewMode, setCollisionPreviewMode] = createSignal(false);
	const [selectedCollisionAsset, setSelectedCollisionAsset] = createSignal<{ asset: MapAsset; cell: GridCell; mesh: AbstractMesh } | null>(null);
	const [zoneSelectionMode, setZoneSelectionMode] = createSignal(false);
	const [lightMode, setLightMode] = createSignal(false);
	const [selectedLightPreset, setSelectedLightPreset] = createSignal<LightPresetId>("torch");
	const [placedLights, setPlacedLights] = createSignal<SavedLightData[]>([]);

	// Babylon objects mirroring placedLights, keyed by "x,z". Kept outside the
	// signal so disposal doesn't force a reactive pass on every mutation.
	const lightVisuals = new Map<string, { mesh: AbstractMesh; light: PointLight }>();
	const lightKey = (x: number, z: number) => `${x},${z}`;

	const spawnLightFixture = async (data: SavedLightData): Promise<void> => {
		if (!scene || !modelLoader) return;
		const preset = LIGHT_PRESETS[data.presetId];
		if (!preset) return;
		despawnLightFixture(data.x, data.z);

		const world = gridToWorld({ x: data.x, z: data.z });
		const key = lightKey(data.x, data.z);
		const uniqueName = `editor_light_${data.presetId}_${key}_${Date.now()}`;
		try {
			const mesh = await modelLoader.loadModel(preset.meshPath, uniqueName);
			mesh.position.set(world.x, data.y ?? 0, world.z);
			mesh.scaling.setAll(0.5);

			const light = new PointLight(
				`editor_pl_${uniqueName}`,
				new Vector3(world.x, (data.y ?? 0) + preset.lightYOffset, world.z),
				scene,
			);
			const color = data.colorOverride
				? new Color3(data.colorOverride[0], data.colorOverride[1], data.colorOverride[2])
				: preset.lightColor;
			light.diffuse = color;
			light.specular = color;
			light.intensity = data.intensityOverride ?? preset.intensity;
			light.radius = preset.radius;
			light.range = preset.range;

			// Paint the fixture mesh emissive so it reads as "lit" even if
			// the PointLight is occluded. GlowLayer picks this up for a
			// subtle halo — kept modest so the fixture silhouette stays
			// readable rather than blowing out into a white blob.
			const tintMesh = (m: AbstractMesh) => {
				const mat = m.material;
				if (mat instanceof StandardMaterial) {
					mat.emissiveColor = preset.fixtureEmissive.clone();
				} else if (mat instanceof PBRMaterial) {
					mat.emissiveColor = preset.fixtureEmissive.clone();
					mat.emissiveIntensity = 0.6;
				}
				m.getChildMeshes().forEach(tintMesh);
			};
			tintMesh(mesh);

			lightVisuals.set(key, { mesh, light });
		} catch (error) {
			console.warn(`[MapEditor] Failed to spawn light ${preset.id}:`, error);
		}
	};

	const despawnLightFixture = (x: number, z: number): void => {
		const entry = lightVisuals.get(lightKey(x, z));
		if (!entry) return;
		if (!entry.mesh.isDisposed()) entry.mesh.dispose(false, true);
		entry.light.dispose();
		lightVisuals.delete(lightKey(x, z));
	};

	const clearAllLightFixtures = (): void => {
		lightVisuals.forEach((e) => {
			if (!e.mesh.isDisposed()) e.mesh.dispose(false, true);
			e.light.dispose();
		});
		lightVisuals.clear();
	};
	const [selectionStart, setSelectionStart] = createSignal<{ x: number; z: number } | null>(null);
	const [selectionEnd, setSelectionEnd] = createSignal<{ x: number; z: number } | null>(null);
	const [isSelecting, setIsSelecting] = createSignal(false);
	const [isCameraLocked, setIsCameraLocked] = createSignal(false);
	
	// Zones de placement pour combats et téléportation
	const [spawnZones, setSpawnZones] = createSignal<Map<string, "ally" | "enemy" | "teleport">>(new Map());
	const [contextMenuCell, setContextMenuCell] = createSignal<{ x: number; z: number; screenX: number; screenY: number } | null>(null);
	
	let previewMesh: AbstractMesh | null = null;
	let previewAssetId: string | null = null;
	let previewLoadToken = 0; // guards against races when the selected asset changes mid-load
	let selectionOverlays: Map<string, Mesh> = new Map(); // Map des overlays de sélection par cellule
	let previewUpdateTimeout: number | null = null;
	let isUpdatingPreview: boolean = false; // Flag pour éviter les mises à jour multiples simultanées
	let collisionOverlays: Map<string, Mesh> = new Map(); // Map des overlays de collision par cellule
	let collisionPreviewOverlay: Mesh | null = null; // Overlay pour la prévisualisation de collision d'un asset
	let spawnZoneOverlays: Map<string, Mesh> = new Map(); // Map des overlays de zones de spawn (alliés/ennemis)
	let originalAssetAlpha: Map<AbstractMesh, number> = new Map(); // Sauvegarde de l'alpha original des assets (preview individuel)
	let collisionModeAlphas: Map<AbstractMesh, number> = new Map(); // Sauvegarde de l'alpha original des assets (mode collision global)
	let hoveredMesh: AbstractMesh | null = null; // Mesh actuellement survolé en mode delete/edit
	let hoveredMeshOriginalMaterials: Map<AbstractMesh, any> = new Map(); // Matériaux originaux (avant clonage) du mesh survolé

	// Update spawn zone overlays visualization
	const updateSpawnZoneOverlays = () => {
		if (!scene || !gridManager) return;

		// Clear existing overlays
		spawnZoneOverlays.forEach((overlay) => {
			if (!overlay.isDisposed()) {
				overlay.dispose();
			}
		});
		spawnZoneOverlays.clear();

		// Create overlays for spawn zones
		spawnZones().forEach((zoneType, cellKey) => {
			const [x, z] = cellKey.split(',').map(Number);
			if (x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE) return;

			const cell = gridManager!.getCell(x, z);
			if (!cell) return;

			const cellNode = cell.getCellNode();
			if (!cellNode) return;

			const overlay = MeshBuilder.CreatePlane(
				`spawnZone_${x}_${z}`,
				{ width: TILE_SIZE * 0.95, height: TILE_SIZE * 0.95 },
				scene
			);
			overlay.rotation.x = Math.PI / 2;
			overlay.position.set(0, 0.04, 0); // Légèrement au-dessus des autres overlays
			overlay.parent = cellNode;
			overlay.isPickable = false;

			const material = new StandardMaterial(`spawnZoneMat_${x}_${z}`, scene!);
			if (zoneType === "ally") {
				material.diffuseColor = new Color3(0, 1, 0);
				material.emissiveColor = new Color3(0, 0.5, 0);
			} else if (zoneType === "teleport") {
				material.diffuseColor = new Color3(0.6, 0, 1);
				material.emissiveColor = new Color3(0.3, 0, 0.5);
			} else {
				material.diffuseColor = new Color3(1, 0, 0);
				material.emissiveColor = new Color3(0.5, 0, 0);
			}
			material.alpha = 0.6;
			material.disableLighting = true;
			overlay.material = material;

			spawnZoneOverlays.set(cellKey, overlay);
		});
	};

	// Update selection overlay visualization
	const updateSelectionOverlay = () => {
		if (!scene || !gridManager) return;

		// Clear existing overlays
		selectionOverlays.forEach((overlay) => {
			if (!overlay.isDisposed()) {
				overlay.dispose();
			}
		});
		selectionOverlays.clear();

		// Create overlays for selected zone
		const start = selectionStart();
		const end = selectionEnd();
		if (!start || !end || !isSelecting()) return;

		const minX = Math.min(start.x, end.x);
		const maxX = Math.max(start.x, end.x);
		const minZ = Math.min(start.z, end.z);
		const maxZ = Math.max(start.z, end.z);

		for (let x = minX; x <= maxX; x++) {
			for (let z = minZ; z <= maxZ; z++) {
				if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
					const cell = gridManager.getCell(x, z);
					if (!cell) continue;

					const cellNode = cell.getCellNode();
					if (!cellNode) continue;

					const overlay = MeshBuilder.CreatePlane(
						`selection_${x}_${z}`,
						{ width: TILE_SIZE * 0.95, height: TILE_SIZE * 0.95 },
						scene
					);
					overlay.rotation.x = Math.PI / 2;
					overlay.position.set(0, 0.03, 0);
					overlay.parent = cellNode;
					overlay.isPickable = false;

					const material = new StandardMaterial(`selectionMat_${x}_${z}`, scene);
					material.diffuseColor = new Color3(0.2, 0.6, 1); // Bleu clair
					material.emissiveColor = new Color3(0.1, 0.3, 0.5);
					material.alpha = 0.5;
					material.disableLighting = true;
					overlay.material = material;

					selectionOverlays.set(`${x},${z}`, overlay);
				}
			}
		}
	};

	// Initialize map ID and name from params (in onMount to ensure params are available)

	// Update preview rotation when rotation angle changes
	createEffect(() => {
		if (previewMesh && (selectedAsset() || editingAsset()) && scene) {
			const rotationRad = (rotationAngle() * Math.PI) / 180;
			if (previewMesh.rotationQuaternion) {
				const euler = previewMesh.rotationQuaternion.toEulerAngles();
				previewMesh.rotationQuaternion = null;
				previewMesh.rotation.y = euler.y + rotationRad;
			} else {
				previewMesh.rotation.y = rotationRad;
			}
		}
	});

	// Find asset by path
	const findAssetByPath = (path: string): MapAsset | null => {
		for (const category of ASSET_CATEGORIES) {
			for (const asset of category.assets) {
				if (asset.path === path) {
					return asset;
				}
			}
		}
		return null;
	};

	// Load map from saved data
	const loadMapData = async (savedData: SavedMapData) => {
		if (!gridManager || !assetStackManager || !scene) return;

		setIsLoading(true);
		clearMap();

		try {
			if (savedData.spawnZones) {
				const zonesMap = new Map<string, "ally" | "enemy" | "teleport">();
				Object.entries(savedData.spawnZones).forEach(([key, type]) => {
					zonesMap.set(key, type as "ally" | "enemy" | "teleport");
				});
				setSpawnZones(zonesMap);
			} else {
				setSpawnZones(new Map());
			}
			for (const cellData of savedData.cells) {
				const cell = gridManager.getCell(cellData.x, cellData.z);
				if (!cell) continue;

				// Load ground
				if (cellData.ground) {
					const groundAsset = findAssetByPath(cellData.ground.assetPath);
					if (groundAsset) {
						const uniqueName = `map_${groundAsset.id}_${cellData.x}_${cellData.z}_${Date.now()}`;
						const mesh = await assetStackManager.loadModel(groundAsset, uniqueName);
						
						mesh.scaling.setAll(cellData.ground.scale);
						mesh.rotation.y = cellData.ground.rotationY;
						
						const cellNode = cell.getCellNode();
						if (cellNode) {
							mesh.parent = cellNode;
							mesh.position.set(0, cellData.ground.positionY, 0);
							mesh.computeWorldMatrix(true);
							mesh.getChildMeshes(false).forEach(child => child.computeWorldMatrix(true));
							
							// Store asset info in metadata
							mesh.metadata = {
								assetId: cellData.ground.assetId,
								assetPath: cellData.ground.assetPath,
								assetType: cellData.ground.assetType,
							};
							
						assetStackManager.positionMeshAtHeight(mesh, 0, 0);
						cell.setGround(mesh as Mesh);
						
						// Calculer et stocker la hauteur du sommet du sol
						const groundPositions = assetStackManager.calculateCellRelativeYPositions(mesh, 0);
						cell.setGroundTopY(groundPositions.topY);
					}
				}
			}

			// Load stacked assets
				for (const assetData of cellData.stackedAssets) {
					const asset = findAssetByPath(assetData.assetPath);
					if (asset) {
						const uniqueName = `map_${asset.id}_${cellData.x}_${cellData.z}_${Date.now()}_${Math.random()}`;
						const mesh = await assetStackManager.loadModel(asset, uniqueName);
						
						mesh.scaling.setAll(assetData.scale);
						mesh.rotation.y = assetData.rotationY;
						
						const cellNode = cell.getCellNode();
						if (cellNode) {
							mesh.parent = cellNode;
							mesh.position.set(0, assetData.positionY, 0);
							mesh.computeWorldMatrix(true);
							mesh.getChildMeshes(false).forEach(child => child.computeWorldMatrix(true));
							
							// Store asset info in metadata
							mesh.metadata = {
								assetId: assetData.assetId,
								assetPath: assetData.assetPath,
								assetType: assetData.assetType,
							};
							
							// Position and add to stack
							assetStackManager.positionMeshAtHeight(mesh, assetData.positionY, 0);
							const stackedAsset = assetStackManager.createStackedAsset(mesh, asset, 0);
							cell.addAsset(stackedAsset);
							
							mesh.isPickable = true;
							mesh.renderingGroupId = 0;
						}
					}
				}
			}
			// Restore placed lights (if any). loadMap already ran migrateMap, so
			// `.lights` is either an array or undefined — never the old shape.
			const savedLights = savedData.lights ?? [];
			setPlacedLights(savedLights);
			clearAllLightFixtures();
			for (const l of savedLights) {
				await spawnLightFixture(l);
			}
		} catch (error) {
			console.error("Error loading map:", error);
		} finally {
			setIsLoading(false);
			// Update collision overlays if enabled
			if (showCollisions() || collisionPreviewMode()) {
				updateCollisionOverlays();
			}
		}
	};

	// Save current map
	/** Sauvegarde silencieuse (sans alert), retourne true si succès */
	const saveMapSilent = (): boolean => {
		if (!gridManager || !mapId()) return false;
		const name = mapName().trim();
		if (!name) return false;

		try {
			const cellsData = gridManager.exportData();

			const spawnZonesRecord: Record<string, "ally" | "enemy" | "teleport"> = {};
			spawnZones().forEach((type, key) => {
				spawnZonesRecord[key] = type;
			});

			const existingMap = loadMap(mapId()!);
			const lightsList = placedLights();
			const mapData: SavedMapData = {
				id: mapId()!,
				name,
				createdAt: existingMap?.createdAt || Date.now(),
				updatedAt: Date.now(),
				cells: cellsData,
				spawnZones: Object.keys(spawnZonesRecord).length > 0 ? spawnZonesRecord : undefined,
				mapType: existingMap?.mapType,
				dungeonId: existingMap?.dungeonId,
				roomIndex: existingMap?.roomIndex,
				lights: lightsList.length > 0 ? lightsList : undefined,
				version: 2,
			};

			saveMap(mapData);

			if (dungeonData()) {
				const d = dungeonData()!;
				d.updatedAt = Date.now();
				saveDungeon(d);
			}
			return true;
		} catch (error) {
			console.error("Error saving map:", error);
			return false;
		}
	};

	const saveCurrentMap = () => {
		if (!gridManager || !mapId()) {
			alert("Erreur: Impossible de sauvegarder la map");
			return;
		}
		const name = mapName().trim();
		if (!name) {
			alert("Veuillez entrer un nom pour la map");
			return;
		}
		if (saveMapSilent()) {
			alert("Map sauvegardée avec succès !");
		} else {
			alert("Erreur lors de la sauvegarde de la map");
		}
	};

	onMount(() => {
		if (!canvasRef) return;

		const paramMapId = params.mapId;
		if (paramMapId === "new") {
			const newId = generateMapId();
			setMapId(newId);
			setMapName("Nouvelle Map");
		} else if (paramMapId) {
			setMapId(paramMapId);
			const savedMap = loadMap(paramMapId);
			if (savedMap) {
				setMapName(savedMap.name);
			}
		}

		const dId = getDungeonId();
		if (dId) {
			const dungeon = loadDungeon(dId);
			if (dungeon) {
				setDungeonData(dungeon);
			}
		}

		// Initialize Babylon.js
		engine = new Engine(canvasRef, true, {
			preserveDrawingBuffer: true,
			stencil: true,
		});
		scene = new Scene(engine);
		scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);
		scene.getEngine().setDepthFunctionToLessOrEqual();

		// Setup camera
		camera = new ArcRotateCamera("camera", Math.PI / 3, Math.PI / 3, 30, Vector3.Zero(), scene);
		camera.attachControl(canvasRef, true);
		camera.setTarget(Vector3.Zero());
		camera.lowerRadiusLimit = 5;
		camera.upperRadiusLimit = 100;
		camera.wheelDeltaPercentage = 0.01;
		scene.activeCamera = camera;

		// Ambient baseline — dim so placed PointLights have visible contrast.
		// 0.8 was blasting the whole scene flat; 0.35 leaves headroom for
		// per-light colour + the sun to do their job.
		const hemi = new HemisphericLight("editor_hemi", new Vector3(0, 1, 0), scene);
		hemi.intensity = 0.35;
		hemi.groundColor = new Color3(0.1, 0.1, 0.15);

		// Soft key light so geometry still reads (walls, props) without
		// flattening colours. Direction matches the game scene so map author
		// sees approximately what they'll get in play.
		const sun = new DirectionalLight(
			"editor_sun",
			new Vector3(-0.5, -1, -0.5).normalize(),
			scene,
		);
		sun.intensity = 0.7;
		sun.position = new Vector3(10, 20, 10);

		// GlowLayer lets emissive materials + flame particles bloom, which is
		// the main reason torches look "lit" rather than pinprick dots.
		editorGlowLayer = new GlowLayer("editor_glow", scene);
		editorGlowLayer.intensity = 0.35;

		// Sun shadow map — walls/props cast soft shadows on the floor. The
		// torch PointLights intentionally don't cast shadows (omnidirectional
		// cubemap shadows are expensive for an editor preview).
		editorShadowGenerator = new ShadowGenerator(1024, sun);
		editorShadowGenerator.useBlurExponentialShadowMap = true;
		editorShadowGenerator.blurKernel = 24;
		editorShadowGenerator.setDarkness(0.35);

		// Initialize model loader
		modelLoader = new ModelLoader(scene);

		// Warm AssetContainer cache for the curated favorites so the first
		// drag-drop is instant (was stuttery — each placement used to kick
		// off its own glTF fetch + parse on the main thread).
		// Fire-and-forget: failures here just mean the first drop is slow.
		modelLoader
			.preloadModels(ASSET_FAVORITE_PATHS)
			.catch((err) => console.warn("[MapEditor] Palette preload partial failure:", err));

		// Initialize grid manager and asset stack manager
		gridManager = new GridManager(scene);
		assetStackManager = new AssetStackManager(scene, modelLoader);

		// Create grid visualization
		createGrid();

		// Setup handlers
		setupClickHandler();
		setupWheelZoom();
		setupPreviewMesh();
		
		// Disable preview mesh when in zone selection mode
		createEffect(() => {
			if (zoneSelectionMode()) {
				cleanupPreviewMesh();
			}
		});

		// Keep camera lock boolean in sync with zone selection mode
		createEffect(() => {
			setIsCameraLocked(zoneSelectionMode());
		});

		// Disable camera controls when camera is locked (e.g. zone selection active)
		createEffect(() => {
			if (camera && canvasRef) {
				if (isCameraLocked()) {
					// Désactiver les contrôles de la caméra
					camera.detachControl();
				} else {
					// Réactiver les contrôles de la caméra
					camera.attachControl(canvasRef, true);
				}
			}
		});

		// Close context menu when clicking outside
		const handleClickOutside = (e: MouseEvent) => {
			if (contextMenuCell()) {
				setContextMenuCell(null);
			}
		};
		window.addEventListener("click", handleClickOutside);
		onCleanup(() => {
			window.removeEventListener("click", handleClickOutside);
		});
		
		// Keyboard handler for rotation (Q and D keys)
		const handleKeyPress = (e: KeyboardEvent) => {
			if ((selectedAsset() || editingAsset()) && !deleteMode()) {
				if (e.key.toLowerCase() === 'q') {
					e.preventDefault();
					setRotationAngle((prev) => (prev - 15 + 360) % 360);
				} else if (e.key.toLowerCase() === 'd') {
					e.preventDefault();
					setRotationAngle((prev) => (prev + 15) % 360);
				}
			}
		};
		window.addEventListener("keydown", handleKeyPress);
		
		onCleanup(() => {
			window.removeEventListener("keydown", handleKeyPress);
		});

		// Start render loop
		engine.runRenderLoop(() => {
			scene?.render();
		});

		window.addEventListener("resize", () => {
			engine?.resize();
		});

		// Load map if mapId is provided and not "new"
		// Use setTimeout to ensure everything is initialized
		setTimeout(() => {
			const currentMapId = mapId();
			if (currentMapId && params.mapId !== "new") {
				const savedMap = loadMap(currentMapId);
				if (savedMap) {
					loadMapData(savedMap);
				}
			}
		}, 100);
	});

	onCleanup(() => {
		cleanupPreviewMesh();
		clearCollisionPreview();
		clearAllLightFixtures();
		// Clear selection overlays
		selectionOverlays.forEach((overlay) => {
			if (!overlay.isDisposed()) {
				overlay.dispose();
			}
		});
		selectionOverlays.clear();
		// Clear spawn zone overlays
		spawnZoneOverlays.forEach((overlay) => {
			if (!overlay.isDisposed()) {
				overlay.dispose();
			}
		});
		spawnZoneOverlays.clear();
		if (gridManager) {
			gridManager.dispose();
		}
		if (engine) {
			engine.dispose();
		}
	});

	// Create grid helper
	const createGrid = () => {
		if (!scene) return;

		const gridColor = new Color3(0.4, 0.4, 0.5);
		const halfSize = (GRID_SIZE * TILE_SIZE) / 2;
		const minX = -halfSize;
		const maxX = halfSize;
		const minZ = -halfSize;
		const maxZ = halfSize;
		
		// Grid lines
		for (let i = 0; i <= GRID_SIZE; i++) {
			const x = minX + (i * TILE_SIZE);
			const line = MeshBuilder.CreateLines(`gridLineX_${i}`, {
				points: [new Vector3(x, 0.01, minZ), new Vector3(x, 0.01, maxZ)],
			}, scene);
			line.color = gridColor;
		}

		for (let i = 0; i <= GRID_SIZE; i++) {
			const z = minZ + (i * TILE_SIZE);
			const line = MeshBuilder.CreateLines(`gridLineZ_${i}`, {
				points: [new Vector3(minX, 0.01, z), new Vector3(maxX, 0.01, z)],
			}, scene);
			line.color = gridColor;
		}

		// Invisible pickable planes for each cell
		if (!gridManager) return;
		
		gridManager.getAllCells().forEach((cell) => {
			const cellNode = cell.getCellNode();
			if (!cellNode) return;
			
			const plane = MeshBuilder.CreatePlane(`cellPlane_${cell.x}_${cell.z}`, {
				width: TILE_SIZE * 0.98,
				height: TILE_SIZE * 0.98
			}, scene);
			plane.rotation.x = Math.PI / 2;
			plane.position.set(0, 0.5, 0); // Position plus haute pour être au-dessus des assets
			plane.parent = cellNode;
			plane.isVisible = false;
			plane.isPickable = true;
			plane.renderingGroupId = 2; // Au-dessus des autres meshes
			plane.metadata = { gridX: cell.x, gridZ: cell.z, isCellPlane: true };
		});

		// Ground plane (global, pas par cellule)
		const ground = MeshBuilder.CreateGround("ground", {
			width: GRID_SIZE * TILE_SIZE,
			height: GRID_SIZE * TILE_SIZE
		}, scene);
		const groundMaterial = new StandardMaterial("groundMat", scene);
		groundMaterial.diffuseColor = new Color3(0.15, 0.15, 0.2);
		groundMaterial.emissiveColor = new Color3(0.05, 0.05, 0.08);
		ground.material = groundMaterial;
		ground.position.y = 0;
		ground.isPickable = false;
	};

	// Setup wheel zoom (prevent page scroll)
	const setupWheelZoom = () => {
		if (!canvasRef) return;
		
		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();
		};
		
		canvasRef.addEventListener("wheel", handleWheel, { passive: false });
		
		onCleanup(() => {
			canvasRef?.removeEventListener("wheel", handleWheel);
		});
	};

	// Cleanup preview mesh
	/**
	 * Tear down the current preview mesh entirely. Called on mode switches,
	 * unmount and any explicit cleanup site. The load-once pointer-move flow
	 * does NOT call this between cells — it only hides the existing mesh.
	 */
	const cleanupPreviewMesh = async () => {
		if (previewUpdateTimeout !== null) {
			clearTimeout(previewUpdateTimeout);
			previewUpdateTimeout = null;
		}
		// Invalidate any in-flight load so its result is discarded.
		previewLoadToken += 1;
		previewAssetId = null;

		while (isUpdatingPreview) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		if (previewMesh) {
			const meshToClean = previewMesh;
			previewMesh = null;
			const meshScene = meshToClean.getScene();
			if (meshScene) {
				meshToClean.getDescendants(false).forEach((node) => {
					if (node instanceof AbstractMesh || node instanceof Mesh) {
						try {
							if (!(node as AbstractMesh).isDisposed()) {
								meshScene.removeMesh(node as AbstractMesh);
								(node as AbstractMesh).dispose();
							}
						} catch (e) { /* ignore */ }
					}
				});
				try {
					if (!meshToClean.isDisposed()) {
						meshScene.removeMesh(meshToClean);
						meshToClean.dispose();
					}
				} catch (e) { /* ignore */ }
			}
		}
	};

	/**
	 * Hide the preview without disposing it. Used when the pointer leaves a
	 * valid drop target — on the next valid cell we just re-enable it, which
	 * is one frame of work vs. a full glTF reload.
	 */
	const hidePreview = () => {
		if (previewMesh && !previewMesh.isDisposed()) {
			previewMesh.setEnabled(false);
		}
	};

	const applyPreviewAlpha = (mesh: AbstractMesh) => {
		const setAlpha = (m: AbstractMesh) => {
			const mat = m.material;
			if (mat instanceof StandardMaterial) {
				mat.alpha = 0.35;
			} else if (mat instanceof PBRMaterial) {
				mat.transparencyMode = 2;
				mat.alpha = 0.35;
			}
			m.getChildMeshes().forEach((child) => setAlpha(child));
		};
		setAlpha(mesh);
	};

	/**
	 * Ensure a preview mesh exists for `asset`. Sync-fast when the current
	 * preview already represents this asset (the common case during hover);
	 * async load only when the asset changes or there's no preview yet. A
	 * monotonic token discards any stale load that finishes after a later
	 * selection change.
	 */
	const ensurePreviewForAsset = async (asset: MapAsset): Promise<AbstractMesh | null> => {
		if (
			previewAssetId === asset.id &&
			previewMesh &&
			!previewMesh.isDisposed()
		) {
			return previewMesh;
		}

		// Different asset (or no preview yet) — dispose the old, load the new.
		if (previewMesh) {
			await cleanupPreviewMesh();
		}

		if (!assetStackManager) return null;
		const token = ++previewLoadToken;
		try {
			isUpdatingPreview = true;
			const uniqueName = `preview_${asset.id}_${Date.now()}`;
			const mesh = await assetStackManager.loadModel(asset, uniqueName);

			// If another selection happened while we were loading, drop this.
			if (token !== previewLoadToken) {
				if (!mesh.isDisposed()) mesh.dispose(false, true);
				return null;
			}

			// Scale per asset type, matching commit-time sizing.
			let scale = 1;
			if (asset.type === "character" || asset.type === "enemy") scale = 0.3;
			else if (asset.type === "furniture" || asset.type === "decoration") scale = 0.4;
			else scale = 0.5;
			mesh.scaling.setAll(scale);

			applyPreviewAlpha(mesh);

			mesh.isPickable = false;
			mesh.getChildMeshes().forEach((c) => { c.isPickable = false; });
			mesh.renderingGroupId = 1;
			mesh.getChildMeshes().forEach((c) => {
				if ('renderingGroupId' in c) (c as any).renderingGroupId = 1;
			});
			mesh.metadata = { isPreview: true };
			mesh.getChildMeshes().forEach((c) => { c.metadata = { isPreview: true }; });

			mesh.setEnabled(false); // start hidden; shown once we position it
			previewMesh = mesh;
			previewAssetId = asset.id;
			return mesh;
		} catch (error) {
			console.warn(`[MapEditor] Preview load failed for ${asset.id}:`, error);
			return null;
		} finally {
			isUpdatingPreview = false;
		}
	};

	/**
	 * Reparent the persistent preview to the target cell and snap its Y to
	 * the correct commit height (floor for ground, stack-top otherwise).
	 * Cheap: no glTF round-trip, only TransformNode updates.
	 */
	const repositionPreviewOnCell = (cell: GridCell, asset: MapAsset) => {
		if (!previewMesh || previewMesh.isDisposed() || !assetStackManager) return;

		// Latest rotation from the UI.
		const rotationRad = (rotationAngle() * Math.PI) / 180;
		if (previewMesh.rotationQuaternion) {
			const euler = previewMesh.rotationQuaternion.toEulerAngles();
			previewMesh.rotationQuaternion = null;
			previewMesh.rotation.y = euler.y + rotationRad;
		} else {
			previewMesh.rotation.y = rotationRad;
		}

		const cellNode = cell.getCellNode();
		if (!cellNode) return;
		previewMesh.parent = cellNode;
		previewMesh.position.set(0, 0, 0);
		previewMesh.computeWorldMatrix(true);
		previewMesh.getChildMeshes(false).forEach((child) => child.computeWorldMatrix(true));

		if (asset.type === "floor") {
			assetStackManager.positionMeshAtHeight(previewMesh, 0, 0);
		} else {
			assetStackManager.positionMeshOnStack(previewMesh, cell);
		}
		previewMesh.setEnabled(true);
	};

	/**
	 * Rend tous les assets de la map semi-transparents pour voir les overlays de collision
	 * Supporte StandardMaterial et PBRMaterial (utilisé par les modèles GLTF/GLB)
	 */
	const setAllAssetsTransparent = (alpha: number) => {
		if (!gridManager) return;
		
		const setMeshAlpha = (m: AbstractMesh) => {
			if (!m.material) return;
			
			if (m.material instanceof StandardMaterial) {
				if (!collisionModeAlphas.has(m)) {
					collisionModeAlphas.set(m, m.material.alpha);
				}
				m.material.alpha = alpha;
			} else if (m.material instanceof PBRMaterial) {
				if (!collisionModeAlphas.has(m)) {
					collisionModeAlphas.set(m, m.material.alpha);
				}
				m.material.transparencyMode = 2; // ALPHABLEND
				m.material.alpha = alpha;
			}
		};

		gridManager.getAllCells().forEach((cell) => {
			const allMeshes = cell.getAllMeshes();
			for (const mesh of allMeshes) {
				setMeshAlpha(mesh);
				// Appliquer aussi sur tous les enfants (meshes GLB ont leur géométrie dans les enfants)
				mesh.getChildMeshes(false).forEach((child) => {
					if (child instanceof AbstractMesh) {
						setMeshAlpha(child);
					}
				});
			}
		});
	};

	/**
	 * Restaure l'opacité originale de tous les assets
	 * Supporte StandardMaterial et PBRMaterial
	 */
	const restoreAllAssetsOpacity = () => {
		if (!gridManager) return;
		
		// Restaurer les meshes qui ont été sauvegardés dans la Map
		collisionModeAlphas.forEach((originalAlpha, mesh) => {
			if (mesh.isDisposed() || !mesh.material) return;
			
			if (mesh.material instanceof StandardMaterial) {
				mesh.material.alpha = originalAlpha;
			} else if (mesh.material instanceof PBRMaterial) {
				mesh.material.alpha = originalAlpha;
				// Restaurer le mode de transparence si l'alpha original était 1 (opaque)
				if (originalAlpha >= 1) {
					mesh.material.transparencyMode = 0; // OPAQUE
				}
			}
		});
		
		// S'assurer que tous les meshes de la grille sont restaurés (y compris ceux qui n'étaient pas dans la Map)
		gridManager.getAllCells().forEach((cell) => {
			const allMeshes = cell.getAllMeshes();
			for (const mesh of allMeshes) {
				const restoreMesh = (m: AbstractMesh) => {
					if (m.isDisposed() || !m.material) return;
					
					// Si le mesh n'était pas dans la Map, restaurer à 1 (opaque par défaut)
					if (!collisionModeAlphas.has(m)) {
						if (m.material instanceof StandardMaterial) {
							m.material.alpha = 1;
						} else if (m.material instanceof PBRMaterial) {
							m.material.alpha = 1;
							m.material.transparencyMode = 0; // OPAQUE
						}
					}
					
					// Restaurer aussi tous les enfants
					m.getChildMeshes(false).forEach((child) => {
						if (child instanceof AbstractMesh) {
							if (!collisionModeAlphas.has(child)) {
								if (child.material instanceof StandardMaterial) {
									child.material.alpha = 1;
								} else if (child.material instanceof PBRMaterial) {
									child.material.alpha = 1;
									child.material.transparencyMode = 0; // OPAQUE
								}
							}
						}
					});
				};
				restoreMesh(mesh);
			}
		});
		
		collisionModeAlphas.clear();
	};

	// Update collision overlays
	const updateCollisionOverlays = () => {
		if (!scene || !gridManager) return;

		// Clear existing overlays
		collisionOverlays.forEach((overlay) => {
			if (!overlay.isDisposed()) {
				overlay.dispose();
			}
		});
		collisionOverlays.clear();

		if (!showCollisions() && !collisionPreviewMode()) {
			restoreAllAssetsOpacity();
			return;
		}

		// Rendre les assets transparents pour voir les zones de collision
		setAllAssetsTransparent(0.25);

		// Create overlays for all cells (passer gridManager pour détecter les assets multi-cases)
		gridManager.getAllCells().forEach((cell) => {
			const collisionProps = cell.getCollisionProperties(gridManager ?? undefined);
			const cellNode = cell.getCellNode();
			if (!cellNode) return;

			const overlay = MeshBuilder.CreatePlane(
				`collision_${cell.x}_${cell.z}`,
				{ width: TILE_SIZE * 0.95, height: TILE_SIZE * 0.95 },
				scene
			);
			overlay.rotation.x = Math.PI / 2;
			overlay.position.set(0, 0.02, 0);
			overlay.parent = cellNode;
			overlay.isPickable = false;

			let color: Color3;
			let emissive: Color3;
			let alpha: number;

			if (collisionProps.blocksMovement) {
				// Red for blocked cells
				color = new Color3(1, 0, 0);
				emissive = new Color3(0.5, 0, 0);
				alpha = 0.6;
			} else if (collisionProps.movementCost > 1) {
				// Yellow for difficult terrain
				color = new Color3(1, 1, 0);
				emissive = new Color3(0.5, 0.5, 0);
				alpha = 0.5;
			} else {
				// Green for walkable cells
				color = new Color3(0, 1, 0);
				emissive = new Color3(0, 0.5, 0);
				alpha = 0.4;
			}

			if (scene) {
				const material = new StandardMaterial(`collisionMat_${cell.x}_${cell.z}`, scene);
				material.diffuseColor = color;
				material.emissiveColor = emissive;
				material.alpha = alpha;
				material.disableLighting = true;
				overlay.material = material;
			}

			collisionOverlays.set(`${cell.x},${cell.z}`, overlay);
		});
	};

	// Show collision preview for a specific asset
	const showCollisionPreview = (assetInfo: { asset: MapAsset; cell: GridCell; mesh: AbstractMesh }) => {
		if (!scene) return;

		// Clear previous preview
		clearCollisionPreview();

		// Save the selected asset
		setSelectedCollisionAsset(assetInfo);

		// Get collision properties for this cell
		const collisionProps = gridManager ? assetInfo.cell.getCollisionProperties(gridManager) : assetInfo.cell.getCollisionProperties();
		const cellNode = assetInfo.cell.getCellNode();
		if (!cellNode) return;

		// Make the asset transparent (supporte StandardMaterial et PBRMaterial)
		const setAlpha = (mesh: AbstractMesh, targetAlpha: number) => {
			if (mesh.material) {
				if (!originalAssetAlpha.has(mesh)) {
					originalAssetAlpha.set(mesh, mesh.material.alpha);
				}
				if (mesh.material instanceof PBRMaterial) {
					mesh.material.transparencyMode = 2; // ALPHABLEND
				}
				mesh.material.alpha = targetAlpha;
			}
			mesh.getChildMeshes(false).forEach((child) => {
				setAlpha(child, targetAlpha);
			});
		};
		setAlpha(assetInfo.mesh, 0.3);

		// Create collision overlay
		const overlay = MeshBuilder.CreatePlane(
			`collision_preview_${assetInfo.cell.x}_${assetInfo.cell.z}`,
			{ width: TILE_SIZE * 0.95, height: TILE_SIZE * 0.95 },
			scene
		);
		overlay.rotation.x = Math.PI / 2;
		overlay.position.set(0, 0.05, 0);
		overlay.parent = cellNode;
		overlay.isPickable = false;

		// Choose color based on collision type
		let color: Color3;
		let emissive: Color3;
		let alpha: number;
		
		if (collisionProps.blocksMovement) {
			// Red for blocked
			color = new Color3(1, 0, 0);
			emissive = new Color3(0.8, 0, 0);
			alpha = 0.6;
		} else if (collisionProps.movementCost > 1) {
			// Yellow for difficult terrain
			color = new Color3(1, 1, 0);
			emissive = new Color3(0.8, 0.8, 0);
			alpha = 0.5;
		} else {
			// Green for walkable
			color = new Color3(0, 1, 0);
			emissive = new Color3(0, 0.5, 0);
			alpha = 0.4;
		}

		const material = new StandardMaterial(`collisionPreviewMat`, scene);
		material.diffuseColor = color;
		material.emissiveColor = emissive;
		material.alpha = alpha;
		material.disableLighting = true;
		overlay.material = material;

		collisionPreviewOverlay = overlay;
	};

	// Clear collision preview
	const clearCollisionPreview = () => {
		// Restore original alpha for all meshes (supporte StandardMaterial et PBRMaterial)
		originalAssetAlpha.forEach((origAlpha, mesh) => {
			if (!mesh.isDisposed() && mesh.material) {
				mesh.material.alpha = origAlpha;
				if (mesh.material instanceof PBRMaterial && origAlpha >= 1) {
					mesh.material.transparencyMode = 0; // OPAQUE
				}
			}
		});
		originalAssetAlpha.clear();

		// Remove overlay
		if (collisionPreviewOverlay && !collisionPreviewOverlay.isDisposed()) {
			collisionPreviewOverlay.dispose();
			collisionPreviewOverlay = null;
		}

		setSelectedCollisionAsset(null);
	};

	// Effect to update collision overlays when showCollisions or collisionPreviewMode changes
	createEffect(() => {
		if ((showCollisions() || collisionPreviewMode()) && scene && gridManager) {
			updateCollisionOverlays();
		} else {
			// Clear overlays when disabled
			collisionOverlays.forEach((overlay) => {
				if (!overlay.isDisposed()) {
					overlay.dispose();
				}
			});
			collisionOverlays.clear();
			// Restaurer l'opacité de tous les assets
			restoreAllAssetsOpacity();
		}
	});

	// Effect to clear collision preview when mode changes
	createEffect(() => {
		if (!collisionPreviewMode()) {
			clearCollisionPreview();
		}
	});

	// Update spawn zone overlays when zones change
	createEffect(() => {
		if (scene && gridManager) {
			updateSpawnZoneOverlays();
		}
	});

	// Handle spawn zone actions
	const handleSetSpawnZone = (type: "ally" | "enemy" | "teleport" | null) => {
		const cell = contextMenuCell();
		if (!cell) return;

		const cellKey = `${cell.x},${cell.z}`;
		const newZones = new Map(spawnZones());

		if (type === null) {
			// Retirer la zone
			newZones.delete(cellKey);
		} else {
			// Ajouter ou modifier la zone
			newZones.set(cellKey, type);
		}

		setSpawnZones(newZones);
		setContextMenuCell(null);
	};

	/**
	 * Pointer-move observer — load-once, reposition-always.
	 *
	 * The previous implementation reloaded the glTF + disposed the previous
	 * preview on every POINTERMOVE, debounced at 50 ms. That produced the
	 * visible stutter the user reported. This version keeps a single long-
	 * lived preview mesh for the currently selected asset and only moves it
	 * across cells. Cost per move is O(matrix updates) rather than
	 * O(glTF load + dispose).
	 */
	const setupPreviewMesh = () => {
		if (!scene) return;

		scene.onPointerObservable.add(async (pointerInfo) => {
			if (pointerInfo.type !== PointerEventTypes.POINTERMOVE) return;
			if (!scene || !gridManager) return;

			// Modes that MUST NOT show a placement ghost.
			if (deleteMode() || collisionPreviewMode() || zoneSelectionMode() || lightMode()) {
				hidePreview();
				return;
			}

			const currentAsset = selectedAsset() || editingAsset()?.asset;
			if (!currentAsset) {
				hidePreview();
				return;
			}

			// Ensure the preview is loaded for this asset (cache hit is sync-ish).
			const ready = await ensurePreviewForAsset(currentAsset);
			if (!ready) return;

			const pick = scene.pick(scene.pointerX, scene.pointerY, (mesh) =>
				mesh.name.startsWith("cellPlane_") &&
				!mesh.name.startsWith("preview_") &&
				!mesh.metadata?.isPreview,
			);
			if (!pick?.hit || !pick.pickedMesh) {
				hidePreview();
				return;
			}
			// Read grid coords from the cellPlane's metadata — the same
			// source the placement path uses. The old worldX-math path
			// was off by half a cell versus gridToWorld (the `-0.5` in the
			// formula conflicted with the `+0.5` gridToWorld applies), so
			// the preview showed on cell N-1 while placement landed on N.
			const meta = pick.pickedMesh.metadata as
				| { gridX?: number; gridZ?: number }
				| undefined;
			if (meta?.gridX === undefined || meta?.gridZ === undefined) {
				hidePreview();
				return;
			}
			const cell = gridManager.getCell(meta.gridX, meta.gridZ);
			if (!cell) {
				hidePreview();
				return;
			}
			repositionPreviewOnCell(cell, currentAsset);
		});
	};

	// Place asset on a single cell
	const placeAsset = async (asset: MapAsset, gridX: number, gridZ: number) => {
		await placeAssetOnCell(asset, gridX, gridZ);
	};

	// Place asset on multiple cells (zone selection)
	const placeAssetOnZone = async (asset: MapAsset, startX: number, startZ: number, endX: number, endZ: number) => {
		if (!scene || !gridManager || !assetStackManager) return;

		const minX = Math.min(startX, endX);
		const maxX = Math.max(startX, endX);
		const minZ = Math.min(startZ, endZ);
		const maxZ = Math.max(startZ, endZ);

		// Placer l'asset sur toutes les cellules de la zone
		for (let x = minX; x <= maxX; x++) {
			for (let z = minZ; z <= maxZ; z++) {
				if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
					await placeAssetOnCell(asset, x, z);
				}
			}
		}
	};

	// Place asset on a single cell (internal function)
	const placeAssetOnCell = async (asset: MapAsset, gridX: number, gridZ: number) => {
		if (!scene || !gridManager || !assetStackManager) {
			console.warn('[placeAsset] Missing dependencies:', { scene: !!scene, gridManager: !!gridManager, assetStackManager: !!assetStackManager });
			return;
		}

		const cell = gridManager.getCell(gridX, gridZ);
		if (!cell) {
			console.warn('[placeAsset] Cell not found:', { gridX, gridZ });
			return;
		}

		try {
			const uniqueName = `map_${asset.id}_${gridX}_${gridZ}_${Date.now()}`;
			const mesh = await assetStackManager.loadModel(asset, uniqueName);

			// 1. Définir le scale
			let scale = 1;
			if (asset.type === "character" || asset.type === "enemy") {
				scale = 0.3;
			} else if (asset.type === "furniture" || asset.type === "decoration") {
				scale = 0.4;
			} else if (asset.type === "floor") {
				scale = 0.5;
			} else {
				scale = 0.5;
			}
			mesh.scaling.setAll(scale);
			
			// 2. Appliquer la rotation
			const rotationRad = (rotationAngle() * Math.PI) / 180;
			if (mesh.rotationQuaternion) {
				const euler = (mesh.rotationQuaternion as any).toEulerAngles();
				mesh.rotationQuaternion = null;
				mesh.rotation.y = euler.y + rotationRad;
			} else {
				mesh.rotation.y = rotationRad;
			}

			// 2bis. S'assurer que le mesh placé est entièrement opaque (le preview restant en transparence)
			const setOpaque = (m: AbstractMesh) => {
				if (m.material) {
					if (m.material instanceof StandardMaterial) {
						m.material.alpha = 1;
					} else if (m.material instanceof PBRMaterial) {
						m.material.alpha = 1;
						m.material.transparencyMode = 0; // OPAQUE
					}
				}
				m.getChildMeshes(false).forEach((child) => {
					if (child instanceof AbstractMesh && child.material) {
						if (child.material instanceof StandardMaterial) {
							child.material.alpha = 1;
						} else if (child.material instanceof PBRMaterial) {
							child.material.alpha = 1;
							child.material.transparencyMode = 0;
						}
					}
				});
			};
			setOpaque(mesh);

			// 3. Parenter à la cellule
			const cellNode = cell.getCellNode();
			if (!cellNode) return;
			mesh.parent = cellNode;
			
			// 4. Initialiser la position au centre de la cellule
			mesh.position.set(0, 0, 0);
			
			// 5. Forcer le recalcul des matrices world après le parenting
			mesh.computeWorldMatrix(true);
			mesh.getChildMeshes(false).forEach(child => child.computeWorldMatrix(true));

			if (asset.type === "floor") {
				// Pour les sols, remplacer le sol existant et positionner à y=0
				const existingGround = cell.getGround();
				if (existingGround) {
					// Nettoyer l'enregistrement de l'ancien ground
					gridManager.unregisterAsset(existingGround.name);
					existingGround.dispose();
				}
				
				// Positionner le bas du sol à y=0
				assetStackManager.positionMeshAtHeight(mesh, 0, 0);
				cell.setGround(mesh as Mesh);
				
				// Calculer et stocker la hauteur du sommet du sol
				const groundPositions = assetStackManager.calculateCellRelativeYPositions(mesh, 0);
				cell.setGroundTopY(groundPositions.topY);
				
				// Recalculer les positions de tous les assets empilés au-dessus du nouveau sol
				cell.restackAssets(assetStackManager);
			} else {
				// Pour les autres assets, les empiler
				// Calculer la hauteur effective en tenant compte des assets multi-cases
				let effectiveStackHeight = cell.getStackHeight();
				
				// Vérifier les assets d'autres cellules qui débordent sur celle-ci
				const externalAssets = gridManager.getAssetsAffectingCell(gridX, gridZ);
				for (const extMesh of externalAssets) {
					// Ignorer les assets déjà dans la pile de cette cellule
					const isInStack = cell.getStackedAssets().some(sa => sa.mesh === extMesh);
					const isGround = cell.getGround() === extMesh;
					if (isInStack || isGround) continue;
					
					// Utiliser le topY world de l'asset externe
					const extTopY = assetStackManager.calculateWorldTopY(extMesh);
					effectiveStackHeight = Math.max(effectiveStackHeight, extTopY);
				}
				
				// Positionner au-dessus de la pile effective
				assetStackManager.positionMeshAtHeight(mesh, effectiveStackHeight, 0);
				
				// Créer le StackedAsset et l'ajouter à la pile
				const stackedAsset = assetStackManager.createStackedAsset(mesh, asset, 0);
				cell.addAsset(stackedAsset);
			}

			// Register with the sun's shadow map so placed walls/props/furniture
			// cast soft shadows on the floor. Floor tiles only receive.
			if (editorShadowGenerator) {
				if (asset.type !== "floor") {
					editorShadowGenerator.addShadowCaster(mesh, true);
				}
				mesh.receiveShadows = true;
				mesh.getChildMeshes(false).forEach((child) => {
					child.receiveShadows = true;
				});
			}

			// 6. Calculer toutes les cellules affectées par cet asset (basé sur le bounding box)
			const bounds = assetStackManager.getCombinedWorldBoundsFull(mesh);
			if (bounds) {
				// Convert the world-space bounds to grid-cell indices. Two
				// subtle traps the old math fell into:
				//   1. Using `Math.floor` on maxX/maxZ claimed the NEXT cell
				//      whenever the bounds ended exactly on a cell boundary
				//      (which is the common case for 1x1 assets, since the
				//      bounding box is tight to the mesh). That caused the
				//      adjacent cell to think a block hovered above it and
				//      the next placement went "in the air".
				//   2. Floating-point noise at the boundary (e.g. 0.0001 past
				//      the edge) had the same effect.
				// Using ceil-minus-one + a small epsilon so an asset only
				// claims cells whose INTERIOR it actually overlaps.
				const halfSize = (GRID_SIZE * TILE_SIZE) / 2;
				const epsilon = 0.05;
				const minGridX = Math.max(0, Math.floor((bounds.minX + epsilon + halfSize) / TILE_SIZE));
				const maxGridX = Math.min(
					GRID_SIZE - 1,
					Math.ceil((bounds.maxX - epsilon + halfSize) / TILE_SIZE) - 1,
				);
				const minGridZ = Math.max(0, Math.floor((bounds.minZ + epsilon + halfSize) / TILE_SIZE));
				const maxGridZ = Math.min(
					GRID_SIZE - 1,
					Math.ceil((bounds.maxZ - epsilon + halfSize) / TILE_SIZE) - 1,
				);

				// Enregistrer toutes les cellules affectées
				const affectedCellKeys: string[] = [];
				for (let x = minGridX; x <= maxGridX; x++) {
					for (let z = minGridZ; z <= maxGridZ; z++) {
						affectedCellKeys.push(`${x},${z}`);
					}
				}
				gridManager.registerAssetCells(mesh.name, affectedCellKeys);
			} else {
				// Fallback: si le bounding box ne peut pas être calculé, utiliser seulement la cellule centrale
				gridManager.registerAssetCells(mesh.name, [`${gridX},${gridZ}`]);
			}

			mesh.isPickable = true;
			mesh.renderingGroupId = 0;
			mesh.metadata = {
				isPreview: false,
				assetId: asset.id,
				assetPath: asset.path,
				assetType: asset.type,
			};

			// Update collision overlays if enabled
			if (showCollisions() || collisionPreviewMode()) {
				updateCollisionOverlays();
			}

		} catch (error) {
			console.error(`Failed to place asset ${asset.name}:`, error);
		}
	};

	/**
	 * Trouve le mesh racine d'un asset placé à partir d'un mesh cliqué/survolé
	 * (peut être un enfant d'un mesh GLB)
	 */
	const findRootAssetMesh = (pickedMesh: AbstractMesh): AbstractMesh | null => {
		if (!pickedMesh) return null;
		
		// Si le mesh lui-même est un asset placé
		if (pickedMesh.name.startsWith("map_")) return pickedMesh;
		
		// Remonter toute la hiérarchie pour trouver le parent "map_"
		// Les modèles GLB peuvent avoir des TransformNode intermédiaires entre les meshes enfants et la racine
		let current: any = pickedMesh.parent;
		while (current) {
			if (current instanceof AbstractMesh && current.name.startsWith("map_")) {
				return current;
			}
			// Vérifier aussi si c'est un TransformNode qui contient un mesh "map_"
			if (current instanceof TransformNode) {
				const children = current.getChildMeshes(false);
				for (const child of children) {
					if (child instanceof AbstractMesh && child.name.startsWith("map_")) {
						return child;
					}
				}
			}
			current = current.parent;
		}
		
		// Si on n'a rien trouvé, vérifier si le mesh a des enfants qui sont des assets "map_"
		const childMeshes = pickedMesh.getChildMeshes(false);
		for (const child of childMeshes) {
			if (child instanceof AbstractMesh && child.name.startsWith("map_")) {
				return child;
			}
		}
		
		return null;
	};

	/**
	 * Applique une surbrillance sur un mesh et tous ses enfants
	 * Clone le matériau pour ne pas affecter les autres meshes qui partagent le même matériau
	 */
	const applyHighlight = (mesh: AbstractMesh, color: Color3) => {
		const applyToMesh = (m: AbstractMesh) => {
			if (m.material && !hoveredMeshOriginalMaterials.has(m)) {
				// Sauvegarder le matériau original (partagé)
				hoveredMeshOriginalMaterials.set(m, m.material);
				// Cloner le matériau pour que la modification n'affecte que ce mesh
				const cloned = m.material.clone(m.material.name + "_highlight_" + m.uniqueId);
				if (cloned) {
					m.material = cloned;
					if (cloned instanceof StandardMaterial) {
						cloned.emissiveColor = color;
					} else if (cloned instanceof PBRMaterial) {
						cloned.emissiveColor = color;
					}
				}
			}
		};
		applyToMesh(mesh);
		mesh.getChildMeshes(false).forEach(child => {
			if (child instanceof AbstractMesh) applyToMesh(child);
		});
	};

	/**
	 * Retire la surbrillance et restaure les matériaux originaux
	 */
	const clearHighlight = () => {
		hoveredMeshOriginalMaterials.forEach((originalMaterial, mesh) => {
			if (!mesh.isDisposed()) {
				// Supprimer le matériau cloné
				const clonedMat = mesh.material;
				// Restaurer le matériau original (partagé)
				mesh.material = originalMaterial;
				// Disposer le clone
				if (clonedMat && clonedMat !== originalMaterial) {
					clonedMat.dispose();
				}
			}
		});
		hoveredMeshOriginalMaterials.clear();
		hoveredMesh = null;
	};

	// Get grid coordinates from pointer position
	const getGridCoordsFromPointer = (): { x: number; z: number } | null => {
		if (!scene) return null;

		const pickInfo = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
			return mesh.name.startsWith("cellPlane_") || mesh.name === "ground";
		});

		if (pickInfo?.hit && pickInfo.pickedMesh) {
			const meshName = pickInfo.pickedMesh.name;
			
			if (meshName.startsWith("cellPlane_")) {
				const metadata = pickInfo.pickedMesh.metadata as { gridX: number; gridZ: number };
				if (metadata && typeof metadata.gridX === 'number' && typeof metadata.gridZ === 'number') {
					const gridX = metadata.gridX;
					const gridZ = metadata.gridZ;
					if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
						return { x: gridX, z: gridZ };
					}
				}
			}
			
			if (pickInfo.pickedPoint) {
				const worldX = pickInfo.pickedPoint.x;
				const worldZ = pickInfo.pickedPoint.z;
				const halfSize = (GRID_SIZE * TILE_SIZE) / 2;
				const gridX = Math.floor((worldX + halfSize) / TILE_SIZE);
				const gridZ = Math.floor((worldZ + halfSize) / TILE_SIZE);
				if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
					return { x: gridX, z: gridZ };
				}
			}
		}

		return null;
	};

	// Setup click handler
	const setupClickHandler = () => {
		if (!scene || !camera || !gridManager) return;

		// Filtre de picking pour mode delete/edit : accepte tout mesh sauf les exclusions
		// findRootAssetMesh s'occupe ensuite de vérifier si c'est un asset placé
		const deleteEditPickFilter = (mesh: AbstractMesh): boolean => {
			// Exclure les meshes qui ne sont pas des assets placés
			if (mesh.name.startsWith("preview_") || 
			    mesh.name.startsWith("collision_") ||
			    mesh.name.startsWith("cellPlane_") ||
			    mesh.name === "ground" ||
			    mesh.metadata?.isPreview ||
			    !mesh.isPickable) return false;
			return true;
		};

		// Gestionnaire de survol pour la surbrillance en mode delete/edit
		scene.onPointerObservable.add((pointerInfo) => {
			if (pointerInfo.type !== PointerEventTypes.POINTERMOVE || !scene) return;
			if (!deleteMode() && !editMode()) {
				if (hoveredMesh) clearHighlight();
				return;
			}

			const pickInfo = scene.pick(scene.pointerX, scene.pointerY, deleteEditPickFilter);

			if (pickInfo?.hit && pickInfo.pickedMesh) {
				const rootMesh = findRootAssetMesh(pickInfo.pickedMesh);
				if (rootMesh && rootMesh !== hoveredMesh) {
					clearHighlight();
					hoveredMesh = rootMesh;
					const highlightColor = deleteMode() 
						? new Color3(1, 0.2, 0.2)  // Rouge pour suppression
						: new Color3(0.2, 0.5, 1);  // Bleu pour édition
					applyHighlight(rootMesh, highlightColor);
				} else if (!rootMesh && hoveredMesh) {
					clearHighlight();
				}
			} else {
				if (hoveredMesh) clearHighlight();
			}
		});

		// Handle zone selection mode
		scene.onPointerObservable.add((pointerInfo) => {
			if (pointerInfo.type === PointerEventTypes.POINTERMOVE && scene && zoneSelectionMode() && isSelecting()) {
				const coords = getGridCoordsFromPointer();
				if (coords) {
					setSelectionEnd(coords);
					updateSelectionOverlay();
				}
			}
		});

		scene.onPointerObservable.add((pointerInfo) => {
			if (pointerInfo.type === PointerEventTypes.POINTERUP && scene && zoneSelectionMode() && isSelecting()) {
				const start = selectionStart();
				const end = selectionEnd();
				if (start && end) {
					const assetToPlace = selectedAsset() || editingAsset()?.asset;
					if (assetToPlace) {
						placeAssetOnZone(assetToPlace, start.x, start.z, end.x, end.z);
						
						if (editingAsset()) {
							setEditingAsset(null);
							setEditMode(false);
						}
					}
				}
				setIsSelecting(false);
				setSelectionStart(null);
				setSelectionEnd(null);
				updateSelectionOverlay();
				return;
			}
		});

		scene.onPointerObservable.add((pointerInfo) => {
			if (pointerInfo.type === PointerEventTypes.POINTERDOWN && scene) {
				// Light placement mode — click a cell to drop a light.
				if (lightMode()) {
					const pick = scene.pick(scene.pointerX, scene.pointerY, (m) =>
						m.name.startsWith("cellPlane_"),
					);
					if (!pick?.hit || !pick.pickedMesh) return;
					const meta = pick.pickedMesh.metadata as
						| { gridX?: number; gridZ?: number }
						| undefined;
					if (meta?.gridX === undefined || meta?.gridZ === undefined) return;
					const gridX = meta.gridX;
					const gridZ = meta.gridZ;

					const newLight: SavedLightData = {
						presetId: selectedLightPreset(),
						x: gridX,
						z: gridZ,
					};
					setPlacedLights((prev) => {
						const without = prev.filter((l) => !(l.x === gridX && l.z === gridZ));
						return [...without, newLight];
					});
					void spawnLightFixture(newLight);
					return;
				}

				// Zone selection mode
				if (zoneSelectionMode() && (selectedAsset() || editingAsset()?.asset)) {
					const coords = getGridCoordsFromPointer();
					if (coords) {
						setSelectionStart(coords);
						setSelectionEnd(coords);
						setIsSelecting(true);
						updateSelectionOverlay();
					}
					return;
				}

				const isDeleteOrEdit = deleteMode() || editMode();
				
				// Choisir le filtre selon le mode
				const pickInfo = isDeleteOrEdit
					? scene.pick(scene.pointerX, scene.pointerY, deleteEditPickFilter)
					: scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
						if (mesh.name.startsWith("preview_") || 
						    mesh.name.startsWith("collision_") ||
						    mesh.metadata?.isPreview) return false;
						if (mesh.name.startsWith("cellPlane_")) return true;
						if (mesh.name === "ground" && !selectedAsset() && !editingAsset()) return true;
						return false;
					});

				if (deleteMode()) {
					// Try to detect a placed-light click two ways, most specific
					// first: direct hit on the fixture mesh (or one of its
					// descendants), then cellPlane fallback for "click the tile
					// near the light" UX. Either match short-circuits the normal
					// asset-delete path so lights are never left orphaned.
					const rawPick = scene.pick(scene.pointerX, scene.pointerY);
					if (rawPick?.hit && rawPick.pickedMesh) {
						const hit = rawPick.pickedMesh;
						for (const [key, entry] of lightVisuals.entries()) {
							const fixtureDescendants = entry.mesh.getDescendants(false);
							const isFixture =
								hit === entry.mesh ||
								fixtureDescendants.indexOf(hit as unknown as typeof fixtureDescendants[number]) !== -1 ||
								hit.name.startsWith(entry.mesh.name);
							if (isFixture) {
								const [xs, zs] = key.split(",").map(Number);
								setPlacedLights((prev) =>
									prev.filter((l) => !(l.x === xs && l.z === zs)),
								);
								despawnLightFixture(xs, zs);
								return;
							}
						}
					}
					const cellPick = scene.pick(scene.pointerX, scene.pointerY, (m) =>
						m.name.startsWith("cellPlane_"),
					);
					if (cellPick?.hit && cellPick.pickedMesh) {
						const cMeta = cellPick.pickedMesh.metadata as
							| { gridX?: number; gridZ?: number }
							| undefined;
						if (cMeta?.gridX !== undefined && cMeta?.gridZ !== undefined) {
							const gx = cMeta.gridX;
							const gz = cMeta.gridZ;
							const hadLight = placedLights().some((l) => l.x === gx && l.z === gz);
							if (hadLight) {
								setPlacedLights((prev) => prev.filter((l) => !(l.x === gx && l.z === gz)));
								despawnLightFixture(gx, gz);
								return;
							}
						}
					}

					// Delete mode: utiliser le mesh survolé (déjà identifié par le hover handler)
					// ou fallback sur le picking direct
					let targetMesh: AbstractMesh | null = null;
					
					// D'abord essayer avec le mesh survolé
					if (hoveredMesh) {
						targetMesh = hoveredMesh;
						if (MAPEDITOR_DEBUG) console.log('[DELETE] Using hoveredMesh:', targetMesh.name);
					} 
					// Sinon, essayer avec le picking direct
					else if (pickInfo?.hit && pickInfo.pickedMesh) {
						targetMesh = findRootAssetMesh(pickInfo.pickedMesh);
						if (MAPEDITOR_DEBUG) console.log('[DELETE] Found via pickInfo:', targetMesh?.name);
					}
					
					if (!targetMesh) {
						// Si aucun mesh n'a été trouvé, essayer un picking sans filtre pour déboguer
						const debugPick = scene.pick(scene.pointerX, scene.pointerY);
						if (debugPick?.hit && debugPick.pickedMesh) {
							targetMesh = findRootAssetMesh(debugPick.pickedMesh);
							if (MAPEDITOR_DEBUG) console.log('[DELETE] Found via debugPick:', targetMesh?.name);
						}
					}
					
					if (targetMesh && gridManager) {
						if (MAPEDITOR_DEBUG) console.log('[DELETE] Target mesh found:', targetMesh.name);
						
						// Sauvegarder la référence ET le nom avant de nettoyer la surbrillance
						const targetMeshRef = targetMesh;
						const targetMeshName = targetMesh.name;
						
						// Fonction helper pour vérifier si un mesh est le même que le target (y compris les enfants)
						const isSameMesh = (mesh: AbstractMesh): boolean => {
							// Comparer par référence directe
							if (mesh === targetMeshRef) return true;
							
							// Comparer par nom (sans le suffixe potentiel ajouté par Babylon)
							const meshNameBase = mesh.name.split('.')[0]; // Enlever le suffixe comme .crypt
							const targetNameBase = targetMeshName.split('.')[0];
							if (meshNameBase === targetNameBase && meshNameBase.startsWith('map_')) return true;
							
							// Vérifier si le mesh est un parent/enfant du target
							let current: any = mesh;
							while (current) {
								if (current === targetMeshRef) return true;
								current = current.parent;
							}
							
							current = targetMeshRef;
							while (current) {
								if (current === mesh) return true;
								current = current.parent;
							}
							
							return false;
						};
						
						// Nettoyer la surbrillance avant suppression
						clearHighlight();
						
						let deletedMesh: AbstractMesh | null = null;
						
						// Chercher dans toutes les cellules en vérifiant tous les meshes (y compris enfants)
						const cellsToRestack: GridCell[] = [];
						gridManager.getAllCells().forEach((cell) => {
							// Chercher dans les stacked assets
							const stackedAssets = cell.getStackedAssets();
							for (let i = stackedAssets.length - 1; i >= 0; i--) {
								const stackedAsset = stackedAssets[i];
								const cellMesh = stackedAsset.mesh;
								
								// Vérifier le mesh principal et tous ses enfants
								if (isSameMesh(cellMesh)) {
									deletedMesh = cellMesh;
									if (MAPEDITOR_DEBUG) console.log('[DELETE] Found in stackedAssets:', deletedMesh.name);
									cell.removeAsset(cellMesh);
									cellMesh.dispose();
									cellsToRestack.push(cell);
									return; // Sortir de la boucle forEach
								}
								
								// Vérifier aussi tous les enfants du mesh
								const childMeshes = cellMesh.getChildMeshes(false);
								for (const child of childMeshes) {
									if (child instanceof AbstractMesh && isSameMesh(child)) {
										deletedMesh = cellMesh; // Supprimer le mesh parent
										if (MAPEDITOR_DEBUG) console.log('[DELETE] Found via child mesh in stackedAssets:', cellMesh.name);
										cell.removeAsset(cellMesh);
										cellMesh.dispose();
										cellsToRestack.push(cell);
										return; // Sortir de la boucle forEach
									}
								}
							}
							
							// Vérifier aussi le ground si pas encore trouvé
							const ground = cell.getGround();
							if (ground && isSameMesh(ground)) {
								deletedMesh = ground;
								if (MAPEDITOR_DEBUG) console.log('[DELETE] Found in ground:', deletedMesh.name);
								ground.dispose();
								cell.setGround(null);
								cellsToRestack.push(cell);
							}
						});
						
						if (!deletedMesh) {
							if (MAPEDITOR_DEBUG) console.warn('[DELETE] Mesh not found in grid cells:', targetMeshName);
							if (MAPEDITOR_DEBUG) console.log('[DELETE] Available meshes:', gridManager.getAllCells().flatMap(cell => {
								const meshes: string[] = [];
								cell.getStackedAssets().forEach(sa => meshes.push(sa.mesh.name));
								if (cell.getGround()) meshes.push('ground: ' + cell.getGround()!.name);
								return meshes;
							}));
						}
						
						// Nettoyer l'enregistrement de l'asset supprimé
						const resolvedMesh = deletedMesh as AbstractMesh | null;
						if (resolvedMesh) {
							const meshName = resolvedMesh.name;
							if (meshName) {
								gridManager.unregisterAsset(meshName);
							}
							
							// Recalculer les positions des assets restants dans les cellules affectées
							if (assetStackManager) {
								for (const cell of cellsToRestack) {
									cell.restackAssets(assetStackManager);
								}
							}
							
							// Update collision overlays if enabled
							if (showCollisions() || collisionPreviewMode()) {
								updateCollisionOverlays();
							}
							
							if (MAPEDITOR_DEBUG) console.log('[DELETE] Successfully deleted mesh');
						}
					} else {
						if (MAPEDITOR_DEBUG) console.warn('[DELETE] No target mesh found or gridManager missing');
					}
					return;
				}

				// Collision preview mode: collisions are shown on all cells via updateCollisionOverlays
				// No need to handle clicks in this mode
				if (collisionPreviewMode()) {
					return;
				}

				if (editMode()) {
					// Edit mode: utiliser le mesh survolé (déjà identifié par le hover handler)
					// ou fallback sur le picking direct
					const rootMesh = hoveredMesh 
						|| (pickInfo?.hit && pickInfo.pickedMesh ? findRootAssetMesh(pickInfo.pickedMesh) : null);
					if (rootMesh && gridManager) {
						
						// Nettoyer la surbrillance
						clearHighlight();
						
						gridManager.getAllCells().forEach((cell) => {
							const stackedAssets = cell.getStackedAssets();
							stackedAssets.forEach((stackedAsset) => {
								if (stackedAsset.mesh === rootMesh) {
									setEditingAsset({ asset: stackedAsset.asset, cell, mesh: stackedAsset.mesh });
									setSelectedAsset(stackedAsset.asset);
									setRotationAngle(0);
									// Nettoyer l'enregistrement multi-cases
									gridManager!.unregisterAsset(stackedAsset.mesh.name);
									cell.removeAsset(stackedAsset.mesh);
									stackedAsset.mesh.dispose();
								}
							});
						});
						
						// Update collision overlays if enabled
						if (showCollisions()) {
							updateCollisionOverlays();
						}
					}
					return;
				}

				// Normal placement mode (single cell)
				if (zoneSelectionMode()) {
					// Zone selection is handled by POINTERUP
					return;
				}

				const assetToPlace = selectedAsset() || editingAsset()?.asset;
				
				// Si aucun asset n'est sélectionné et aucun mode n'est actif, afficher le menu contextuel
				if (!assetToPlace && !deleteMode() && !editMode() && !collisionPreviewMode()) {
					// Vérifier si on a cliqué sur une cellule
					if (pickInfo?.hit && pickInfo.pickedMesh) {
						const meshName = pickInfo.pickedMesh.name;
						
						if (meshName.startsWith("cellPlane_")) {
							const metadata = pickInfo.pickedMesh.metadata as { gridX: number; gridZ: number };
							if (metadata && typeof metadata.gridX === 'number' && typeof metadata.gridZ === 'number') {
								const gridX = metadata.gridX;
								const gridZ = metadata.gridZ;
								
								if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
									// Obtenir les coordonnées d'écran depuis le canvas
									const rect = canvasRef.getBoundingClientRect();
									const screenX = scene.pointerX + rect.left;
									const screenY = scene.pointerY + rect.top;
									
									// Afficher le menu contextuel à la position du clic
									setContextMenuCell({
										x: gridX,
										z: gridZ,
										screenX,
										screenY
									});
									return;
								}
							}
						}
					}
					return;
				}
				
				if (!assetToPlace) return;

				// Check if clicked on grid cell plane
				if (pickInfo?.hit && pickInfo.pickedMesh) {
					const meshName = pickInfo.pickedMesh.name;
					
					// Si c'est un cellPlane, utiliser les métadonnées
					if (meshName.startsWith("cellPlane_")) {
						const metadata = pickInfo.pickedMesh.metadata as { gridX: number; gridZ: number };
						if (metadata && typeof metadata.gridX === 'number' && typeof metadata.gridZ === 'number') {
							const gridX = metadata.gridX;
							const gridZ = metadata.gridZ;

							if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
								placeAsset(assetToPlace, gridX, gridZ);
								
								if (editingAsset()) {
									setEditingAsset(null);
									setEditMode(false);
								}
								return;
							}
						}
					}
					
					// Fallback: calculer depuis le point de collision
					if (pickInfo.pickedPoint) {
						const worldX = pickInfo.pickedPoint.x;
						const worldZ = pickInfo.pickedPoint.z;
						
						// Calculer la position de grille depuis les coordonnées world
						const halfSize = (GRID_SIZE * TILE_SIZE) / 2;
						const gridX = Math.floor((worldX + halfSize) / TILE_SIZE);
						const gridZ = Math.floor((worldZ + halfSize) / TILE_SIZE);

						if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
							placeAsset(assetToPlace, gridX, gridZ);
							
							if (editingAsset()) {
								setEditingAsset(null);
								setEditMode(false);
							}
							return;
						}
					}
				}
			}
		});
	};

	// Effect to update selection overlay when selection changes
	createEffect(() => {
		if (zoneSelectionMode() && (selectionStart() || selectionEnd())) {
			updateSelectionOverlay();
		} else {
			// Clear overlays when zone selection is disabled
			selectionOverlays.forEach((overlay) => {
				if (!overlay.isDisposed()) {
					overlay.dispose();
				}
			});
			selectionOverlays.clear();
		}
	});

	// Clear map
	const clearMap = () => {
		cleanupPreviewMesh();
		clearCollisionPreview();
		clearAllLightFixtures();
		setPlacedLights([]);
		// Clear selection overlays
		selectionOverlays.forEach((overlay) => {
			if (!overlay.isDisposed()) {
				overlay.dispose();
			}
		});
		selectionOverlays.clear();
		setIsSelecting(false);
		setSelectionStart(null);
		setSelectionEnd(null);
		const manager = gridManager;
		if (!manager) return;
		
		manager.getAllCells().forEach((cell) => {
			const stackedAssets = cell.getStackedAssets();
			stackedAssets.forEach((stackedAsset) => {
				if (stackedAsset.mesh.name) {
					manager.unregisterAsset(stackedAsset.mesh.name);
				}
			});
			cell.clearAssets();
			
			const ground = cell.getGround();
			if (ground && ground.name) {
				manager.unregisterAsset(ground.name);
				ground.dispose();
				cell.setGround(null);
			}
		});
		
		// Update collision overlays if enabled
		if (showCollisions() || collisionPreviewMode()) {
			updateCollisionOverlays();
		}
	};

	return (
		<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
			<div class="vignette absolute inset-0 pointer-events-none"></div>

			{/* Back button */}
			<A href="/map-editor" class="settings-btn" aria-label="Retour">
				<ArrowLeft class="settings-icon h-5 w-5" />
			</A>

			{/* Dungeon room header */}
			<Show when={dungeonData() && getRoomIndex() !== undefined}>
				{(() => {
					const dungeon = dungeonData()!;
					const roomIdx = getRoomIndex()!;
					const isLastRoom = roomIdx === dungeon.totalRooms - 1;
					const isFirstRoom = roomIdx === 0;

					const goToRoom = (index: number) => {
						saveMapSilent();
						const targetRoomId = dungeon.roomIds[index];
						window.location.href = `/map-editor/${targetRoomId}?dungeon=${dungeon.id}&room=${index}`;
					};

					return (
						<div class="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-purple-900/80 backdrop-blur-sm rounded-xl px-6 py-3 border border-purple-500/30 shadow-lg flex items-center gap-4">
							<span class="text-purple-200 font-display text-sm">{dungeon.name}</span>
							<span class="text-purple-400 text-sm font-bold">
								Salle {roomIdx + 1} / {dungeon.totalRooms}
							</span>
							<div class="flex gap-2">
								<Show when={!isFirstRoom}>
									<button
										onClick={() => goToRoom(roomIdx - 1)}
										class="px-3 py-1 rounded-lg bg-purple-700/50 hover:bg-purple-600/70 text-purple-200 text-xs transition"
									>
										Salle précédente
									</button>
								</Show>
								<Show when={!isLastRoom}>
									<button
										onClick={() => goToRoom(roomIdx + 1)}
										class="px-3 py-1 rounded-lg bg-purple-600/70 hover:bg-purple-500/80 text-white text-xs transition font-medium"
									>
										Salle suivante
									</button>
								</Show>
							</div>
							<Show when={!isLastRoom}>
								<span class="text-purple-400/60 text-xs">
									N'oubliez pas les cellules de teleportation (violet)
								</span>
							</Show>
							<Show when={isLastRoom}>
								<span class="text-amber-400/80 text-xs">
									Dernière salle ! Portail ou tuer les ennemis = victoire
								</span>
							</Show>
						</div>
					);
				})()}
			</Show>

			{/* Main menu (infos + assets) */}
			<div class="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/10 shadow-lg max-w-xs max-h-[90vh] overflow-y-auto">
				<h2 class="text-white font-display text-xl mb-4">Map Editor</h2>

				{/* Map Name Input */}
				<div class="mb-4">
					<label class="block text-sm text-slate-300 mb-2">Nom de la map</label>
					<input
						type="text"
						value={mapName()}
						onInput={(e) => setMapName(e.currentTarget.value)}
						class="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-brandStart transition"
						placeholder="Nom de la map"
					/>
				</div>

				<div class="mb-4">
					<label class="block text-sm text-slate-300 mb-2">Sélectionner un asset</label>

					{/* Tab switcher */}
					<div class="flex gap-1 bg-black/40 rounded-lg p-1 mb-2">
						<button
							type="button"
							onClick={() => setActivePaletteTab("favoris")}
							class={`flex-1 px-2 py-1 rounded-md text-xs transition-colors ${
								activePaletteTab() === "favoris"
									? "bg-gradient-to-r from-brandStart to-brandEnd text-white"
									: "text-slate-300 hover:bg-white/10"
							}`}
						>
							Favoris
						</button>
						<button
							type="button"
							onClick={() => setActivePaletteTab("tous")}
							class={`flex-1 px-2 py-1 rounded-md text-xs transition-colors ${
								activePaletteTab() === "tous"
									? "bg-gradient-to-r from-brandStart to-brandEnd text-white"
									: "text-slate-300 hover:bg-white/10"
							}`}
						>
							Tous
						</button>
					</div>

					{/* Search input */}
					<input
						type="text"
						placeholder="Chercher un asset..."
						value={searchQuery()}
						onInput={(e) => setSearchQuery(e.currentTarget.value)}
						class="w-full px-3 py-2 mb-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-brandStart transition"
					/>

					<div class="space-y-2">
						<For each={visibleCategories()}>
							{(category) => {
								// Auto-expand when in Favoris tab or when searching so the
								// user doesn't have to click every accordion header.
								const isExpanded = () =>
									activePaletteTab() === "favoris" ||
									searchQuery().length > 0 ||
									expandedCategories().has(category.id);
								const toggleCategory = () => {
									const newSet = new Set(expandedCategories());
									if (newSet.has(category.id)) {
										newSet.delete(category.id);
									} else {
										newSet.add(category.id);
									}
									setExpandedCategories(newSet);
								};

								return (
									<div class="border border-white/10 rounded-lg overflow-hidden">
										<button
											class="w-full flex items-center justify-between px-3 py-2 bg-black/30 hover:bg-black/40 text-slate-200 transition text-sm font-medium"
											onClick={toggleCategory}
										>
											<span>
												{category.name}{" "}
												<span class="text-slate-500">({category.assets.length})</span>
											</span>
											<Show when={isExpanded()} fallback={<ChevronRight class="h-4 w-4" />}>
												<ChevronDown class="h-4 w-4" />
											</Show>
										</button>
										<Show when={isExpanded()}>
											<div class="grid grid-cols-2 gap-2 p-2 bg-black/20">
												<For each={category.assets}>
													{(asset) => (
														<button
															class={`text-xs rounded-lg px-2 py-1.5 border transition ${
																selectedAsset()?.id === asset.id
																	? "bg-gradient-to-r from-brandStart to-brandEnd border-transparent text-white"
																	: "bg-black/30 border-white/10 text-slate-200 hover:bg-black/40"
															}`}
															onClick={() => {
																cleanupPreviewMesh();
																setSelectedAsset(asset);
																setEditingAsset(null);
																setEditMode(false);
																setDeleteMode(false);
																setZoneSelectionMode(false);
																setLightMode(false);
															}}
														>
															{asset.name}
														</button>
													)}
												</For>
											</div>
										</Show>
									</div>
								);
							}}
						</For>
					</div>
				</div>

				{/* Rotation Control */}
				{(selectedAsset() || editingAsset()) && (
					<div class="mb-4">
						<label class="block text-sm text-slate-300 mb-2">
							Rotation: {rotationAngle()}°
						</label>
						<div class="flex gap-2">
							<button
								class="flex-1 px-3 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200 text-sm transition"
								onClick={() => setRotationAngle((prev) => (prev - 15 + 360) % 360)}
								title="Appuyez sur Q pour tourner à gauche"
							>
								↺ Q (Gauche)
							</button>
							<button
								class="flex-1 px-3 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200 text-sm transition"
								onClick={() => setRotationAngle((prev) => (prev + 15) % 360)}
								title="Appuyez sur D pour tourner à droite"
							>
								↻ D (Droite)
							</button>
						</div>
						<p class="mt-2 text-xs text-slate-400">
							Utilisez Q (gauche) et D (droite) pour faire tourner
						</p>
					</div>
				)}

				{selectedAsset() && !deleteMode() && !editMode() && !zoneSelectionMode() && (
					<p class="mt-3 text-xs text-slate-400">
						Cliquez sur la grille pour placer: <strong>{selectedAsset()!.name}</strong>
					</p>
				)}
				{selectedAsset() && zoneSelectionMode() && (
					<p class="mt-3 text-xs text-purple-400">
						Mode zone: Cliquez et glissez pour sélectionner une zone, puis relâchez pour placer <strong>{selectedAsset()!.name}</strong>
					</p>
				)}
				{editingAsset() && (
					<p class="mt-3 text-xs text-blue-400">
						Mode édition: Cliquez sur la grille pour replacer <strong>{editingAsset()!.asset.name}</strong>
					</p>
				)}
			</div>

			{/* Floating tools panel */}
			<div class="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/10 shadow-lg w-64 max-h-[90vh] overflow-y-auto">
				<h2 class="text-white font-display text-lg mb-3">Outils</h2>

				{/* Edit Mode Toggle */}
				<div class="mb-3">
					<button
						class={`w-full px-4 py-2 rounded-lg text-sm transition ${
							editMode()
								? "bg-blue-600/80 hover:bg-blue-600 text-white"
								: "bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200"
						}`}
						onClick={() => {
							const newEditMode = !editMode();
							setEditMode(newEditMode);
							cleanupPreviewMesh();
							if (newEditMode) {
								setDeleteMode(false);
								setZoneSelectionMode(false);
								setCollisionPreviewMode(false);
								setLightMode(false);
								setSelectedAsset(null);
								setEditingAsset(null);
							} else {
								setEditingAsset(null);
							}
						}}
					>
						{editMode() ? "Mode Édition Actif" : "Mode Édition"}
					</button>
					{editMode() && (
						<p class="mt-2 text-xs text-slate-400">
							Cliquez sur un objet pour le modifier, puis placez-le à la nouvelle position
						</p>
					)}
					{editingAsset() && (
						<p class="mt-1 text-xs text-green-400">
							Édition: {editingAsset()!.asset.name}
						</p>
					)}
				</div>

				{/* Delete Mode Toggle */}
				<div class="mb-3">
					<button
						class={`w-full px-4 py-2 rounded-lg text-sm transition ${
							deleteMode()
								? "bg-red-600/80 hover:bg-red-600 text-white"
								: "bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200"
						}`}
						onClick={() => {
							const newDeleteMode = !deleteMode();
							setDeleteMode(newDeleteMode);
							cleanupPreviewMesh();
							if (newDeleteMode) {
								setEditMode(false);
								setZoneSelectionMode(false);
								setCollisionPreviewMode(false);
								setLightMode(false);
								setSelectedAsset(null);
								setEditingAsset(null);
							}
						}}
					>
						{deleteMode() ? "✕ Mode Suppression Actif" : "✕ Mode Suppression"}
					</button>
					{deleteMode() && (
						<p class="mt-2 text-xs text-slate-400">
							Cliquez sur un objet pour le supprimer
						</p>
					)}
				</div>

				{/* Zone Selection Mode Toggle */}
				<div class="mb-3">
					<button
						class={`w-full px-4 py-2 rounded-lg text-sm transition ${
							zoneSelectionMode()
								? "bg-purple-600/80 hover:bg-purple-600 text-white"
								: "bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200"
						}`}
						onClick={() => {
							const newMode = !zoneSelectionMode();
							setZoneSelectionMode(newMode);
							cleanupPreviewMesh();
							if (newMode) {
								setDeleteMode(false);
								setEditMode(false);
								setCollisionPreviewMode(false);
								setLightMode(false);
							} else {
								setIsSelecting(false);
								setSelectionStart(null);
								setSelectionEnd(null);
								updateSelectionOverlay();
							}
						}}
					>
						{zoneSelectionMode() ? "📐 Mode Zone Actif" : "📐 Mode Sélection Zone"}
					</button>
					{zoneSelectionMode() && (
						<div class="mt-2 text-xs text-slate-400 space-y-1">
							<p>Sélectionnez une zone en cliquant et glissant</p>
							<p>L'asset sera placé sur toutes les cellules de la zone</p>
						</div>
					)}
				</div>

				{/* Collision Preview Mode Toggle */}
				<div class="mb-4">
					<button
						class={`w-full px-4 py-2 rounded-lg text-sm transition ${
							collisionPreviewMode()
								? "bg-yellow-600/80 hover:bg-yellow-600 text-white"
								: "bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200"
						}`}
						onClick={() => {
							const newMode = !collisionPreviewMode();
							setCollisionPreviewMode(newMode);
							cleanupPreviewMesh();
							if (newMode) {
								setDeleteMode(false);
								setEditMode(false);
								setZoneSelectionMode(false);
								setLightMode(false);
								setSelectedAsset(null);
								setEditingAsset(null);
								setShowCollisions(false);
								// Update overlays when mode is activated
								if (scene && gridManager) {
									updateCollisionOverlays();
								}
							} else {
								// Restaurer l'opacité des assets quand le mode est désactivé
								if (scene && gridManager) {
									restoreAllAssetsOpacity();
								}
							}
						}}
					>
						{collisionPreviewMode() ? "Mode Collision Actif" : "Mode Collision"}
					</button>
					{collisionPreviewMode() && (
						<div class="mt-2 text-xs text-slate-400 space-y-1">
							<p>Affiche les collisions de toutes les cellules</p>
							<p><span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" /> Vert = Zone walkable (marchable)</p>
							<p><span class="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" /> Jaune = Terrain difficile (coût élevé)</p>
							<p><span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" /> Rouge = Zone bloquée (non walkable)</p>
						</div>
					)}
				</div>

				{/* Light Placement Mode */}
				<div class="mb-4">
					<button
						class={`w-full px-4 py-2 rounded-lg text-sm transition ${
							lightMode()
								? "bg-orange-500/90 hover:bg-orange-500 text-white"
								: "bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200"
						}`}
						onClick={() => {
							const newMode = !lightMode();
							setLightMode(newMode);
							cleanupPreviewMesh();
							if (newMode) {
								setDeleteMode(false);
								setEditMode(false);
								setZoneSelectionMode(false);
								setCollisionPreviewMode(false);
								setSelectedAsset(null);
								setEditingAsset(null);
							}
						}}
					>
						{lightMode() ? "💡 Mode Lumière Actif" : "💡 Placer une lumière"}
					</button>
					<Show when={lightMode()}>
						<div class="mt-2 grid grid-cols-3 gap-1 bg-black/40 rounded-lg p-1">
							<For each={LIGHT_PRESET_IDS}>
								{(id) => (
									<button
										type="button"
										onClick={() => setSelectedLightPreset(id)}
										class={`px-2 py-1.5 rounded-md text-xs transition-colors ${
											selectedLightPreset() === id
												? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
												: "text-slate-200 hover:bg-white/10"
										}`}
									>
										{LIGHT_PRESETS[id].label}
									</button>
								)}
							</For>
						</div>
						<p class="mt-2 text-xs text-slate-400">
							Cliquez sur une cellule pour y déposer la lumière. Utilisez le mode suppression pour retirer une lumière existante.
						</p>
					</Show>
				</div>

				<div class="flex gap-2">
					<button
						class="flex-1 px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm transition"
						onClick={clearMap}
					>
						Effacer
					</button>
					<button
						class="flex-1 px-4 py-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-white text-sm transition"
						onClick={saveCurrentMap}
						disabled={isLoading()}
					>
						{isLoading() ? "Chargement..." : "Sauvegarder"}
					</button>
				</div>
			</div>

			{/* Canvas */}
			<canvas
				ref={canvasRef}
				class="w-full h-full"
				style={{ width: "100%", height: "100vh" }}
			/>

			{/* Context Menu for Spawn Zones */}
			<Show when={contextMenuCell()}>
				{(cell) => {
					const cellKey = `${cell().x},${cell().z}`;
					const currentZoneType = spawnZones().get(cellKey);
					
					return (
						<div
							class="fixed z-50 bg-black/90 backdrop-blur-sm rounded-lg border border-white/20 shadow-xl p-2 min-w-[200px]"
							style={{
								left: `${cell().screenX + 10}px`,
								top: `${cell().screenY + 10}px`,
							}}
							onClick={(e) => e.stopPropagation()}
						>
							<button
								class="w-full text-left px-4 py-2 rounded hover:bg-green-600/20 text-green-400 text-sm transition flex items-center gap-2"
								onClick={() => handleSetSpawnZone("ally")}
							>
								<div class="w-3 h-3 rounded-full bg-green-500"></div>
								Placer cellule allié
							</button>
							<button
								class="w-full text-left px-4 py-2 rounded hover:bg-red-600/20 text-red-400 text-sm transition flex items-center gap-2"
								onClick={() => handleSetSpawnZone("enemy")}
							>
								<div class="w-3 h-3 rounded-full bg-red-500"></div>
								Placer cellule ennemie
							</button>
							<button
								class="w-full text-left px-4 py-2 rounded hover:bg-purple-600/20 text-purple-400 text-sm transition flex items-center gap-2"
								onClick={() => handleSetSpawnZone("teleport")}
							>
								<div class="w-3 h-3 rounded-full bg-purple-500"></div>
								Placer cellule téléportation
							</button>
							{currentZoneType && (
								<button
									class="w-full text-left px-4 py-2 rounded hover:bg-gray-600/20 text-gray-300 text-sm transition"
									onClick={() => handleSetSpawnZone(null)}
								>
									Retirer la zone
								</button>
							)}
							<button
								class="w-full text-left px-4 py-2 rounded hover:bg-gray-600/20 text-gray-400 text-sm transition mt-1 border-t border-white/10 pt-2"
								onClick={() => setContextMenuCell(null)}
							>
								Annuler
							</button>
						</div>
					);
				}}
			</Show>
		</div>
	);
}
