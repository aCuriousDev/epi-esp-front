import { Component, For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Beaker } from "lucide-solid";
import { InventoryService } from "../../services/inventory.service";
import { sessionState } from "../../stores/session.store";
import ItemIcon from "../common/ItemIcon";
import type { InventoryEntry, InventoryChangedEvent } from "../../types/inventory";

interface HotbarConsumablesProps {
  characterId: string | null;
}

/**
 * Up-to-three quick-use consumable slots sourced from the player's inventory.
 * Clicking fires the existing useEntry endpoint; the InventoryChanged
 * broadcast refreshes the UI reactively.
 */
export const HotbarConsumables: Component<HotbarConsumablesProps> = (props) => {
  const [entries, setEntries] = createSignal<InventoryEntry[]>([]);
  const [usingId, setUsingId] = createSignal<string | null>(null);
  let unsubscribe: (() => void) | null = null;

  const consumables = () =>
    entries()
      .filter((e) => e.item.category === "Consumable" && e.quantity > 0)
      .slice(0, 3);

  const load = async () => {
    if (!props.characterId) {
      setEntries([]);
      return;
    }
    try {
      const data = await InventoryService.getCharacterInventory(props.characterId);
      setEntries(data);
    } catch (err) {
      console.warn("[HotbarConsumables] inventory load failed", err);
    }
  };

  const handleInventoryChanged = (evt: InventoryChangedEvent) => {
    if (!props.characterId || evt.characterId !== props.characterId) return;
    if (evt.action === "Removed") {
      setEntries((prev) => prev.filter((e) => e.id !== evt.entry.id));
    } else {
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === evt.entry.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = evt.entry;
          return copy;
        }
        return [...prev, evt.entry];
      });
    }
  };

  onMount(async () => {
    await load();
    // Subscribe unconditionally — InventoryService.onInventoryChanged handles
    // the not-yet-connected case internally. Gating on isConnected here raced
    // with a reconnect between mount and the async load completing.
    unsubscribe = InventoryService.onInventoryChanged(handleInventoryChanged);
  });

  onCleanup(() => {
    if (unsubscribe) unsubscribe();
  });

  const handleUse = async (entry: InventoryEntry) => {
    if (!props.characterId || usingId()) return;
    setUsingId(entry.id);
    const campaignId = sessionState.session?.campaignId;
    try {
      await InventoryService.useEntry(
        props.characterId,
        entry.id,
        campaignId ?? undefined,
      );
    } catch (err) {
      console.warn("[HotbarConsumables] useEntry failed", err);
    } finally {
      setUsingId(null);
    }
  };

  return (
    <div class="flex items-end gap-1.5 px-2 py-2 rounded-xl bg-gradient-to-br from-zinc-950/85 to-slate-950/85 border border-emerald-500/20 shadow-lg backdrop-blur-sm">
      <Show when={consumables().length === 0}>
        <div class="flex items-center gap-1.5 px-3 py-2 text-[10px] text-slate-400 italic">
          <Beaker class="w-3 h-3 opacity-50" />
          Pas de potion
        </div>
      </Show>
      <For each={consumables()}>
        {(entry) => {
          const isUsing = () => usingId() === entry.id;
          return (
            <button
              onClick={() => handleUse(entry)}
              disabled={isUsing() || !props.characterId}
              class="relative w-12 h-12 rounded-lg border-2 border-emerald-500/40 bg-emerald-900/20 hover:bg-emerald-500/20 hover:border-emerald-400 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring-gold"
              title={`${entry.item.name} (${entry.quantity}) — ${entry.item.description}`}
            >
              <ItemIcon iconKey={entry.item.icon} size="1.75rem" class="text-emerald-200" />
              <span class="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-emerald-500 border border-emerald-300/50 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                ×{entry.quantity}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
};
