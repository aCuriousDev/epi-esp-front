import { Component, onMount, onCleanup, createSignal, For, Show, createEffect, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import { A, useParams, useSearchParams, useNavigate } from "@solidjs/router";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-solid";
import { saveMap, loadMap, generateMapId, loadDungeon, saveDungeon, exportMapToFile, importMapFromJson, cacheMap, ensureMapCached, type SavedMapData, type SavedCellData, type SavedAssetData, type SavedLightData, type DungeonData } from "../services/mapStorage";
import { getApiUrl } from "../services/config";
import { AuthService } from "../services/auth.service";
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
		// Assets placed in edge/corner mode have a non-zero X or Z local offset.
		// They sit at ground level beside centre assets and must NOT be treated as
		// part of the sequential centre stack — otherwise deleting a centre asset
		// would push them upward.
		const EDGE_EPSILON = 0.01;
		let currentHeight = this.groundTopY;
		for (const stackedAsset of this.stackedAssets) {
			const isEdgeOrCorner =
				Math.abs(stackedAsset.mesh.position.x) > EDGE_EPSILON ||
				Math.abs(stackedAsset.mesh.position.z) > EDGE_EPSILON;

			const targetY = isEdgeOrCorner ? this.groundTopY : currentHeight;
			assetStackManager.positionMeshAtHeight(stackedAsset.mesh, targetY, 0);

			// Recalculer les positions Y relatives
			const newPositions = assetStackManager.calculateCellRelativeYPositions(stackedAsset.mesh, 0);
			stackedAsset.bottomY = newPositions.bottomY;
			stackedAsset.topY = newPositions.topY;
			stackedAsset.height = newPositions.height;

			// Only advance the centre stack cursor for centre assets
			if (!isEdgeOrCorner) {
				currentHeight = stackedAsset.topY;
			}
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
			// When rotationQuaternion is set Babylon ignores rotation; convert to euler
			// so we always read the true Y rotation regardless of which path was used.
			const rotationY = sa.mesh.rotationQuaternion
				? sa.mesh.rotationQuaternion.toEulerAngles().y
				: sa.mesh.rotation.y;
			const data: any = {
				assetId: metadata?.assetId || sa.asset.id,
				assetPath: metadata?.assetPath || sa.asset.path,
				assetType: metadata?.assetType || sa.asset.type,
				scale: sa.mesh.scaling.x, // Assume uniform scaling
				rotationY,
				positionY: sa.mesh.position.y,
				offsetX: sa.mesh.position.x || undefined,
				offsetZ: sa.mesh.position.z || undefined,
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
			const groundRotationY = this.groundMesh.rotationQuaternion
				? this.groundMesh.rotationQuaternion.toEulerAngles().y
				: this.groundMesh.rotation.y;
			ground = {
				assetId: metadata?.assetId || "unknown",
				assetPath: metadata?.assetPath || "unknown",
				assetType: metadata?.assetType || "floor",
				scale: this.groundMesh.scaling.x,
				rotationY: groundRotationY,
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

// Flat list of every available asset — used by the library search
const ALL_ASSETS: MapAsset[] = ASSET_CATEGORIES.flatMap(c => c.assets);

// ── Placement mode ────────────────────────────────────────────────────────
/** Where within the cell the asset is positioned. */
type PlacementMode = 'center' | 'edge' | 'corner';

/**
 * Returns the (x, z) local offset to apply to an asset based on the chosen
 * placement mode and the current rotation (in radians).
 *
 * • center : (0, 0) — no offset
 * • edge   : the asset hugs the wall in the direction it faces (sin/cos of rot)
 * • corner : the asset sits in the nearest corner to the facing direction
 *            (rotation shifted by π/4 maps each 90° quadrant to one corner)
 */
function computePlacementOffset(rotRad: number, mode: PlacementMode): { x: number; z: number } {
	const SNAP_DIST = 0.45;
	if (mode === 'edge') {
		return { x: Math.sin(rotRad) * SNAP_DIST, z: -Math.cos(rotRad) * SNAP_DIST };
	}
	if (mode === 'corner') {
		const sh = rotRad + Math.PI / 4;
		return {
			x: (Math.sin(sh) >= 0 ? 1 : -1) * SNAP_DIST,
			z: (Math.cos(sh) <= 0 ? 1 : -1) * SNAP_DIST,
		};
	}
	return { x: 0, z: 0 };
}

// ── User-managed favorites (localStorage) ─────────────────────────────────
const USER_FAVORITES_KEY = 'dndiscord_editor_favorites';

function loadUserFavoritePaths(): string[] {
	try {
		const raw = localStorage.getItem(USER_FAVORITES_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as string[];
			if (Array.isArray(parsed) && parsed.length > 0) return parsed;
		}
	} catch { /* ignore */ }
	// First launch: seed with the curated default list
	return [...ASSET_FAVORITE_PATHS];
}

function saveUserFavoritePaths(paths: string[]): void {
	try {
		localStorage.setItem(USER_FAVORITES_KEY, JSON.stringify(paths));
	} catch (e) {
		console.warn('[MapEditor] Failed to persist favorites:', e);
	}
}

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
	/** 'saved' = DB OK | 'local' = DB inaccessible, sauvegardé localement | 'unsaved' = en attente */
	const [saveStatus, setSaveStatus] = createSignal<'saved' | 'local' | 'unsaved' | null>(null);
	let _saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	/** Timestamp de création conservé en mémoire pour éviter de le recalculer à chaque save */
	let _mapCreatedAt: number = Date.now();
	const [dungeonData, setDungeonData] = createSignal<DungeonData | null>(null);
	const [selectedAsset, setSelectedAsset] = createSignal<MapAsset | null>(null);
	const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set());
	const [activePaletteTab, setActivePaletteTab] = createSignal<"favoris" | "tous">("favoris");
	const [searchQuery, setSearchQuery] = createSignal("");

	const visibleCategories = () => {
		const base = activePaletteTab() === "favoris"
			? [pickFavoritesCategory(ASSET_CATEGORIES, userFavoritePaths())]
			: ASSET_CATEGORIES;
		return filterCategories(base, searchQuery());
	};
	const [rotationAngle, setRotationAngle] = createSignal(0);
	const [placementMode, setPlacementMode] = createSignal<PlacementMode>('center');
	const [showGrid, setShowGrid] = createSignal(true);
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
	const [cameraMode, setCameraMode] = createSignal<'free' | 'top'>('free');
	const [rubberBandRect, setRubberBandRect] = createSignal<{ left: number; top: number; width: number; height: number } | null>(null);
	const [placedAssets, setPlacedAssets] = createSignal<MapAsset[]>([]);
	const [showLibrary, setShowLibrary] = createSignal(false);
	const [librarySearch, setLibrarySearch] = createSignal('');
	const [libraryCategory, setLibraryCategory] = createSignal<string>('');
	// User-managed favorites — paths stored in localStorage
	const [userFavoritePaths, setUserFavoritePaths] = createSignal<string[]>(loadUserFavoritePaths());
	const isFavorite = (path: string) => userFavoritePaths().includes(path);
	const toggleFavorite = (path: string) => {
		const current = userFavoritePaths();
		const next = current.includes(path)
			? current.filter(p => p !== path)
			: [...current, path];
		setUserFavoritePaths(next);
		saveUserFavoritePaths(next);
	};
	// 'auto' = always stack on top of existing pile; number = force Y placement height
	const [workingHeight, setWorkingHeight] = createSignal<'auto' | number>('auto');
	// Feedback d'import (null = idle, 'ok' | 'error')
	const [importStatus, setImportStatus] = createSignal<{ type: 'ok' | 'error'; message: string } | null>(null);

	let importFileInputRef: HTMLInputElement | undefined;

	// Zones de placement pour combats et téléportation
	const [spawnZones, setSpawnZones] = createSignal<Map<string, "ally" | "enemy" | "teleport">>(new Map());
	const [contextMenuCell, setContextMenuCell] = createSignal<{ x: number; z: number; screenX: number; screenY: number } | null>(null);
	
	let previewMesh: AbstractMesh | null = null;
	let previewAssetId: string | null = null;
	let previewLoadToken = 0; // guards against races when the selected asset changes mid-load
	// Base Y rotation baked into the GLTF model (captured once on load).
	// Both the ghost preview and the placement mesh use the same model, so we
	// store it here and add it back on every rotation update so the ghost
	// always matches the placed asset exactly.
	let previewBaseRotationY = 0;

	// Edit mode keeps the original mesh visible with a blue emissive tint
	// while a ghost preview follows the cursor. The original is only
	// disposed when the placement is actually committed (or if the user
	// clicks the same asset again to deselect).
	let editingOriginalMesh: AbstractMesh | null = null;
	let editingOriginalEmissives: Array<{ mat: StandardMaterial | PBRMaterial; orig: Color3 }> = [];
	let gridLineMeshes: AbstractMesh[] = [];
	const EDIT_TINT = new Color3(0.2, 0.55, 1);

	const tintEditingMesh = (root: AbstractMesh) => {
		editingOriginalEmissives = [];
		const visit = (m: AbstractMesh) => {
			const mat = m.material;
			if (mat instanceof StandardMaterial || mat instanceof PBRMaterial) {
				editingOriginalEmissives.push({ mat, orig: mat.emissiveColor.clone() });
				mat.emissiveColor = EDIT_TINT.clone();
				if (mat instanceof PBRMaterial) {
					mat.emissiveIntensity = 1.0;
				}
			}
			m.getChildMeshes().forEach(visit);
		};
		visit(root);
	};

	const untintEditingMesh = () => {
		editingOriginalEmissives.forEach(({ mat, orig }) => {
			try {
				mat.emissiveColor = orig;
				if (mat instanceof PBRMaterial) mat.emissiveIntensity = 1.0;
			} catch {
				// material was disposed — nothing to restore.
			}
		});
		editingOriginalEmissives = [];
	};

	const consumeEditingOriginal = () => {
		if (!editingOriginalMesh) return;
		// Material tint is lost with the mesh disposal; no need to untint first.
		if (!editingOriginalMesh.isDisposed()) {
			gridManager?.unregisterAsset(editingOriginalMesh.name);
			editingOriginalMesh.dispose();
		}
		editingOriginalMesh = null;
		editingOriginalEmissives = [];
	};

	const cancelEditingSelection = () => {
		untintEditingMesh();
		editingOriginalMesh = null;
	};

	// Tracks which asset types are currently placed on the map (for the sidebar list)
	let usedAssetsTracker = new Map<string, MapAsset>();

	const addToPlacedAssets = (asset: MapAsset) => {
		usedAssetsTracker.set(asset.id, asset);
		setPlacedAssets(Array.from(usedAssetsTracker.values()));
	};

	const refreshPlacedAssets = () => {
		usedAssetsTracker.clear();
		if (gridManager) {
			gridManager.getAllCells().forEach(cell => {
				cell.getStackedAssets().forEach(sa => {
					usedAssetsTracker.set(sa.asset.id, sa.asset);
				});
			});
		}
		setPlacedAssets(Array.from(usedAssetsTracker.values()));
	};
	let selectionOverlays: Map<string, Mesh> = new Map(); // Map des overlays de sélection par cellule
	let selectionMaterial: StandardMaterial | null = null; // Shared material for selection overlays (reused, not recreated every frame)
	let rubberBandStart: { x: number; y: number } | null = null; // DOM coords for CSS rubber-band start
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

					// Lazy-create a single shared material (reused for all cells, avoids O(n) GPU allocs per frame)
					if (!selectionMaterial && scene) {
						selectionMaterial = new StandardMaterial('selectionSharedMat', scene);
						selectionMaterial.diffuseColor = new Color3(0.2, 0.6, 1);
						selectionMaterial.emissiveColor = new Color3(0.1, 0.3, 0.5);
						selectionMaterial.alpha = 0.5;
						selectionMaterial.disableLighting = true;
						selectionMaterial.backFaceCulling = false;
					}
					if (selectionMaterial) overlay.material = selectionMaterial;

					selectionOverlays.set(`${x},${z}`, overlay);
				}
			}
		}
	};

	// Initialize map ID and name from params (in onMount to ensure params are available)

	// If edit mode is turned off or editingAsset clears (without a commit
	// path), make sure the tinted original mesh returns to its normal
	// look. The commit path calls consumeEditingOriginal() which disposes
	// the mesh outright; this effect is purely a safety net for mode
	// switches, palette clicks, etc.
	createEffect(() => {
		const active = editMode() && !!editingAsset();
		if (!active && editingOriginalMesh && !editingOriginalMesh.isDisposed()) {
			untintEditingMesh();
			editingOriginalMesh = null;
		}
	});

	// Update preview rotation when the slider / keyboard shortcut changes.
	// Forces a world-matrix recompute so the new angle shows on the very
	// next render instead of waiting for the user to move the cursor.
	createEffect(() => {
		// Read rotationAngle AND placementMode unconditionally so Solid tracks
		// both even when previewMesh isn't ready yet.
		const rotationRad = (rotationAngle() * Math.PI) / 180;
		const offset = computePlacementOffset(rotationRad, placementMode());
		if (previewMesh && !previewMesh.isDisposed() && scene && (selectedAsset() || editingAsset() || lightMode())) {
			// Always include the GLTF base offset so the ghost matches the placed mesh.
			previewMesh.rotation.y = previewBaseRotationY + rotationRad;
			previewMesh.position.x = offset.x;
			previewMesh.position.z = offset.z;
			previewMesh.computeWorldMatrix(true);
			previewMesh.getChildMeshes(false).forEach((child) => child.computeWorldMatrix(true));
		}
	});

	// Auto-switch placement mode based on selected asset type:
	// Toggle grid line visibility reactively.
	createEffect(() => {
		const visible = showGrid();
		gridLineMeshes.forEach(m => { if (!m.isDisposed()) m.isVisible = visible; });
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
						// BabylonJS GLTF loader sets rotationQuaternion on every mesh.
						// When rotationQuaternion is non-null it overrides rotation entirely,
						// so we must null it out before assigning rotation.y.
						if (mesh.rotationQuaternion) mesh.rotationQuaternion = null;
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
						// Same fix: null out rotationQuaternion before setting rotation.y
						if (mesh.rotationQuaternion) mesh.rotationQuaternion = null;
						mesh.rotation.y = assetData.rotationY;
						
						const cellNode = cell.getCellNode();
						if (cellNode) {
							mesh.parent = cellNode;
							mesh.position.set(
								assetData.offsetX ?? 0,
								assetData.positionY,
								assetData.offsetZ ?? 0,
							);
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
			// Rebuild placed-assets sidebar from loaded data
			refreshPlacedAssets();
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
			spawnZones().forEach((type, key) => { spawnZonesRecord[key] = type; });
			const lightsList = placedLights();

			const mapData: SavedMapData = {
				id: mapId()!,
				name,
				createdAt: _mapCreatedAt,
				updatedAt: Date.now(),
				cells: cellsData,
				spawnZones: Object.keys(spawnZonesRecord).length > 0 ? spawnZonesRecord : undefined,
				// mapType / dungeonId / roomIndex : lus depuis le cache si disponible,
				// sinon omis (les maps DB n'en ont pas besoin)
				...(() => {
					const cached = loadMap(mapId()!);
					return {
						mapType:   cached?.mapType,
						dungeonId: cached?.dungeonId,
						roomIndex: cached?.roomIndex,
					};
				})(),
				lights: lightsList.length > 0 ? lightsList : undefined,
				version: 2,
			};

			// Maps legacy (ID format "map_...") : pas de DB → localStorage direct
			const isDbMap = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapData.id);
			if (!isDbMap) {
				saveMap(mapData);
				if (dungeonData()) {
					const d = dungeonData()!;
					d.updatedAt = Date.now();
					saveDungeon(d);
				}
				setSaveStatus('local');
				return true;
			}

			// Maps DB (UUID) : DB en source de vérité, localStorage en cache du résultat
			schedulePersist(mapData);

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

	/**
	 * Debounced API persist (UUID maps uniquement).
	 * 1. PUT /api/maps/mine/:id
	 * 2. Succès → cacheMap(mapData) pour que loadMap(uuid) fonctionne ensuite
	 * 3. Échec (réseau / API down) → saveMap(mapData) en fallback localStorage
	 */
	const schedulePersist = (mapData: SavedMapData) => {
		setSaveStatus('unsaved');
		if (_saveDebounceTimer !== null) clearTimeout(_saveDebounceTimer);
		_saveDebounceTimer = setTimeout(async () => {
			_saveDebounceTimer = null;
			const id = mapData.id;

			try {
				const token = AuthService.getToken();
				if (!token) {
					saveMap(mapData);   // fallback localStorage si pas de token
					setSaveStatus('local');
					return;
				}
				const res = await fetch(`${getApiUrl()}/api/maps/mine/${id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ name: mapData.name, data: JSON.stringify(mapData) }),
				});
				if (res.ok) {
					// DB sauvegardée → mettre à jour le cache localStorage
					cacheMap(mapData);
					setSaveStatus('saved');
				} else {
					console.warn('[MapEditor] API save failed:', res.status);
					saveMap(mapData);   // fallback localStorage
					setSaveStatus('local');
				}
			} catch {
				saveMap(mapData);       // fallback localStorage (réseau down)
				setSaveStatus('local');
			}
		}, 1500);
	};

	const saveCurrentMap = () => {
		if (!gridManager || !mapId()) {
			// alert() interdit dans Discord Activity (CSP) — utiliser saveStatus
			setSaveStatus('local');
			console.warn('[MapEditor] saveCurrentMap: gridManager or mapId missing');
			return;
		}
		const name = mapName().trim();
		if (!name) {
			// Laisser le champ en état d'erreur plutôt que d'alerter
			setSaveStatus('unsaved');
			return;
		}
		if (saveMapSilent()) {
			setSaveStatus('saved');
		} else {
			setSaveStatus('local');
		}
	};

	/** Exporte l'état courant de la carte en fichier JSON téléchargeable. */
	const exportCurrentMap = () => {
		if (!gridManager) return;
		const name = mapName().trim() || 'carte';

		const cellsData = gridManager.exportData();
		const spawnZonesRecord: Record<string, "ally" | "enemy" | "teleport"> = {};
		spawnZones().forEach((type, key) => { spawnZonesRecord[key] = type; });

		const existingMap = mapId() ? loadMap(mapId()!) : null;
		const mapData: SavedMapData = {
			id:          mapId() ?? 'exported',
			name,
			createdAt:   existingMap?.createdAt ?? Date.now(),
			updatedAt:   Date.now(),
			cells:       cellsData,
			spawnZones:  Object.keys(spawnZonesRecord).length > 0 ? spawnZonesRecord : undefined,
			mapType:     existingMap?.mapType,
			dungeonId:   existingMap?.dungeonId,
			roomIndex:   existingMap?.roomIndex,
		};
		exportMapToFile(mapData);
	};

	/** Lit le fichier sélectionné, importe la carte et recharge le plateau. */
	const handleImportFile = async (file: File) => {
		setImportStatus(null);
		try {
			const text = await file.text();

			// Parser et valider le JSON
			let parsed: SavedMapData;
			try {
				parsed = JSON.parse(text) as SavedMapData;
			} catch {
				throw new Error('Invalid file: malformed JSON.');
			}
			if (!parsed || !Array.isArray(parsed.cells)) {
				throw new Error('Invalid format: "cells" field missing or invalid.');
			}

			// Créer la carte en DB pour obtenir un UUID
			let newId: string;
			const token = AuthService.getToken();
			const now = Date.now();
			try {
				const res = token ? await fetch(`${getApiUrl()}/api/maps/mine`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ name: parsed.name ?? 'Imported map', data: '{}' }),
				}) : null;
				if (res?.ok) {
					const created = await res.json();
					newId = created.id;
					_mapCreatedAt = created.createdAt ? new Date(created.createdAt).getTime() : now;
				} else {
					// Fallback : ID legacy si l'API est inaccessible
					newId = generateMapId();
					_mapCreatedAt = now;
				}
			} catch {
				newId = generateMapId();
				_mapCreatedAt = now;
			}

			// Construire la map avec le nouvel ID
			const importedMap: SavedMapData = {
				...parsed,
				id:        newId,
				name:      parsed.name ?? 'Imported map',
				createdAt: _mapCreatedAt,
				updatedAt: now,
				mapType:   parsed.mapType === 'dungeon-room' ? 'classique' : (parsed.mapType ?? 'classique'),
				dungeonId: undefined,
				roomIndex: undefined,
			};

			// Mettre à jour l'état du composant
			setMapId(newId);
			setMapName(importedMap.name);
			navigate(`/map-editor/${newId}`, { replace: true });

			// Recharger le plateau avec les données importées
			await loadMapData(importedMap);

			// Sauvegarder : DB si UUID, localStorage si fallback legacy
			const isDbMap = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newId);
			if (isDbMap) {
				const t = AuthService.getToken();
				if (t) {
					const res = await fetch(`${getApiUrl()}/api/maps/mine/${newId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
						body: JSON.stringify({ name: importedMap.name, data: JSON.stringify(importedMap) }),
					});
					if (res.ok) {
						cacheMap(importedMap);
						setSaveStatus('saved');
					} else {
						saveMap(importedMap);
						setSaveStatus('local');
					}
				} else {
					saveMap(importedMap);
					setSaveStatus('local');
				}
			} else {
				saveMap(importedMap);
				setSaveStatus('local');
			}

			setImportStatus({ type: 'ok', message: `"${importedMap.name}" imported!` });
			setTimeout(() => setImportStatus(null), 3000);
		} catch (err: any) {
			setImportStatus({ type: 'error', message: err?.message ?? 'Unknown error.' });
			setTimeout(() => setImportStatus(null), 4000);
		}
	};

	onMount(() => {
		if (!canvasRef) return;

		const paramMapId = params.mapId;
		if (paramMapId === "new") {
			// Tenter de créer la map en DB pour obtenir un UUID, fallback localStorage
			(async () => {
				try {
					const token = AuthService.getToken();
					const res = token ? await fetch(`${getApiUrl()}/api/maps/mine`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
						body: JSON.stringify({ name: 'Nouvelle Map', data: '{}' }),
					}) : null;
					if (res?.ok) {
						const created = await res.json();
						setMapId(created.id);
						_mapCreatedAt = created.createdAt ? new Date(created.createdAt).getTime() : Date.now();
						setSaveStatus('saved');
						navigate(`/map-editor/${created.id}`, { replace: true });
					} else {
						setMapId(generateMapId());
						setSaveStatus('local');
					}
				} catch {
					setMapId(generateMapId());
					setSaveStatus('local');
				}
			})();
			setMapName("Nouvelle Map");
		} else if (paramMapId) {
			setMapId(paramMapId);
			const savedMap = loadMap(paramMapId);
			if (savedMap) {
				setMapName(savedMap.name);
				_mapCreatedAt = savedMap.createdAt;
			}
			setSaveStatus('saved');
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

		// Store the free-view defaults so we can restore them when switching back
		const FREE_VIEW = { alpha: Math.PI / 3, beta: Math.PI / 3, radius: 30 };

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
		setTimeout(async () => {
			const currentMapId = mapId();
			if (currentMapId && params.mapId !== "new") {
				let savedMap = loadMap(currentMapId);
				if (!savedMap) {
					// Map UUID pas en cache local (autre PC) → tenter de récupérer depuis l'API
					await ensureMapCached(currentMapId);
					savedMap = loadMap(currentMapId);
					// Mettre à jour le nom si on vient de le récupérer
					if (savedMap) setMapName(savedMap.name);
				}
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
		// Restore any mesh still blue-tinted from an edit-mode session
		// (it was going to be disposed with the scene anyway, but
		// untinting first keeps the material look consistent if the
		// user navigates back).
		untintEditingMesh();
		editingOriginalMesh = null;
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
		
		// Grid lines — stored in gridLineMeshes so visibility can be toggled.
		gridLineMeshes = [];
		for (let i = 0; i <= GRID_SIZE; i++) {
			const x = minX + (i * TILE_SIZE);
			const line = MeshBuilder.CreateLines(`gridLineX_${i}`, {
				points: [new Vector3(x, 0.12, minZ), new Vector3(x, 0.12, maxZ)],
			}, scene);
			line.color = gridColor;
			line.isVisible = showGrid();
			gridLineMeshes.push(line);
		}

		for (let i = 0; i <= GRID_SIZE; i++) {
			const z = minZ + (i * TILE_SIZE);
			const line = MeshBuilder.CreateLines(`gridLineZ_${i}`, {
				points: [new Vector3(minX, 0.12, z), new Vector3(maxX, 0.12, z)],
			}, scene);
			line.color = gridColor;
			line.isVisible = showGrid();
			gridLineMeshes.push(line);
		}

		// Invisible pickable planes for each cell
		if (!gridManager) return;
		
		gridManager.getAllCells().forEach((cell) => {
			const cellNode = cell.getCellNode();
			if (!cellNode) return;
			
			const plane = MeshBuilder.CreatePlane(`cellPlane_${cell.x}_${cell.z}`, {
				width: TILE_SIZE * 1.0,
				height: TILE_SIZE * 1.0
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

			// Capture and discard the GLTF base rotation immediately so that
			// repositionPreviewOnCell and the rotation-change createEffect can
			// always apply (previewBaseRotationY + userRotation) consistently,
			// matching what placeAssetOnCell does for the committed mesh.
			previewBaseRotationY = mesh.rotationQuaternion
				? mesh.rotationQuaternion.toEulerAngles().y
				: 0;
			if (mesh.rotationQuaternion) mesh.rotationQuaternion = null;
			mesh.rotation.y = previewBaseRotationY;

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

		// Latest rotation from the UI — always include the GLTF base offset.
		const rotationRad = (rotationAngle() * Math.PI) / 180;
		previewMesh.rotation.y = previewBaseRotationY + rotationRad;

		const cellNode = cell.getCellNode();
		if (!cellNode) return;
		previewMesh.parent = cellNode;
		// Apply placement-mode offset so the preview ghost matches exactly where
		// the asset will be committed (centre / bord / coin).
		const offset = computePlacementOffset(rotationRad, placementMode());
		previewMesh.position.set(offset.x, 0, offset.z);
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

	// ── Camera view helpers ───────────────────────────────────────────────────

	/** Smooth-animate the ArcRotateCamera to a target alpha/beta/radius over `duration` ms. */
	const animateCamera = (targetAlpha: number, targetBeta: number, targetRadius: number, duration = 400) => {
		if (!camera) return;
		const startAlpha  = camera.alpha;
		const startBeta   = camera.beta;
		const startRadius = camera.radius;
		const startTime   = performance.now();

		const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		const lerp      = (a: number, b: number, t: number) => a + (b - a) * t;

		const step = (now: number) => {
			if (!camera) return;
			const t    = Math.min((now - startTime) / duration, 1);
			const ease = easeInOut(t);
			camera.alpha  = lerp(startAlpha,  targetAlpha,  ease);
			camera.beta   = lerp(startBeta,   targetBeta,   ease);
			camera.radius = lerp(startRadius, targetRadius, ease);
			if (t < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	};

	const switchToTopView = () => {
		if (!camera) return;
		setCameraMode('top');
		animateCamera(camera.alpha, 0.01, 50);
	};

	const switchToFreeView = () => {
		setCameraMode('free');
		animateCamera(Math.PI / 3, Math.PI / 3, 30);
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
			if (deleteMode() || collisionPreviewMode() || zoneSelectionMode()) {
				hidePreview();
				return;
			}

			// In light mode, resolve the "current asset" to a synthetic
			// MapAsset pointing at the selected preset's fixture mesh —
			// lets the user see a ghost of the torch/lantern/orb where it
			// will drop on release, same as any normal asset.
			const lightPresetAsset: MapAsset | null = lightMode()
				? {
					id: `light_preset_${selectedLightPreset()}`,
					name: LIGHT_PRESETS[selectedLightPreset()].label,
					path: LIGHT_PRESETS[selectedLightPreset()].meshPath,
					// "block" keeps the preview at 0.5 scale to match
					// spawnLightFixture's final mesh scaling.
					type: "block",
				}
				: null;

			const currentAsset: MapAsset | null =
				lightPresetAsset ?? selectedAsset() ?? editingAsset()?.asset ?? null;
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

			// 4. Appliquer l'offset de placement (centre / bord / coin)
			const rotRad = (rotationAngle() * Math.PI) / 180;
			const pOffset = computePlacementOffset(rotRad, placementMode());
			mesh.position.set(pOffset.x, 0, pOffset.z);
			
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
				const wh = workingHeight();
				if (wh === 'auto') {
					let effectiveStackHeight: number;

					if (placementMode() !== 'center') {
						// Bord / coin : l'asset est décalé en XZ et n'entre pas en
						// collision avec les objets au centre. On part du ras du sol
						// pour ne pas le faire flotter au-dessus de la pile centrale.
						effectiveStackHeight = cell.getGroundTopY();
					} else {
						// Centre : empiler au-dessus de la pile effective (défaut).
						effectiveStackHeight = cell.getStackHeight();

						// Vérifier les assets d'autres cellules qui débordent sur celle-ci
						const externalAssets = gridManager.getAssetsAffectingCell(gridX, gridZ);
						for (const extMesh of externalAssets) {
							const isInStack = cell.getStackedAssets().some(sa => sa.mesh === extMesh);
							const isGround = cell.getGround() === extMesh;
							if (isInStack || isGround) continue;
							const extTopY = assetStackManager.calculateWorldTopY(extMesh);
							effectiveStackHeight = Math.max(effectiveStackHeight, extTopY);
						}
					}

					assetStackManager.positionMeshAtHeight(mesh, effectiveStackHeight, 0);
				} else {
					// Hauteur manuelle: placer exactement à la hauteur demandée
					assetStackManager.positionMeshAtHeight(mesh, wh, 0);
				}

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

			// Track this asset in the sidebar list
			addToPlacedAssets(asset);

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
				// Update CSS rubber-band overlay
				if (rubberBandStart && canvasRef) {
					const r = canvasRef.getBoundingClientRect();
					const ev = pointerInfo.event as PointerEvent;
					const domX = ev.clientX - r.left;
					const domY = ev.clientY - r.top;
					setRubberBandRect({
						left: Math.min(rubberBandStart.x, domX),
						top: Math.min(rubberBandStart.y, domY),
						width: Math.abs(domX - rubberBandStart.x),
						height: Math.abs(domY - rubberBandStart.y),
					});
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
				// Clear rubber-band overlay and release pointer capture
				rubberBandStart = null;
				setRubberBandRect(null);
				try { canvasRef?.releasePointerCapture((pointerInfo.event as PointerEvent).pointerId); } catch (_) {}
				updateSelectionOverlay();
				return;
			}
		});

		// Placement fires on POINTERTAP (pointer-up without appreciable move)
		// rather than POINTERDOWN. Benefits:
		//  - Camera orbit drags no longer drop an asset mid-rotation.
		//  - Touchpad / mobile users can slide to aim before releasing.
		//  - Rectangle zone-selection is the only mode that needs immediate
		//    press feedback, so it keeps a dedicated POINTERDOWN branch
		//    below.
		scene.onPointerObservable.add((pointerInfo) => {
			// Zone selection: start on POINTERDOWN so the rectangle grows
			// while the user drags. Ending handled by the POINTERUP observer
			// registered elsewhere in setupClickHandler.
			if (
				pointerInfo.type === PointerEventTypes.POINTERDOWN &&
				scene &&
				zoneSelectionMode() &&
				(selectedAsset() || editingAsset()?.asset)
			) {
				const coords = getGridCoordsFromPointer();
				if (coords) {
					setSelectionStart(coords);
					setSelectionEnd(coords);
					setIsSelecting(true);
					updateSelectionOverlay();
				}
				return;
			}

			if (pointerInfo.type === PointerEventTypes.POINTERTAP && scene) {
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

					// Stack the light on top of whatever is already on the
					// cell (table, wall, crate, etc.) — same logic as normal
					// asset placement. Also account for external multi-cell
					// assets that overflow into this cell.
					let stackY = 0;
					if (gridManager && assetStackManager) {
						const cell = gridManager.getCell(gridX, gridZ);
						if (cell) {
							stackY = cell.getStackHeight();
							const external = gridManager.getAssetsAffectingCell(gridX, gridZ);
							for (const extMesh of external) {
								const inStack = cell.getStackedAssets().some((sa) => sa.mesh === extMesh);
								const isGround = cell.getGround() === extMesh;
								if (inStack || isGround) continue;
								const extTopY = assetStackManager.calculateWorldTopY(extMesh);
								stackY = Math.max(stackY, extTopY);
							}
						}
					}

					const newLight: SavedLightData = {
						presetId: selectedLightPreset(),
						x: gridX,
						z: gridZ,
						y: stackY,
					};
					setPlacedLights((prev) => {
						const without = prev.filter((l) => !(l.x === gridX && l.z === gridZ));
						return [...without, newLight];
					});
					void spawnLightFixture(newLight);
					return;
				}

				// Zone selection start is handled on POINTERDOWN above; swallow
				// the tap so a release doesn't also try to place an asset.
				if (zoneSelectionMode()) {
					return;
				}

				// In edit mode we need the cellPlane filter once we're already
				// holding an asset (placement tap). Only use the delete/edit
				// filter for the pick-up tap in edit mode and for delete.
				const isDeleteOrEdit = deleteMode() || (editMode() && !editingAsset());

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
							refreshPlacedAssets();

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
					// Edit mode flow:
					//   1. First tap on an asset → select it: blue tint on
					//      the original mesh (stays in place), editingAsset
					//      set, ghost preview follows the cursor.
					//   2. Second tap on the same asset → deselect: un-tint
					//      and clear editing state. Original stays exactly
					//      where it was.
					//   3. Second tap on a cellPlane → commit move: dispose
					//      the original, place a fresh mesh at the target.
					if (!editingAsset()) {
						const rootMesh = hoveredMesh
							|| (pickInfo?.hit && pickInfo.pickedMesh ? findRootAssetMesh(pickInfo.pickedMesh) : null);
						if (rootMesh && gridManager) {
							clearHighlight();
							let foundStacked: { asset: MapAsset; cell: GridCell; mesh: AbstractMesh } | null = null;
							gridManager.getAllCells().forEach((cell) => {
								cell.getStackedAssets().forEach((sa) => {
									if (sa.mesh === rootMesh) {
										foundStacked = { asset: sa.asset, cell, mesh: sa.mesh };
									}
								});
							});
							if (foundStacked) {
								// Keep the original alive + blue-tinted. It will
								// be disposed on commit (cellPlane tap) or
								// un-tinted on deselect (same-asset tap).
								const picked = foundStacked as { asset: MapAsset; cell: GridCell; mesh: AbstractMesh };
								editingOriginalMesh = picked.mesh;
								tintEditingMesh(picked.mesh);
								setEditingAsset(picked);
								setSelectedAsset(picked.asset);
								setRotationAngle(0);
								if (showCollisions()) {
									updateCollisionOverlays();
								}
							}
						}
						return;
					}

					// editingAsset() is already set. If the click is on the
					// same original mesh (any descendant), the user wants to
					// deselect — not place.
					if (editingOriginalMesh) {
						const rawPick = scene.pick(scene.pointerX, scene.pointerY);
						if (rawPick?.hit && rawPick.pickedMesh) {
							const descendants = editingOriginalMesh.getDescendants(false);
							const isSameAsset =
								rawPick.pickedMesh === editingOriginalMesh ||
								descendants.some((d) => d === rawPick.pickedMesh);
							if (isSameAsset) {
								cancelEditingSelection();
								setEditingAsset(null);
								setSelectedAsset(null);
								cleanupPreviewMesh();
								return;
							}
						}
					}
					// Fall through to the placement branch below.
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
									// Edit-mode commit: the original mesh is
									// still in its old spot with the blue
									// tint — remove it now that the new copy
									// is placed on the target cell.
									consumeEditingOriginal();
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
		usedAssetsTracker.clear();
		setPlacedAssets([]);
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

	// Human-readable current mode for the top banner. Order matters:
	// delete/edit/zone/collision/light "take over" the scene and should win
	// over "Placement" even when an asset is still selected.
	const currentModeLabel = () => {
		if (deleteMode()) return { text: "Delete mode", color: "bg-red-600/80 text-white" };
		if (editMode()) return { text: "Edit Mode", color: "bg-blue-600/80 text-white" };
		if (zoneSelectionMode()) return { text: "Zone mode", color: "bg-purple-600/80 text-white" };
		if (collisionPreviewMode()) return { text: "Collision mode", color: "bg-yellow-500/80 text-game-darker" };
		if (lightMode()) return { text: "Light Mode", color: "bg-orange-500/90 text-game-darker" };
		if (selectedAsset() || editingAsset()) return { text: "Placement", color: "bg-emerald-600/80 text-white" };
		return { text: "View", color: "bg-slate-700/80 text-white" };
	};

	return (
		<div class="relative min-h-full w-full overflow-hidden bg-brand-gradient">
			<div class="vignette absolute inset-0 pointer-events-none"></div>

			{/* Current-mode banner — top-center. Shows the editor's current
			    tool at a glance so the user knows what a click will do. */}
			<div class="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30">
				<div class={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold shadow-lg border border-white/10 backdrop-blur-sm ${currentModeLabel().color}`}>
					{currentModeLabel().text}
				</div>
			</div>

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
										Previous room
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
									Last room! Portal or kill enemies = victory
								</span>
							</Show>
						</div>
					);
				})()}
			</Show>

			{/* Main menu (infos + assets) */}
			<div class="absolute top-4 left-16 sm:left-20 z-20 bg-black/60 backdrop-blur-sm rounded-xl p-4 border border-white/10 shadow-lg max-w-xs max-h-[90vh] overflow-y-auto">
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

				{/* ── Asset palette ─────────────────────────────────── */}
				<div class="mb-4">
					<div class="flex items-center justify-between mb-2">
						<label class="text-sm text-slate-300">Select an asset</label>
						<button
							type="button"
							onClick={() => { setShowLibrary(true); setLibrarySearch(""); setLibraryCategory(""); }}
							class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-500/60 border border-indigo-500/30 text-indigo-200 text-xs transition"
						>
							📚 Library
						</button>
					</div>

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

					{/* Empty-favorites hint */}
					<Show when={activePaletteTab() === "favoris" && userFavoritePaths().length === 0}>
						<div class="flex flex-col items-center gap-2 py-5 px-3 text-center">
							<span class="text-2xl">⭐</span>
							<p class="text-slate-400 text-xs leading-relaxed">
								Ouvrez la <button
									type="button"
									class="text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
									onClick={() => { setShowLibrary(true); setLibrarySearch(""); setLibraryCategory(""); }}
								>Library</button> and click ⭐ on an asset to add it here.
							</p>
						</div>
					</Show>

					<div class="space-y-2">
						<For each={visibleCategories()}>
							{(category) => {
								// Auto-expand when searching so the user doesn't have to
								// click every accordion header. Toggle works freely otherwise.
								const isExpanded = () =>
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
																// Click-again-to-deselect: clicking the same palette
																// asset a second time clears the selection and the
																// preview ghost.
																const already = selectedAsset()?.id === asset.id;
																cleanupPreviewMesh();
																setEditingAsset(null);
																setEditMode(false);
																setDeleteMode(false);
																setZoneSelectionMode(false);
																setLightMode(false);
																setSelectedAsset(already ? null : asset);
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

				{/* Rotation Control: keyboard (Q/D) + step buttons + slider */}
				{(selectedAsset() || editingAsset() || lightMode()) && (
					<div class="mb-4">
						<label class="block text-sm text-slate-300 mb-2">
							Rotation:{" "}
							<span class="text-game-gold font-mono">
								{rotationAngle()}°
							</span>
						</label>
						<div class="flex gap-2 mb-2">
							<button
								class="flex-1 px-3 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200 text-sm transition"
								onClick={() => setRotationAngle((prev) => (prev - 15 + 360) % 360)}
								title="Raccourci Q"
							>
								↺ −15°
							</button>
							<button
								class="flex-1 px-3 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200 text-sm transition"
								onClick={() => setRotationAngle(0)}
								title="Reset to 0°"
							>
								0°
							</button>
							<button
								class="flex-1 px-3 py-2 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200 text-sm transition"
								onClick={() => setRotationAngle((prev) => (prev + 15) % 360)}
								title="Raccourci D"
							>
								↻ +15°
							</button>
						</div>
						<input
							type="range"
							min="0"
							max="360"
							step="5"
							value={rotationAngle()}
							onInput={(e) =>
								setRotationAngle(parseInt(e.currentTarget.value, 10) % 360)
							}
							class="w-full accent-pink-500"
						/>
						<p class="mt-2 text-xs text-slate-400">
							Shortcuts Q / D. Rotation is applied to the preview
							and saved with the placed object.
						</p>
					</div>
				)}

				{/* ── Placement Mode ─────────────────────────────────── */}
				{(selectedAsset() || editingAsset()) && selectedAsset()?.type !== 'floor' && (
					<div class="mb-4">
						<label class="block text-sm text-slate-300 mb-2">Position dans la case</label>
						<div class="flex gap-1">
							{([
								{ mode: 'center' as PlacementMode, label: '⬛', title: 'Centre' },
								{ mode: 'edge'   as PlacementMode, label: '🧱', title: 'Bord (mur)' },
								{ mode: 'corner' as PlacementMode, label: '🏛️', title: 'Coin / pilier' },
							] as const).map(({ mode, label, title }) => (
								<button
									class={`flex-1 py-1.5 rounded-lg border text-sm transition ${
										placementMode() === mode
											? 'bg-purple-600/50 border-purple-400/60 text-white'
											: 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-black/50'
									}`}
									onClick={() => setPlacementMode(mode)}
									title={title}
								>
									{label} {title}
								</button>
							))}
						</div>
						<p class="mt-1.5 text-[10px] text-slate-500">
							{placementMode() === 'center' && 'Asset centered in the cell.'}
							{placementMode() === 'edge'   && 'Asset snapped to the edge based on its rotation - ideal for walls.'}
							{placementMode() === 'corner' && 'Asset in the corner nearest its rotation - ideal for pillars.'}
						</p>
					</div>
				)}

				{/* ── Working Height ─────────────────────────────────── */}
				{(selectedAsset() || editingAsset()) && selectedAsset()?.type !== 'floor' && (
					<div class="mb-4">
						<div class="flex items-center justify-between mb-2">
							<label class="text-sm text-slate-300">Hauteur de travail</label>
							<button
								onClick={() => setWorkingHeight('auto')}
								class={`text-xs px-2 py-0.5 rounded border transition ${
									workingHeight() === 'auto'
										? 'bg-emerald-600/40 border-emerald-500/50 text-emerald-300'
										: 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
								}`}
							>Auto</button>
						</div>

						<div class="flex items-center gap-2">
							<button
								class="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200 text-lg leading-none transition flex items-center justify-center"
								onClick={() => setWorkingHeight(prev => {
									const cur = prev === 'auto' ? 0 : prev;
									return Math.max(0, parseFloat((cur - 0.25).toFixed(2)));
								})}
							>−</button>

							<div class={`flex-1 text-center font-mono text-sm py-1 rounded-lg border ${
								workingHeight() === 'auto'
									? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400'
									: 'bg-black/30 border-white/10 text-white'
							}`}>
								{workingHeight() === 'auto' ? 'Auto ↑ pile' : `Y = ${(workingHeight() as number).toFixed(2)}`}
							</div>

							<button
								class="w-8 h-8 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200 text-lg leading-none transition flex items-center justify-center"
								onClick={() => setWorkingHeight(prev => {
									const cur = prev === 'auto' ? 0 : prev;
									return parseFloat((cur + 0.25).toFixed(2));
								})}
							>+</button>
						</div>

						<Show when={workingHeight() !== 'auto'}>
							<p class="mt-1.5 text-[10px] text-slate-500">
								The asset's base will be placed at Y = {(workingHeight() as number).toFixed(2)} — regardless of existing assets.
							</p>
						</Show>
					</div>
				)}

				{selectedAsset() && !deleteMode() && !editMode() && !zoneSelectionMode() && (
					<p class="mt-3 text-xs text-slate-400">
						Cliquez sur la grille pour placer: <strong>{selectedAsset()!.name}</strong>
					</p>
				)}
				{selectedAsset() && zoneSelectionMode() && (
					<p class="mt-3 text-xs text-purple-400">
						Zone mode: Click and drag to select a zone, then release to place <strong>{selectedAsset()!.name}</strong>
					</p>
				)}
				{editingAsset() && (
					<p class="mt-3 text-xs text-blue-400">
						Edit mode: Click on the grid to reposition <strong>{editingAsset()!.asset.name}</strong>
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
						{editMode() ? "Edit Mode Active" : "Edit Mode"}
					</button>
					{editMode() && (
						<p class="mt-2 text-xs text-slate-400">
							Click on an object to modify it, then place it at the new position
						</p>
					)}
					{editingAsset() && (
						<p class="mt-1 text-xs text-green-400">
							Editing: {editingAsset()!.asset.name}
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
						{deleteMode() ? "✕ Delete mode active" : "✕ Delete mode"}
					</button>
					{deleteMode() && (
						<p class="mt-2 text-xs text-slate-400">
							Click an object to delete it
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
						{zoneSelectionMode() ? "📐 Zone Mode Active" : "📐 Zone Selection Mode"}
					</button>
					{zoneSelectionMode() && (
						<div class="mt-2 text-xs text-slate-400 space-y-1">
							<p>Select a zone by clicking and dragging</p>
							<p>The asset will be placed on all cells in the zone</p>
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
						{collisionPreviewMode() ? "Collision mode active" : "Collision mode"}
					</button>
					{collisionPreviewMode() && (
						<div class="mt-2 text-xs text-slate-400 space-y-1">
							<p>Shows collisions for all cells</p>
							<p><span class="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" /> Green = Walkable zone</p>
							<p><span class="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" /> Yellow = Difficult terrain (high cost)</p>
							<p><span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" /> Red = Blocked zone (not walkable)</p>
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
						{lightMode() ? "💡 Light Mode Active" : "💡 Place a light"}
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
							Click on a cell to place the light. Use delete mode to remove an existing light.
						</p>
					</Show>
				</div>

				{/* ── Affichage grille ────────────────────────────── */}
				<div class="mb-3">
					<button
						class={`w-full px-4 py-2 rounded-lg text-sm transition ${
							showGrid()
								? "bg-teal-600/70 hover:bg-teal-600 text-white border border-teal-400/40"
								: "bg-black/40 hover:bg-black/60 border border-white/10 text-slate-200"
						}`}
						onClick={() => setShowGrid(v => !v)}
					>
						{showGrid() ? "⊞ Grid visible" : "⊟ Grid hidden"}
					</button>
				</div>

				{/* ── Export / Import ─────────────────────────────── */}
				<div class="flex gap-2 mb-2">
					<button
						class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-700/60 hover:bg-sky-600/80 border border-sky-500/30 text-sky-200 text-xs font-medium transition"
						onClick={exportCurrentMap}
						title="Download map as JSON"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
						</svg>
						Exporter
					</button>
					<button
						class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-700/60 hover:bg-violet-600/80 border border-violet-500/30 text-violet-200 text-xs font-medium transition"
						onClick={() => importFileInputRef?.click()}
						title="Importer une carte depuis un fichier JSON"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
						</svg>
						Importer
					</button>
					{/* Hidden file picker */}
					<input
						ref={importFileInputRef}
						type="file"
						accept=".json,.dndmap.json"
						class="hidden"
						onChange={(e) => {
							const file = e.currentTarget.files?.[0];
							if (file) handleImportFile(file);
							e.currentTarget.value = '';
						}}
					/>
				</div>

				{/* Import feedback toast */}
				<Show when={importStatus()}>
					{(s) => (
						<div class={`mb-2 px-3 py-2 rounded-lg text-xs font-medium ${
							s().type === 'ok'
								? 'bg-emerald-900/60 border border-emerald-500/40 text-emerald-300'
								: 'bg-red-900/60 border border-red-500/40 text-red-300'
						}`}>
							{s().type === 'ok' ? '✓ ' : '✕ '}{s().message}
						</div>
					)}
				</Show>

				{/* Indicateur de sauvegarde */}
				<Show when={saveStatus() !== null}>
					<p class={`text-xs text-center mb-2 ${
						saveStatus() === 'saved'   ? 'text-green-400' :
						saveStatus() === 'local'   ? 'text-amber-400' :
						'text-slate-500'
					}`}>
						{saveStatus() === 'saved'   ? '✓ Saved' :
						 saveStatus() === 'local'   ? '⚠ Saved locally only' :
						 '● Saving…'}
					</p>
				</Show>
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

			{/* ── Camera view controls — bottom-left ───────────────────────────── */}
			<div class="absolute bottom-4 left-4 z-20 flex gap-2">
				<button
					onClick={switchToTopView}
					title="Vue du dessus"
					class={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border backdrop-blur-sm shadow-lg transition ${
						cameraMode() === 'top'
							? 'bg-indigo-600/70 border-indigo-400/50 text-white'
							: 'bg-black/60 border-white/10 text-slate-300 hover:bg-black/80 hover:text-white'
					}`}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
					</svg>
					Dessus
				</button>
				<button
					onClick={switchToFreeView}
					title="Vue libre (perspective)"
					class={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border backdrop-blur-sm shadow-lg transition ${
						cameraMode() === 'free'
							? 'bg-indigo-600/70 border-indigo-400/50 text-white'
							: 'bg-black/60 border-white/10 text-slate-300 hover:bg-black/80 hover:text-white'
					}`}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M1 6l11 6 11-6"/><path d="M1 12l11 6 11-6"/>
					</svg>
					Libre
				</button>
			</div>

			{/* CSS rubber-band selection rectangle — shown while dragging in zone selection mode */}
			<Show when={rubberBandRect()}>
				{(r) => (
					<div
						class="absolute pointer-events-none border-2 border-blue-400 bg-blue-400/10 rounded-sm"
						style={{
							left: `${r().left}px`,
							top: `${r().top}px`,
							width: `${r().width}px`,
							height: `${r().height}px`,
							"z-index": "40",
						}}
					/>
				)}
			</Show>

			{/* ═══════════════════════════════════════════════════════════
			    Library modal — full-screen asset browser
			    ═══════════════════════════════════════════════════════════ */}
			<Show when={showLibrary()}>
				<Portal mount={document.body}>
					<div
						class="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4"
						onClick={(e) => { if (e.target === e.currentTarget) setShowLibrary(false); }}
					>
						<div class="bg-[#0c1422] border border-white/10 rounded-2xl shadow-2xl w-[820px] max-w-[95vw] flex flex-col overflow-hidden"
							style={{ "max-height": "88vh" }}>

							{/* Header */}
							<div class="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
								<span class="text-xl">📚</span>
								<div class="flex-1">
									<h2 class="text-white font-display text-lg leading-tight">Asset Library</h2>
									<p class="text-slate-500 text-xs mt-0.5">Select an asset to place on the map</p>
								</div>
								<button
									onClick={() => setShowLibrary(false)}
									class="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-slate-400 text-sm transition"
								>✕</button>
							</div>

							{/* Search */}
							<div class="px-5 py-3 border-b border-white/10 shrink-0">
								<input
									type="text"
									placeholder="🔍  Search an asset… (shows first 10 results)"
									value={librarySearch()}
									onInput={(e) => setLibrarySearch(e.currentTarget.value)}
									class="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition"
								/>
							</div>

							{/* Body */}
							<div class="flex flex-1 overflow-hidden">

								{/* Category sidebar */}
								<div class="w-44 shrink-0 border-r border-white/10 overflow-y-auto p-2 space-y-0.5">
									<button
										onClick={() => { setLibraryCategory(''); setLibrarySearch(''); }}
										class={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
											libraryCategory() === '' && !librarySearch()
												? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/30'
												: 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
										}`}
									>
										All categories
									</button>
									<For each={ASSET_CATEGORIES}>
										{(cat) => (
											<button
												onClick={() => { setLibraryCategory(cat.id); setLibrarySearch(''); }}
												class={`w-full text-left px-3 py-2 rounded-lg text-sm transition truncate ${
													libraryCategory() === cat.id && !librarySearch()
														? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/30'
														: 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
												}`}
												title={cat.name}
											>
												{cat.name}
											</button>
										)}
									</For>
								</div>

								{/* Asset grid */}
								<div class="flex-1 overflow-y-auto p-4">

									{/* Search results */}
									<Show when={librarySearch().trim().length > 0}>
										<p class="text-xs text-slate-500 mb-3">
											{ALL_ASSETS.filter(a => a.name.toLowerCase().includes(librarySearch().toLowerCase().trim())).slice(0, 10).length} result{ALL_ASSETS.filter(a => a.name.toLowerCase().includes(librarySearch().toLowerCase().trim())).slice(0, 10).length !== 1 ? 's' : ''} for "{librarySearch().trim()}"
										</p>
										<Show when={ALL_ASSETS.filter(a => a.name.toLowerCase().includes(librarySearch().toLowerCase().trim())).length === 0}>
											<p class="text-slate-600 text-sm text-center py-8">No assets found.</p>
										</Show>
										<div class="grid grid-cols-3 gap-2">
											<For each={ALL_ASSETS.filter(a => a.name.toLowerCase().includes(librarySearch().toLowerCase().trim())).slice(0, 10)}>
												{(asset) => (
													<div
														class={`relative rounded-xl border transition text-xs cursor-pointer ${
															selectedAsset()?.id === asset.id
																? 'bg-indigo-600/50 border-indigo-400/50 text-white'
																: 'bg-black/30 border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20'
														}`}
														onClick={() => {
															cleanupPreviewMesh();
															setSelectedAsset(asset);
															setEditingAsset(null);
															setEditMode(false);
															setDeleteMode(false);
															setZoneSelectionMode(false);
															setShowLibrary(false);
														}}
													>
														<div class="px-3 pt-2.5 pb-6">
															<div class="font-medium truncate mb-0.5">{asset.name}</div>
															<div class="text-[10px] opacity-50 uppercase tracking-wide">{asset.type}</div>
														</div>
														<button
															type="button"
															title={isFavorite(asset.path) ? "Retirer des favoris" : "Ajouter aux favoris"}
															onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.path); }}
															class={`absolute bottom-1.5 right-1.5 text-sm leading-none transition hover:scale-110 ${
																isFavorite(asset.path) ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'
															}`}
														>
															{isFavorite(asset.path) ? '★' : '☆'}
														</button>
													</div>
												)}
											</For>
										</div>
									</Show>

									{/* Category browse */}
									<Show when={librarySearch().trim().length === 0}>
										<For each={ASSET_CATEGORIES.filter(c => !libraryCategory() || c.id === libraryCategory())}>
											{(cat) => (
												<div class="mb-6">
													<h3 class="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
														<span class="flex-1">{cat.name}</span>
														<span class="text-slate-600 normal-case font-normal">{cat.assets.length} assets</span>
													</h3>
													<div class="grid grid-cols-3 gap-2">
														<For each={cat.assets}>
															{(asset) => (
																<div
																	class={`relative rounded-xl border transition text-xs cursor-pointer ${
																		selectedAsset()?.id === asset.id
																			? 'bg-indigo-600/50 border-indigo-400/50 text-white'
																			: 'bg-black/30 border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20'
																	}}`}
																	onClick={() => {
																		cleanupPreviewMesh();
																		setSelectedAsset(asset);
																		setEditingAsset(null);
																		setEditMode(false);
																		setDeleteMode(false);
																		setZoneSelectionMode(false);
																		setShowLibrary(false);
																	}}
																>
																	<div class="px-3 pt-2.5 pb-6">
																		<div class="font-medium truncate mb-0.5">{asset.name}</div>
																		<div class="text-[10px] opacity-50 uppercase tracking-wide">{asset.type}</div>
																	</div>
																	<button
																		type="button"
																		title={isFavorite(asset.path) ? "Retirer des favoris" : "Ajouter aux favoris"}
																		onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.path); }}
																		class={`absolute bottom-1.5 right-1.5 text-sm leading-none transition hover:scale-110 ${
																			isFavorite(asset.path) ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'
																		}}`}
																	>
																		{isFavorite(asset.path) ? '★' : '☆'}
																	</button>
																</div>
															)}
														</For>
													</div>
												</div>
											)}
										</For>
									</Show>

								</div>
							</div>
						</div>
					</div>
				</Portal>
			</Show>

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
								Place ally cell
							</button>
							<button
								class="w-full text-left px-4 py-2 rounded hover:bg-red-600/20 text-red-400 text-sm transition flex items-center gap-2"
								onClick={() => handleSetSpawnZone("enemy")}
							>
								<div class="w-3 h-3 rounded-full bg-red-500"></div>
								Place enemy cell
							</button>
							<button
								class="w-full text-left px-4 py-2 rounded hover:bg-purple-600/20 text-purple-400 text-sm transition flex items-center gap-2"
								onClick={() => handleSetSpawnZone("teleport")}
							>
								<div class="w-3 h-3 rounded-full bg-purple-500"></div>
								Place teleportation cell
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
