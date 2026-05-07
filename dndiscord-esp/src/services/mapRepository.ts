/**
 * mapRepository — source of truth for all map read/write operations.
 *
 * Resolution table for loadMap(id):
 *   null | "default"       → return null  (caller falls back to createDefaultGrid)
 *   "__tutorial__" etc.    → in-memory builtin cache (pre-loaded via preloadBuiltin)
 *   UUID                   → localStorage (populated by cacheMap after GameStarted / MapSwitched)
 *   "map_timestamp_..."    → localStorage legacy fallback
 *
 * mapStorage.ts re-exports everything from this file so existing call sites are untouched.
 */

import { getApiUrl } from './config';
import { AuthService } from './auth.service';

// ─── Types (re-exported so mapStorage consumers stay unaffected) ──────────────

export type SpawnZoneType = 'ally' | 'enemy' | 'teleport';

export interface SavedLightData {
  presetId: 'torch' | 'lantern' | 'magical_orb';
  x: number;
  z: number;
  y?: number;
  intensityOverride?: number;
  colorOverride?: [number, number, number];
}

export interface SavedMapData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  cells: SavedCellData[];
  spawnZones?: Record<string, SpawnZoneType>;
  mapType?: 'classique' | 'dungeon-room';
  dungeonId?: string;
  roomIndex?: number;
  lights?: SavedLightData[];
  version?: number;
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
  offsetX?: number;
  offsetZ?: number;
  affectedCells?: { x: number; z: number }[];
}

export type MapMeta = { id: string; name: string; createdAt: number; updatedAt: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY       = 'dndiscord_maps';
const MAP_METADATA_KEY  = 'dndiscord_maps_metadata';
const DUNGEON_STORAGE_KEY  = 'dndiscord_dungeons';
const DUNGEON_METADATA_KEY = 'dndiscord_dungeons_metadata';

/** UUID v4 shape — used to decide whether to treat an ID as a DB record. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Built-in sentinel IDs like "__tutorial__". */
const BUILTIN_RE = /^__[a-z_]+__$/;

/** Static asset paths for built-in maps (relative to public/). */
const BUILTIN_ASSET_PATHS: Record<string, string> = {
  __tutorial__: '/assets/maps/tutorial.dndmap.json',
};

// In-memory cache for built-in maps. Pre-populated by preloadBuiltin().
const _builtinCache = new Map<string, SavedMapData>();

// ─── Migration helper ─────────────────────────────────────────────────────────

export function migrateMap(raw: SavedMapData): SavedMapData {
  const version = raw.version ?? 1;
  if (version >= 2) return raw;
  return { ...raw, lights: raw.lights ?? [], version: 2 };
}

// ─── Built-in map preloading ──────────────────────────────────────────────────

/**
 * Pre-load a built-in map into the in-memory cache.
 * Call this before startGame() when using a builtin map ID (e.g. "__tutorial__").
 * Safe to call multiple times — no-op if already loaded.
 */
export async function preloadBuiltin(id: string): Promise<void> {
  if (_builtinCache.has(id)) return;
  const path = BUILTIN_ASSET_PATHS[id];
  if (!path) return;
  try {
    const res = await fetch(path);
    if (!res.ok) return;
    const data = await res.json();
    _builtinCache.set(id, migrateMap(data as SavedMapData));
  } catch (err) {
    console.warn(`[mapRepository] preloadBuiltin failed for ${id}:`, err);
  }
}

// ─── loadMap — synchronous, resolution table ──────────────────────────────────

/**
 * Load a map synchronously.
 *
 * - null / "default"    → null  (caller generates procedural grid)
 * - "__tutorial__" etc. → in-memory builtin (call preloadBuiltin first)
 * - UUID                → localStorage (written by cacheMap after GameStarted/MapSwitched)
 * - "map_timestamp_…"   → localStorage legacy
 */
export function loadMap(mapId: string | null): SavedMapData | null {
  if (!mapId || mapId === 'default') return null;

  if (BUILTIN_RE.test(mapId)) {
    return _builtinCache.get(mapId) ?? null;
  }

  // UUID and legacy: both stored in localStorage under the same key pattern.
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}_${mapId}`);
    if (!data) return null;
    return migrateMap(JSON.parse(data) as SavedMapData);
  } catch (err) {
    console.error(`[mapRepository] loadMap error for ${mapId}:`, err);
    return null;
  }
}

// ─── ensureMapCached — fetch from API and cache if not already in localStorage ─

/**
 * Ensures a DB map is in localStorage so synchronous loadMap(id) works.
 * No-op when:
 *   - id is null / "default" / builtin → not a DB map
 *   - map is already in localStorage (already cached)
 *   - no JWT (unauthenticated)
 *
 * Lookup order:
 *   1. GET /api/campaigns/:campaignId/maps/:mapId  (if campaignId provided)
 *   2. GET /api/maps/mine/:mapId                   (standalone / owner)
 *
 * Failures are swallowed — initializeGrid will fall back to the default grid.
 */
export async function ensureMapCached(
  mapId: string | null | undefined,
  campaignId?: string | null,
): Promise<void> {
  if (!mapId || !UUID_RE.test(mapId)) return;
  if (loadMap(mapId) !== null) return; // already cached

  const token = AuthService.getToken();
  if (!token) return;

  const headers = { Authorization: `Bearer ${token}` };
  let data: string | null = null;

  try {
    // 1. Route session : accessible à tous les membres de la campagne,
    //    sans restriction d'owner. Route dédiée pour ce cas d'usage.
    if (campaignId) {
      const res = await fetch(`${getApiUrl()}/api/campaigns/${campaignId}/maps/session/${mapId}`, { headers });
      if (res.ok) {
        const record = await res.json() as { data?: string };
        data = record.data ?? null;
      }
    }

    // 2. Route owner : maps standalone créées par l'utilisateur courant
    if (!data) {
      const res = await fetch(`${getApiUrl()}/api/maps/mine/${mapId}`, { headers });
      if (res.ok) {
        const record = await res.json() as { data?: string };
        data = record.data ?? null;
      }
    }

    if (data) {
      const parsed = JSON.parse(data) as SavedMapData;
      cacheMap(parsed, mapId);
    }
  } catch (err) {
    console.warn('[mapRepository] ensureMapCached failed for', mapId, err);
  }
}

// ─── cacheMap — write to localStorage only (no API call) ─────────────────────

/**
 * Write a map blob to localStorage as a session cache.
 * Used by:
 *   - BoardGame.onMultiplayerGameStart  (mapData from GameStarted payload)
 *   - gameSync.handleMapSwitched        (mapData from MapSwitched payload)
 *
 * @param blob       The SavedMapData to cache.
 * @param overrideId When provided, the blob is stored under this key instead of
 *                   blob.id — needed by MapSwitched where the payload's embedded
 *                   id is the original localStorage key but the server sends the
 *                   DB UUID as mapId.
 */
export function cacheMap(blob: SavedMapData, overrideId?: string): void {
  if (!blob) return;
  const id = overrideId ?? blob.id;
  if (!id) return;

  // Store a normalised copy so loadMap(id) always finds it.
  const normalised: SavedMapData = { ...blob, id };
  try {
    localStorage.setItem(`${STORAGE_KEY}_${id}`, JSON.stringify(normalised));
    // Also upsert metadata so the map appears in legacy getAllMaps() lists.
    _saveMapMetadata(id, normalised.name, normalised.updatedAt);
  } catch (err) {
    console.warn(`[mapRepository] cacheMap failed for ${id}:`, err);
  }
}

// ─── getAllMaps — localStorage (Phase 3 surfaces upgrade to fetchMine) ────────

export function getAllMaps(): MapMeta[] {
  try {
    const data = localStorage.getItem(MAP_METADATA_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// ─── fetchMine — async API call with localStorage fallback ───────────────────

/**
 * Fetch the current user's maps from the API.
 * Falls back to localStorage metadata if the API is unreachable.
 *
 * Used by Phase 3 surfaces (MapEditor, MapSelectionScreen, LobbyScreen, etc.)
 * instead of the synchronous getAllMaps().
 */
export async function fetchMine(): Promise<MapMeta[]> {
  const token = AuthService.getToken();
  if (!token) return getAllMaps();

  try {
    const res = await fetch(`${getApiUrl()}/api/maps/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const items = await res.json() as Array<{
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    }>;

    const apiMaps: MapMeta[] = items.map(m => ({
      id:        m.id,
      name:      m.name,
      createdAt: new Date(m.createdAt).getTime(),
      updatedAt: new Date(m.updatedAt).getTime(),
    }));

    // Merge with localStorage-only legacy maps (id starts with "map_") so maps
    // not yet migrated to DB still appear in all lists.
    const legacyMaps = getAllMaps().filter(m => m.id.startsWith('map_'));
    const apiIds = new Set(apiMaps.map(m => m.id));
    const merged = [
      ...apiMaps,
      ...legacyMaps.filter(m => !apiIds.has(m.id)),
    ];
    return merged.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn('[mapRepository] fetchMine API failed, falling back to localStorage:', err);
    return getAllMaps();
  }
}

// ─── saveMap — localStorage (Phase 3 upgrades to API + localStorage) ─────────

function _saveMapMetadata(id: string, name: string, updatedAt: number): void {
  try {
    const all = getAllMaps();
    const idx = all.findIndex(m => m.id === id);
    if (idx >= 0) {
      all[idx].name = name;
      all[idx].updatedAt = updatedAt;
    } else {
      all.push({ id, name, createdAt: Date.now(), updatedAt });
    }
    localStorage.setItem(MAP_METADATA_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('[mapRepository] saveMapMetadata error:', err);
  }
}

export function saveMap(mapData: SavedMapData): void {
  try {
    _saveMapMetadata(mapData.id, mapData.name, mapData.updatedAt);
    localStorage.setItem(`${STORAGE_KEY}_${mapData.id}`, JSON.stringify(mapData));
  } catch (err) {
    console.error(`[mapRepository] saveMap error for ${mapData.id}:`, err);
    throw err;
  }
}

export function deleteMap(mapId: string): void {
  try {
    const all = getAllMaps().filter(m => m.id !== mapId);
    localStorage.setItem(MAP_METADATA_KEY, JSON.stringify(all));
    localStorage.removeItem(`${STORAGE_KEY}_${mapId}`);
  } catch (err) {
    console.error(`[mapRepository] deleteMap error for ${mapId}:`, err);
  }
}

/**
 * Delete for "mine" maps (standalone maps).
 *
 * - For DB maps (UUID): call API DELETE /api/maps/mine/:id (then clear local cache)
 * - For legacy/local maps ("map_..."): clear localStorage only
 */
export async function deleteMineMap(mapId: string): Promise<void> {
  const token = AuthService.getToken();
  const isUuid = UUID_RE.test(mapId);

  // If this looks like a DB map, try to delete it on the backend.
  if (isUuid && token) {
    try {
      const res = await fetch(`${getApiUrl()}/api/maps/mine/${mapId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.warn(`[mapRepository] deleteMineMap API failed for ${mapId}: HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`[mapRepository] deleteMineMap API error for ${mapId}:`, err);
    }
  }

  // Always clear local cache so the UI doesn't keep stale data.
  deleteMap(mapId);
}

export function generateMapId(): string {
  return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Dungeon storage (unchanged from mapStorage) ─────────────────────────────

export function generateDungeonId(): string {
  return `dungeon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getAllDungeons(): Array<{ id: string; name: string; totalRooms: number; createdAt: number; updatedAt: number }> {
  try {
    const data = localStorage.getItem(DUNGEON_METADATA_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function _saveDungeonMetadata(dungeon: DungeonData): void {
  try {
    const all = getAllDungeons();
    const idx = all.findIndex(d => d.id === dungeon.id);
    const meta = { id: dungeon.id, name: dungeon.name, totalRooms: dungeon.totalRooms, createdAt: dungeon.createdAt, updatedAt: dungeon.updatedAt };
    if (idx >= 0) { all[idx] = meta; } else { all.push(meta); }
    localStorage.setItem(DUNGEON_METADATA_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('[mapRepository] saveDungeonMetadata error:', err);
  }
}

export function loadDungeon(dungeonId: string): DungeonData | null {
  try {
    const data = localStorage.getItem(`${DUNGEON_STORAGE_KEY}_${dungeonId}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveDungeon(dungeonData: DungeonData): void {
  try {
    _saveDungeonMetadata(dungeonData);
    localStorage.setItem(`${DUNGEON_STORAGE_KEY}_${dungeonData.id}`, JSON.stringify(dungeonData));
  } catch (err) {
    console.error(`[mapRepository] saveDungeon error for ${dungeonData.id}:`, err);
    throw err;
  }
}

export function deleteDungeon(dungeonId: string): void {
  try {
    const dungeon = loadDungeon(dungeonId);
    if (dungeon) dungeon.roomIds.forEach(roomId => deleteMap(roomId));
    const all = getAllDungeons().filter(d => d.id !== dungeonId);
    localStorage.setItem(DUNGEON_METADATA_KEY, JSON.stringify(all));
    localStorage.removeItem(`${DUNGEON_STORAGE_KEY}_${dungeonId}`);
  } catch (err) {
    console.error(`[mapRepository] deleteDungeon error for ${dungeonId}:`, err);
  }
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export function exportMapToFile(mapData: SavedMapData): void {
  const json = JSON.stringify(mapData, null, 2);
  const a = document.createElement('a');
  a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  a.download = `${mapData.name.replace(/[^a-z0-9_\-]/gi, '_')}.dndmap.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function importMapFromJson(jsonString: string): SavedMapData {
  let parsed: SavedMapData;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid file: malformed JSON.');
  }
  if (!parsed || !Array.isArray(parsed.cells)) {
    throw new Error('Invalid format: "cells" field missing or invalid.');
  }
  const imported: SavedMapData = {
    ...parsed,
    id:        generateMapId(),
    name:      parsed.name ?? 'Imported map',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mapType:   parsed.mapType === 'dungeon-room' ? 'classique' : (parsed.mapType ?? 'classique'),
    dungeonId: undefined,
    roomIndex: undefined,
  };
  saveMap(imported);
  return imported;
}

export function getTeleportPositions(mapId: string): { x: number; z: number }[] {
  const savedMap = loadMap(mapId);
  if (!savedMap?.spawnZones) return [];
  const positions: { x: number; z: number }[] = [];
  Object.entries(savedMap.spawnZones).forEach(([key, type]) => {
    if (type === 'teleport') {
      const [x, z] = key.split(',').map(Number);
      positions.push({ x, z });
    }
  });
  return positions;
}
