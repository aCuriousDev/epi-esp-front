import { Component, onMount, onCleanup, createSignal, For, Show, createEffect } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-solid";
import { saveMap, loadMap, generateMapId, type SavedMapData, type SavedCellData, type SavedAssetData } from "../services/mapStorage";
import {
	Engine,
	Scene,
	ArcRotateCamera,
	HemisphericLight,
	Vector3,
	Mesh,
	AbstractMesh,
	Color3,
	Color4,
	StandardMaterial,
	PointerEventTypes,
	MeshBuilder,
	TransformNode,
	BoundingInfo,
} from "@babylonjs/core";
import { ModelLoader } from "../engine/ModelLoader";
import { gridToWorld, GRID_SIZE, TILE_SIZE } from "../game";
import { ASSET_PACKS } from "../config/assetPacks";
import { getCollisionProperties, doesAssetBlockMovement } from "../game/utils/CollisionUtils";
import "@babylonjs/loaders";

interface MapAsset {
	id: string;
	name: string;
	path: string;
	type: "floor" | "wall" | "block" | "water" | "character" | "enemy" | "nature" | "furniture" | "decoration" | "resource";
	icon?: string;
}

interface AssetCategory {
	id: string;
	name: string;
	assets: MapAsset[];
}

/**
 * Représente un asset placé dans une cellule
 */
interface StackedAsset {
	mesh: AbstractMesh;
	asset: MapAsset;
	height: number; // Hauteur réelle calculée depuis bounding box
	bottomY: number; // Position Y du bas du mesh (dans l'espace local de la cellule)
	topY: number; // Position Y du haut du mesh (dans l'espace local de la cellule)
}

/**
 * Classe représentant une cellule de la grille avec ses données
 * Totalement découplée du visuel, data-driven
 */
class GridCell {
	public readonly x: number;
	public readonly z: number;
	private groundMesh: Mesh | null = null;
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
		}
	}

	/**
	 * Obtient le mesh de sol
	 */
	public getGround(): Mesh | null {
		return this.groundMesh;
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
	 * Retourne 0 si aucun asset n'est empilé
	 */
	public getStackHeight(): number {
		if (this.stackedAssets.length === 0) return 0;
		const topAsset = this.stackedAssets[this.stackedAssets.length - 1];
		return topAsset.topY;
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
	 */
	public exportData(): { x: number; z: number; ground?: any; stackedAssets: any[] } {
		const stackedAssets = this.stackedAssets.map(sa => {
			const metadata = sa.mesh.metadata as any;
			return {
				assetId: metadata?.assetId || sa.asset.id,
				assetPath: metadata?.assetPath || sa.asset.path,
				assetType: metadata?.assetType || sa.asset.type,
				scale: sa.mesh.scaling.x, // Assume uniform scaling
				rotationY: sa.mesh.rotation.y,
				positionY: sa.mesh.position.y,
			};
		});

		let ground = undefined;
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
	 */
	public exportData(): Array<{ x: number; z: number; ground?: any; stackedAssets: any[] }> {
		const cellsData: Array<{ x: number; z: number; ground?: any; stackedAssets: any[] }> = [];
		this.cells.forEach(cell => {
			const cellData = cell.exportData();
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
		
		console.log(`Created StackedAsset: ${asset.name} - bottomY: ${bottomY.toFixed(3)}, topY: ${topY.toFixed(3)}, height: ${height.toFixed(3)}`);
		
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
		
		console.log(`Positioning ${mesh.name}: currentBottom=${currentWorldBottomY.toFixed(3)}, targetBottom=${targetWorldBottomY.toFixed(3)}, offset=${offsetY.toFixed(3)}`);
		
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
		console.log(`Placing on stack at height: ${stackHeight.toFixed(3)}`);
		this.positionMeshAtHeight(mesh, stackHeight, 0);
	}
}

// Helper function to create asset from file path
const createAssetFromPath = (
	basePath: string,
	fileName: string,
	type: MapAsset["type"],
	displayName?: string
): MapAsset => {
	const id = fileName.replace(/\.(gltf|glb)$/i, "").toLowerCase().replace(/[^a-z0-9]/g, "_");
	const name = displayName || fileName
		.replace(/\.(gltf|glb)$/i, "")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (l) => l.toUpperCase());
	return {
		id,
		name,
		path: `${basePath}/${fileName}`,
		type,
	};
};

// Helper function to create assets from file list
const createAssetsFromFiles = (
	basePath: string,
	files: string[],
	type: MapAsset["type"]
): MapAsset[] => {
	return files.map((file) => createAssetFromPath(basePath, file, type));
};

// Helper function to extract folder name from base path
const extractFolderNameFromPath = (basePath: string): string => {
	const match = basePath.match(/\/packages\/([^\/]+)/);
	return match ? match[1] : basePath;
};

// Helper function to create category with automatic name from base path
const createCategory = (
	basePath: string,
	files: string[],
	type: MapAsset["type"]
): AssetCategory => {
	const folderName = extractFolderNameFromPath(basePath);
	const assets = createAssetsFromFiles(basePath, files, type);
	return {
		id: folderName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
		name: folderName,
		assets,
	};
};

// Characters
const CHARACTER_ASSETS: MapAsset[] = [
	{ id: "knight", name: "Chevalier", path: "/models/characters/knight/knight.glb", type: "character" },
	{ id: "rogue", name: "Voleur", path: "/models/characters/rogue/rogue.glb", type: "character" },
	{ id: "wizard", name: "Magicien", path: "/models/characters/wizard/wizard.glb", type: "character" },
];

// Enemies
const ENEMY_ASSETS: MapAsset[] = [
	{ id: "skeleton_warrior", name: "Squelette Guerrier", path: "/models/enemies/skeleton_warrior/skeleton_warrior.glb", type: "enemy" },
	{ id: "skeleton_mage", name: "Squelette Mage", path: "/models/enemies/skeleton_mage/skeleton_mage.glb", type: "enemy" },
	{ id: "skeleton_rogue", name: "Squelette Voleur", path: "/models/enemies/skeleton_rogue/skeleton_rogue.glb", type: "enemy" },
];

// Asset Categories - Grouped by catName from config file
const ASSET_CATEGORIES: AssetCategory[] = (() => {
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
			id: catName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
			name: catName,
			assets,
		});
	});
	
	categories.push({ id: "enemies", name: "Enemies", assets: ENEMY_ASSETS });
	categories.push({ id: "characters", name: "Characters", assets: CHARACTER_ASSETS });
	
	return categories;
})();

export default function MapEditor() {
	const params = useParams<{ mapId?: string }>();
	
	let canvasRef!: HTMLCanvasElement;
	let engine: Engine | null = null;
	let scene: Scene | null = null;
	let camera: ArcRotateCamera | null = null;
	let modelLoader: ModelLoader | null = null;
	let gridManager: GridManager | null = null;
	let assetStackManager: AssetStackManager | null = null;
	
	const [mapId, setMapId] = createSignal<string | null>(null);
	const [mapName, setMapName] = createSignal<string>("Nouvelle Map");
	const [selectedAsset, setSelectedAsset] = createSignal<MapAsset | null>(null);
	const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set());
	const [rotationAngle, setRotationAngle] = createSignal(0);
	const [deleteMode, setDeleteMode] = createSignal(false);
	const [editMode, setEditMode] = createSignal(false);
	const [editingAsset, setEditingAsset] = createSignal<{ asset: MapAsset; cell: GridCell; mesh: AbstractMesh } | null>(null);
	const [isLoading, setIsLoading] = createSignal(false);
	const [showCollisions, setShowCollisions] = createSignal(false);
	const [collisionPreviewMode, setCollisionPreviewMode] = createSignal(false);
	const [selectedCollisionAsset, setSelectedCollisionAsset] = createSignal<{ asset: MapAsset; cell: GridCell; mesh: AbstractMesh } | null>(null);
	
	let previewMesh: AbstractMesh | null = null;
	let previewUpdateTimeout: number | null = null;
	let isUpdatingPreview: boolean = false; // Flag pour éviter les mises à jour multiples simultanées
	let collisionOverlays: Map<string, Mesh> = new Map(); // Map des overlays de collision par cellule
	let collisionPreviewOverlay: Mesh | null = null; // Overlay pour la prévisualisation de collision d'un asset
	let originalAssetAlpha: Map<AbstractMesh, number> = new Map(); // Sauvegarde de l'alpha original des assets

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

		try {
			const cellsData = gridManager.exportData();
			const mapData: SavedMapData = {
				id: mapId()!,
				name,
				createdAt: loadMap(mapId()!)?.createdAt || Date.now(),
				updatedAt: Date.now(),
				cells: cellsData,
			};

			saveMap(mapData);
			alert("Map sauvegardée avec succès !");
		} catch (error) {
			console.error("Error saving map:", error);
			alert("Erreur lors de la sauvegarde de la map");
		}
	};

	onMount(() => {
		if (!canvasRef) return;

		// Initialize map ID and name from params
		const paramMapId = params.mapId;
		if (paramMapId === "new") {
			// Nouvelle map
			const newId = generateMapId();
			setMapId(newId);
			setMapName("Nouvelle Map");
		} else if (paramMapId) {
			// Charger une map existante
			setMapId(paramMapId);
			const savedMap = loadMap(paramMapId);
			if (savedMap) {
				setMapName(savedMap.name);
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

		// Setup lighting
		const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
		light.intensity = 0.8;

		// Initialize model loader
		modelLoader = new ModelLoader(scene);
		
		// Initialize grid manager and asset stack manager
		gridManager = new GridManager(scene);
		assetStackManager = new AssetStackManager(scene, modelLoader);

		// Create grid visualization
		createGrid();

		// Setup handlers
		setupClickHandler();
		setupWheelZoom();
		setupPreviewMesh();
		
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
	const cleanupPreviewMesh = async () => {
		// Annuler le timeout en cours
		if (previewUpdateTimeout !== null) {
			clearTimeout(previewUpdateTimeout);
			previewUpdateTimeout = null;
		}

		// Attendre que la mise à jour en cours soit terminée
		while (isUpdatingPreview) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		if (previewMesh) {
			const meshToClean = previewMesh;
			previewMesh = null;
			
			const allDescendants = meshToClean.getDescendants(false);
			const meshScene = meshToClean.getScene();
			
			if (meshScene) {
				// Nettoyer tous les descendants
				allDescendants.forEach((node) => {
					if (node instanceof AbstractMesh || node instanceof Mesh) {
						try {
							if (!(node as AbstractMesh).isDisposed()) {
								meshScene.removeMesh(node as AbstractMesh);
								(node as AbstractMesh).dispose();
							}
						} catch (e) {
							// Ignorer les erreurs de disposal
						}
					}
				});
				try {
					if (!meshToClean.isDisposed()) {
						meshScene.removeMesh(meshToClean);
						meshToClean.dispose();
					}
				} catch (e) {
					// Ignorer les erreurs de disposal
				}
			}
		}
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

		if (!showCollisions() && !collisionPreviewMode()) return;

		// Create overlays for all cells
		gridManager.getAllCells().forEach((cell) => {
			const collisionProps = cell.getCollisionProperties();
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
				alpha = 0.4;
			} else if (collisionProps.movementCost > 1) {
				// Yellow for difficult terrain
				color = new Color3(1, 1, 0);
				emissive = new Color3(0.5, 0.5, 0);
				alpha = 0.3;
			} else {
				// Green for walkable cells
				color = new Color3(0, 1, 0);
				emissive = new Color3(0, 0.5, 0);
				alpha = 0.25;
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

		// Make the asset transparent
		const setAlpha = (mesh: AbstractMesh, alpha: number) => {
			if (mesh.material) {
				const material = mesh.material as StandardMaterial;
				if (!originalAssetAlpha.has(mesh)) {
					originalAssetAlpha.set(mesh, material.alpha);
				}
				material.alpha = alpha;
			}
			mesh.getChildMeshes(false).forEach((child) => {
				setAlpha(child, alpha);
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
		// Restore original alpha for all meshes
		originalAssetAlpha.forEach((alpha, mesh) => {
			if (!mesh.isDisposed() && mesh.material) {
				(mesh.material as StandardMaterial).alpha = alpha;
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
		}
	});

	// Effect to clear collision preview when mode changes
	createEffect(() => {
		if (!collisionPreviewMode()) {
			clearCollisionPreview();
		}
	});

	// Setup preview mesh
	const setupPreviewMesh = () => {
		if (!scene || !camera || !gridManager || !assetStackManager) return;

		scene.onPointerObservable.add((pointerInfo) => {
			if (pointerInfo.type === PointerEventTypes.POINTERMOVE && (selectedAsset() || editingAsset()) && !deleteMode() && !collisionPreviewMode() && scene) {
				if (previewUpdateTimeout !== null) {
					clearTimeout(previewUpdateTimeout);
					previewUpdateTimeout = null;
				}
				
				previewUpdateTimeout = window.setTimeout(async () => {
					if (!scene || !gridManager || !assetStackManager || isUpdatingPreview) {
						previewUpdateTimeout = null;
						return;
					}
					
					const currentAsset = selectedAsset() || editingAsset()?.asset;
					if (!currentAsset) {
						await cleanupPreviewMesh();
						previewUpdateTimeout = null;
						return;
					}
					
					const pickInfo = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
						// Permettre seulement les cellPlanes pour le preview
						return mesh.name.startsWith("cellPlane_") && 
						       !mesh.name.startsWith("preview_") &&
						       !mesh.metadata?.isPreview;
					});

					if (pickInfo?.hit && pickInfo.pickedPoint) {
						const worldX = pickInfo.pickedPoint.x;
						const worldZ = pickInfo.pickedPoint.z;
						const gridX = Math.floor((worldX / TILE_SIZE) + (GRID_SIZE / 2) - 0.5);
						const gridZ = Math.floor((worldZ / TILE_SIZE) + (GRID_SIZE / 2) - 0.5);

						if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
							const cell = gridManager.getCell(gridX, gridZ);
							if (cell) {
								await updatePreviewMesh(currentAsset, cell);
							}
						}
					}
					previewUpdateTimeout = null;
				}, 50); // Augmenté à 50ms pour réduire les appels multiples
			} else if ((!selectedAsset() && !editingAsset()) || deleteMode() || collisionPreviewMode()) {
				if (previewUpdateTimeout !== null) {
					clearTimeout(previewUpdateTimeout);
					previewUpdateTimeout = null;
				}
				cleanupPreviewMesh();
			}
		});
	};

	// Update preview mesh
	const updatePreviewMesh = async (asset: MapAsset, cell: GridCell) => {
		if (!scene || !assetStackManager || isUpdatingPreview) return;

		isUpdatingPreview = true;

		try {
			// Nettoyer le preview précédent de manière synchrone
			if (previewMesh) {
				const meshToClean = previewMesh;
				previewMesh = null;
				
				const allDescendants = meshToClean.getDescendants(false);
				const meshScene = meshToClean.getScene();
				
				if (meshScene) {
					allDescendants.forEach((node) => {
						if (node instanceof AbstractMesh || node instanceof Mesh) {
							try {
								if (!(node as AbstractMesh).isDisposed()) {
									meshScene.removeMesh(node as AbstractMesh);
									(node as AbstractMesh).dispose();
								}
							} catch (e) {}
						}
					});
					try {
						if (!meshToClean.isDisposed()) {
							meshScene.removeMesh(meshToClean);
							meshToClean.dispose();
						}
					} catch (e) {}
				}
			}

			// Attendre un peu pour s'assurer que le cleanup est terminé
			await new Promise(resolve => setTimeout(resolve, 10));

			const uniqueName = `preview_${asset.id}_${Date.now()}`;
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
				const euler = mesh.rotationQuaternion.toEulerAngles();
				mesh.rotationQuaternion = null;
				mesh.rotation.y = euler.y + rotationRad;
			} else {
				mesh.rotation.y = rotationRad;
			}

			// 3. Parenter à la cellule
			const cellNode = cell.getCellNode();
			if (cellNode) {
				mesh.parent = cellNode;
				
				// 4. Initialiser la position au centre de la cellule
				mesh.position.set(0, 0, 0);
				
				// 5. Forcer le recalcul des matrices world après le parenting
				mesh.computeWorldMatrix(true);
				mesh.getChildMeshes(false).forEach(child => child.computeWorldMatrix(true));
				
				// 6. Positionner correctement en Y
				if (asset.type === "floor") {
					// Pour les sols, positionner à y=0
					assetStackManager.positionMeshAtHeight(mesh, 0, 0);
				} else {
					// Positionner au-dessus de la pile existante
					assetStackManager.positionMeshOnStack(mesh, cell);
				}
			}

			// Make preview semi-transparent
			const setAlpha = (m: AbstractMesh) => {
				if (m.material) {
					(m.material as StandardMaterial).alpha = 0.6;
				}
				m.getChildMeshes().forEach((child) => setAlpha(child));
			};
			setAlpha(mesh);

			mesh.isPickable = false;
			mesh.getChildMeshes().forEach((child) => { child.isPickable = false; });
			mesh.renderingGroupId = 1;
			mesh.getChildMeshes().forEach((child) => {
				if ('renderingGroupId' in child) {
					(child as any).renderingGroupId = 1;
				}
			});
			mesh.metadata = { isPreview: true };
			mesh.getChildMeshes().forEach((child) => {
				child.metadata = { isPreview: true };
			});

			previewMesh = mesh;
		} catch (error) {
			console.warn(`Failed to load preview for ${asset.name}:`, error);
		} finally {
			isUpdatingPreview = false;
		}
	};

	// Place asset
	const placeAsset = async (asset: MapAsset, gridX: number, gridZ: number) => {
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
			} else {
				// Pour les autres assets, les empiler
				// Positionner au-dessus de la pile existante
				assetStackManager.positionMeshOnStack(mesh, cell);
				
				// Créer le StackedAsset et l'ajouter à la pile
				const stackedAsset = assetStackManager.createStackedAsset(mesh, asset, 0);
				cell.addAsset(stackedAsset);
			}

			// 6. Calculer toutes les cellules affectées par cet asset (basé sur le bounding box)
			const bounds = assetStackManager.getCombinedWorldBoundsFull(mesh);
			if (bounds) {
				// Convertir le bounding box world en cellules de grille
				const halfSize = (GRID_SIZE * TILE_SIZE) / 2;
				const minGridX = Math.max(0, Math.floor((bounds.minX + halfSize) / TILE_SIZE));
				const maxGridX = Math.min(GRID_SIZE - 1, Math.floor((bounds.maxX + halfSize) / TILE_SIZE));
				const minGridZ = Math.max(0, Math.floor((bounds.minZ + halfSize) / TILE_SIZE));
				const maxGridZ = Math.min(GRID_SIZE - 1, Math.floor((bounds.maxZ + halfSize) / TILE_SIZE));

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

	// Setup click handler
	const setupClickHandler = () => {
		if (!scene || !camera || !gridManager) return;

		scene.onPointerObservable.add((pointerInfo) => {
			if (pointerInfo.type === PointerEventTypes.POINTERDOWN && scene) {
				// Filtrer pour ne sélectionner que les cellPlanes ou le ground
				const pickInfo = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
					// Permettre les cellPlanes
					if (mesh.name.startsWith("cellPlane_")) return true;
					// Permettre le ground seulement si pas d'asset sélectionné (fallback)
					if (mesh.name === "ground" && !selectedAsset() && !editingAsset()) return true;
					// Exclure les preview meshes et les overlays de collision
					if (mesh.name.startsWith("preview_") || 
					    mesh.name.startsWith("collision_") ||
					    mesh.metadata?.isPreview) return false;
					return false;
				});

				if (deleteMode()) {
					// Delete mode: find and remove clicked mesh
					if (pickInfo?.hit && pickInfo.pickedMesh && gridManager) {
						let deletedMesh: AbstractMesh | null = null;
						const meshToDelete = pickInfo.pickedMesh;
						
						// Chercher dans toutes les cellules
						gridManager.getAllCells().forEach((cell) => {
							const stackedAssets = cell.getStackedAssets();
							stackedAssets.forEach((stackedAsset) => {
								if (stackedAsset.mesh === meshToDelete || 
								    stackedAsset.mesh.getChildMeshes(true).includes(meshToDelete as AbstractMesh)) {
									deletedMesh = stackedAsset.mesh;
									cell.removeAsset(stackedAsset.mesh);
									stackedAsset.mesh.dispose();
								}
							});
							
							const ground = cell.getGround();
							if (ground === meshToDelete || 
							    ground?.getChildMeshes(true).includes(meshToDelete as AbstractMesh)) {
								deletedMesh = ground;
								ground?.dispose();
								cell.setGround(null);
							}
						});
						
						// Nettoyer l'enregistrement de l'asset supprimé
						if (deletedMesh) {
							const meshName = (deletedMesh as AbstractMesh).name;
							if (meshName) {
								gridManager.unregisterAsset(meshName);
							}
						}
						
						// Update collision overlays if enabled
						if (showCollisions() || collisionPreviewMode()) {
							updateCollisionOverlays();
						}
					}
					return;
				}

				// Collision preview mode: collisions are shown on all cells via updateCollisionOverlays
				// No need to handle clicks in this mode
				if (collisionPreviewMode()) {
					return;
				}

				if (editMode()) {
					// Edit mode: select mesh for repositioning
					if (pickInfo?.hit && pickInfo.pickedMesh && gridManager) {
						gridManager.getAllCells().forEach((cell) => {
							const stackedAssets = cell.getStackedAssets();
							stackedAssets.forEach((stackedAsset) => {
								if (stackedAsset.mesh === pickInfo.pickedMesh || 
								    stackedAsset.mesh.getChildMeshes(true).includes(pickInfo.pickedMesh as AbstractMesh)) {
									setEditingAsset({ asset: stackedAsset.asset, cell, mesh: stackedAsset.mesh });
									setSelectedAsset(stackedAsset.asset);
									setRotationAngle(0);
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

				// Normal placement mode
				const assetToPlace = selectedAsset() || editingAsset()?.asset;
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

	// Clear map
	const clearMap = () => {
		cleanupPreviewMesh();
		clearCollisionPreview();
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

			{/* Toolbar */}
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
					<div class="space-y-2">
						<For each={ASSET_CATEGORIES}>
							{(category) => {
								const isExpanded = () => expandedCategories().has(category.id);
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
											<span>{category.name}</span>
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

				{/* Edit Mode Toggle */}
				<div class="mb-4">
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
								setSelectedAsset(null);
								setEditingAsset(null);
							} else {
								setEditingAsset(null);
							}
						}}
					>
						{editMode() ? "✏️ Mode Édition Actif" : "✏️ Mode Édition"}
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
				<div class="mb-4">
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
								setSelectedAsset(null);
								setEditingAsset(null);
								setShowCollisions(false);
								// Update overlays when mode is activated
								if (scene && gridManager) {
									updateCollisionOverlays();
								}
							}
						}}
					>
						{collisionPreviewMode() ? "🔴 Mode Collision Actif" : "⚪ Mode Collision"}
					</button>
					{collisionPreviewMode() && (
						<div class="mt-2 text-xs text-slate-400 space-y-1">
							<p>Affiche les collisions de toutes les cellules</p>
							<p>🟢 Vert = Zone walkable (marchable)</p>
							<p>🟡 Jaune = Terrain difficile (coût élevé)</p>
							<p>🔴 Rouge = Zone bloquée (non walkable)</p>
						</div>
					)}
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

				{selectedAsset() && !deleteMode() && !editMode() && (
					<p class="mt-3 text-xs text-slate-400">
						Cliquez sur la grille pour placer: <strong>{selectedAsset()!.name}</strong>
					</p>
				)}
				{editingAsset() && (
					<p class="mt-3 text-xs text-blue-400">
						Mode édition: Cliquez sur la grille pour replacer <strong>{editingAsset()!.asset.name}</strong>
					</p>
				)}
			</div>

			{/* Canvas */}
			<canvas
				ref={canvasRef}
				class="w-full h-full"
				style={{ width: "100%", height: "100vh" }}
			/>
		</div>
	);
}
