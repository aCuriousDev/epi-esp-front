import axios from "axios";
import { getApiUrl } from "./config";
import { signalRService } from "./signalr/SignalRService";
import { isCharacterInCurrentSession } from "../stores/session.store";
import type {
  GiveItemRequest,
  InventoryChangedEvent,
  InventoryEntry,
  Item,
  ModifyWalletRequest,
  WalletChangedEvent,
  WalletDto,
} from "../types/inventory";

const API_URL = getApiUrl();

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Service d'inventaire — REST + SignalR (via le GameHub existant).
 */
export const InventoryService = {
  /**
   * Catalogue des objets disponibles (POC).
   */
  async getCatalog(): Promise<Item[]> {
    const res = await axios.get<Item[]>(
      `${API_URL}/api/games/inventory/catalog`,
      { headers: getAuthHeaders() },
    );
    return res.data;
  },

  /**
   * Inventaire d'un personnage.
   */
  async getCharacterInventory(characterId: string): Promise<InventoryEntry[]> {
    const res = await axios.get<InventoryEntry[]>(
      `${API_URL}/api/games/inventory/${characterId}`,
      { headers: getAuthHeaders() },
    );
    return res.data;
  },

  /**
   * Le MJ donne un objet à un personnage.
   */
  async giveItem(
    characterId: string,
    request: GiveItemRequest,
  ): Promise<InventoryEntry> {
    const res = await axios.post<InventoryEntry>(
      `${API_URL}/api/games/inventory/${characterId}`,
      request,
      { headers: getAuthHeaders() },
    );
    return res.data;
  },

  /**
   * Jeter un objet (supprime l'entrée complète). Quand le MJ supprime depuis son
   * panneau d'inspection, fournir campaignId pour que le back valide l'auth MJ.
   * Le propriétaire du personnage peut appeler sans campaignId.
   */
  async removeEntry(
    characterId: string,
    entryId: string,
    campaignId?: string,
  ): Promise<void> {
    const url = campaignId
      ? `${API_URL}/api/games/inventory/${characterId}/entry/${entryId}?campaignId=${campaignId}`
      : `${API_URL}/api/games/inventory/${characterId}/entry/${entryId}`;
    await axios.delete(url, { headers: getAuthHeaders() });
  },

  /**
   * S'abonne aux événements InventoryChanged diffusés par le back.
   * Retourne une fonction de désabonnement.
   * Nécessite que signalRService.connect() ait déjà été appelé.
   */
  onInventoryChanged(
    handler: (evt: InventoryChangedEvent) => void,
  ): () => void {
    // Defence-in-depth: the back session-scopes these events, but if a stray
    // event arrives for a character that isn't in the current session we drop it
    // rather than exposing another player's inventory to this UI.
    const wrapped = (evt: InventoryChangedEvent) => {
      if (!isCharacterInCurrentSession(evt.characterId)) return;
      handler(evt);
    };
    try {
      signalRService.on("InventoryChanged", wrapped);
    } catch (err) {
      console.warn(
        "[InventoryService] SignalR non connecté, abonnement impossible",
        err,
      );
      return () => {};
    }
    return () => {
      try {
        signalRService.off("InventoryChanged", wrapped);
      } catch {
        /* no-op */
      }
    };
  },

  // ---- Wallet (monnaies D&D 5e) ----

  async getWallet(characterId: string): Promise<WalletDto> {
    const res = await axios.get<WalletDto>(
      `${API_URL}/api/games/character/${characterId}/wallet`,
      { headers: getAuthHeaders() },
    );
    return res.data;
  },

  async modifyWallet(
    characterId: string,
    request: ModifyWalletRequest,
  ): Promise<WalletDto> {
    const res = await axios.patch<WalletDto>(
      `${API_URL}/api/games/character/${characterId}/wallet`,
      request,
      { headers: getAuthHeaders() },
    );
    return res.data;
  },

  onWalletChanged(
    handler: (evt: WalletChangedEvent) => void,
  ): () => void {
    const wrapped = (evt: WalletChangedEvent) => {
      if (!isCharacterInCurrentSession(evt.characterId)) return;
      handler(evt);
    };
    try {
      signalRService.on("WalletChanged", wrapped);
    } catch (err) {
      console.warn(
        "[InventoryService] SignalR non connecté (wallet), abonnement impossible",
        err,
      );
      return () => {};
    }
    return () => {
      try {
        signalRService.off("WalletChanged", wrapped);
      } catch {
        /* no-op */
      }
    };
  },
};
