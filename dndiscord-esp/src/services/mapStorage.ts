/**
 * Service de stockage des maps en localStorage
 */

export type SpawnZoneType = "ally" | "enemy" | "teleport";

export interface SavedMapData {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	cells: SavedCellData[];
	/** Zones de spawn pour les combats : Key: "x,z", Value: "ally" | "enemy" | "teleport" */
	spawnZones?: Record<string, SpawnZoneType>;
	/** Type de map : classique (standalone) ou salle de donjon */
	mapType?: "classique" | "dungeon-room";
	/** ID du donjon parent (si mapType === "dungeon-room") */
	dungeonId?: string;
	/** Index de la salle dans le donjon (0-based) */
	roomIndex?: number;
}

export interface DungeonData {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	roomIds: string[];
	totalRooms: number;
}

export interface SavedCellData {
	x: number;
	z: number;
	ground?: SavedAssetData;
	stackedAssets: SavedAssetData[];
}

export interface SavedAssetData {
	assetId: string;
	assetPath: string;
	assetType: string;
	scale: number;
	rotationY: number;
	positionY: number;
	/** Cases affectées par cet asset (pour les assets multi-cases, ex: crypte, grande table) */
	affectedCells?: { x: number; z: number }[];
}

const STORAGE_KEY = "dndiscord_maps";
const MAP_METADATA_KEY = "dndiscord_maps_metadata";
const DUNGEON_STORAGE_KEY = "dndiscord_dungeons";
const DUNGEON_METADATA_KEY = "dndiscord_dungeons_metadata";

/**
 * Obtient toutes les maps sauvegardées (métadonnées seulement)
 */
export function getAllMaps(): Array<{ id: string; name: string; createdAt: number; updatedAt: number }> {
	try {
		const data = localStorage.getItem(MAP_METADATA_KEY);
		if (!data) return [];
		return JSON.parse(data);
	} catch (error) {
		console.error("Error loading maps metadata:", error);
		return [];
	}
}

/**
 * Sauvegarde les métadonnées d'une map
 */
function saveMapMetadata(id: string, name: string, updatedAt: number): void {
	try {
		const allMaps = getAllMaps();
		const existingIndex = allMaps.findIndex(m => m.id === id);
		
		if (existingIndex >= 0) {
			// Mettre à jour
			allMaps[existingIndex].name = name;
			allMaps[existingIndex].updatedAt = updatedAt;
		} else {
			// Nouvelle map
			allMaps.push({
				id,
				name,
				createdAt: Date.now(),
				updatedAt,
			});
		}
		
		localStorage.setItem(MAP_METADATA_KEY, JSON.stringify(allMaps));
	} catch (error) {
		console.error("Error saving map metadata:", error);
	}
}

/**
 * Charge une map complète par son ID
 */
export function loadMap(mapId: string): SavedMapData | null {
	try {
		const data = localStorage.getItem(`${STORAGE_KEY}_${mapId}`);
		if (!data) return null;
		return JSON.parse(data);
	} catch (error) {
		console.error(`Error loading map ${mapId}:`, error);
		return null;
	}
}

/**
 * Sauvegarde une map complète
 */
export function saveMap(mapData: SavedMapData): void {
	try {
		// Sauvegarder les métadonnées
		saveMapMetadata(mapData.id, mapData.name, mapData.updatedAt);
		
		// Sauvegarder les données complètes
		localStorage.setItem(`${STORAGE_KEY}_${mapData.id}`, JSON.stringify(mapData));
	} catch (error) {
		console.error(`Error saving map ${mapData.id}:`, error);
		throw error;
	}
}

/**
 * Supprime une map
 */
export function deleteMap(mapId: string): void {
	try {
		// Supprimer les métadonnées
		const allMaps = getAllMaps();
		const filtered = allMaps.filter(m => m.id !== mapId);
		localStorage.setItem(MAP_METADATA_KEY, JSON.stringify(filtered));
		
		// Supprimer les données complètes
		localStorage.removeItem(`${STORAGE_KEY}_${mapId}`);
	} catch (error) {
		console.error(`Error deleting map ${mapId}:`, error);
	}
}

/**
 * Génère un ID unique pour une nouvelle map
 */
export function generateMapId(): string {
	return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Génère un ID unique pour un nouveau donjon
 */
export function generateDungeonId(): string {
	return `dungeon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// DUNGEON STORAGE
// ============================================

/**
 * Obtient tous les donjons sauvegardés (métadonnées seulement)
 */
export function getAllDungeons(): Array<{ id: string; name: string; totalRooms: number; createdAt: number; updatedAt: number }> {
	try {
		const data = localStorage.getItem(DUNGEON_METADATA_KEY);
		if (!data) return [];
		return JSON.parse(data);
	} catch (error) {
		console.error("Error loading dungeons metadata:", error);
		return [];
	}
}

/**
 * Sauvegarde les métadonnées d'un donjon
 */
function saveDungeonMetadata(dungeon: DungeonData): void {
	try {
		const allDungeons = getAllDungeons();
		const existingIndex = allDungeons.findIndex(d => d.id === dungeon.id);

		const meta = {
			id: dungeon.id,
			name: dungeon.name,
			totalRooms: dungeon.totalRooms,
			createdAt: dungeon.createdAt,
			updatedAt: dungeon.updatedAt,
		};

		if (existingIndex >= 0) {
			allDungeons[existingIndex] = meta;
		} else {
			allDungeons.push(meta);
		}

		localStorage.setItem(DUNGEON_METADATA_KEY, JSON.stringify(allDungeons));
	} catch (error) {
		console.error("Error saving dungeon metadata:", error);
	}
}

/**
 * Charge un donjon complet par son ID
 */
export function loadDungeon(dungeonId: string): DungeonData | null {
	try {
		const data = localStorage.getItem(`${DUNGEON_STORAGE_KEY}_${dungeonId}`);
		if (!data) return null;
		return JSON.parse(data);
	} catch (error) {
		console.error(`Error loading dungeon ${dungeonId}:`, error);
		return null;
	}
}

/**
 * Sauvegarde un donjon complet
 */
export function saveDungeon(dungeonData: DungeonData): void {
	try {
		saveDungeonMetadata(dungeonData);
		localStorage.setItem(`${DUNGEON_STORAGE_KEY}_${dungeonData.id}`, JSON.stringify(dungeonData));
	} catch (error) {
		console.error(`Error saving dungeon ${dungeonData.id}:`, error);
		throw error;
	}
}

/**
 * Supprime un donjon et toutes ses salles
 */
export function deleteDungeon(dungeonId: string): void {
	try {
		const dungeon = loadDungeon(dungeonId);
		if (dungeon) {
			dungeon.roomIds.forEach(roomId => deleteMap(roomId));
		}

		const allDungeons = getAllDungeons();
		const filtered = allDungeons.filter(d => d.id !== dungeonId);
		localStorage.setItem(DUNGEON_METADATA_KEY, JSON.stringify(filtered));
		localStorage.removeItem(`${DUNGEON_STORAGE_KEY}_${dungeonId}`);
	} catch (error) {
		console.error(`Error deleting dungeon ${dungeonId}:`, error);
	}
}

/**
 * Obtient les positions des cellules de téléportation d'une map
 */
export function getTeleportPositions(mapId: string): { x: number; z: number }[] {
	const savedMap = loadMap(mapId);
	if (!savedMap?.spawnZones) return [];

	const positions: { x: number; z: number }[] = [];
	Object.entries(savedMap.spawnZones).forEach(([key, type]) => {
		if (type === "teleport") {
			const [x, z] = key.split(",").map(Number);
			positions.push({ x, z });
		}
	});
	return positions;
}
