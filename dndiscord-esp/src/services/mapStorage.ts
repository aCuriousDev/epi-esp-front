/**
 * Service de stockage des maps en localStorage
 */

export interface SavedMapData {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	cells: SavedCellData[];
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
}

const STORAGE_KEY = "dndiscord_maps";
const MAP_METADATA_KEY = "dndiscord_maps_metadata";

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
