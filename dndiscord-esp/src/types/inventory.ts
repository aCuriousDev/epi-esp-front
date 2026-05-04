/**
 * Types partagés avec le back pour l'inventaire (POC).
 * Voir epi-esp-back/src/DnDiscordAPI/Games/Inventory/DTOs/
 */

export type ItemCategory =
  | "Consumable"
  | "Weapon"
  | "Armor"
  | "Tool"
  | "Magic"
  | "Treasure";

export interface Item {
  id: string;
  name: string;
  description: string;
  /** Clé d'icône (ex: "potion-red", "dagger") — voir itemVisuals.ts */
  icon: string;
  category: ItemCategory;
  /** URL d'un modèle 3D poly.pizza (optionnel). */
  modelUrl?: string | null;
  /** Prix en GP. 0 = non disponible en boutique. */
  goldCost: number;
}

export interface InventoryEntry {
  id: string;
  characterId: string;
  quantity: number;
  item: Item;
}

export type InventoryChangeAction = "Added" | "Updated" | "Removed";

export interface InventoryChangedEvent {
  characterId: string;
  action: InventoryChangeAction;
  entry: InventoryEntry;
}

export interface GiveItemRequest {
  itemId: string;
  quantity: number;
  /** Required by the back so the server can verify the caller is the DM of this campaign. */
  campaignId: string;
}

export interface BuyItemRequest {
  itemId: string;
  quantity: number;
  campaignId?: string;
}

export interface BuyItemResult {
  entry: InventoryEntry;
  remainingGold: number;
  totalCost: number;
}

// ---- Wallet (monnaies D&D 5e) ----

export interface WalletDto {
  copperPieces: number;
  silverPieces: number;
  electrumPieces: number;
  goldPieces: number;
  platinumPieces: number;
  totalInCopper: number;
}

export interface ModifyWalletRequest {
  copperPieces?: number;
  silverPieces?: number;
  electrumPieces?: number;
  goldPieces?: number;
  platinumPieces?: number;
}

export interface WalletChangedEvent {
  characterId: string;
  wallet: WalletDto;
}
