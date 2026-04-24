/**
 * DmPlayerInspectPanel — Opens when the DM clicks a player unit on the map.
 * Shows character stats, current inventory, and allows giving items from the catalog.
 */

import {
  Show,
  For,
  createSignal,
  createMemo,
  createEffect,
  on,
  onMount,
  onCleanup,
} from "solid-js";
import {
  X,
  Heart,
  Shield,
  Swords,
  Zap,
  Footprints,
  Search,
  Check,
  Plus,
  Minus,
  Package,
  Sparkles,
  Coins,
  TrendingUp,
} from "lucide-solid";
import { units } from "../../game/stores/UnitsStore";
import {
  dmInspectedUnit,
  setDmInspectedUnit,
} from "../../stores/dmTools.store";
import { isDm, getOtherPlayers, sessionState } from "../../stores/session.store";
import {
  dmGrantItem,
  dmAdjustHp,
  dmAwardExperience,
  dmForceLevelUp,
  dmGrantGold,
} from "../../services/signalr/multiplayer.service";
import { InventoryService } from "../../services/inventory.service";
import { getCategoryStyle } from "../../services/itemVisuals";
import { CharacterService, type CharacterDto } from "../../services/character.service";
import ItemIcon from "../common/ItemIcon";
import { Team } from "../../types";
import type { Item, ItemCategory, InventoryEntry, InventoryChangedEvent } from "../../types/inventory";

const CATEGORY_FILTERS: Array<{ value: "all" | ItemCategory; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "Consumable", label: "Conso" },
  { value: "Weapon", label: "Armes" },
  { value: "Armor", label: "Armures" },
  { value: "Tool", label: "Outils" },
  { value: "Magic", label: "Magie" },
  { value: "Treasure", label: "Trésors" },
];

const COIN_TYPES = [
  { value: "cp", label: "Pièces de cuivre" },
  { value: "sp", label: "Pièces d'argent" },
  { value: "ep", label: "Pièces d'électrum" },
  { value: "gp", label: "Pièces d'or" },
  { value: "pp", label: "Pièces de platine" },
] as const;

type CoinType = (typeof COIN_TYPES)[number]["value"];

export default function DmPlayerInspectPanel() {
  // ── Catalog (loaded once) ──
  const [catalog, setCatalog] = createSignal<Item[]>([]);
  const [catalogSearch, setCatalogSearch] = createSignal("");
  const [catalogFilter, setCatalogFilter] = createSignal<"all" | ItemCategory>("all");

  // ── Inventory of inspected character ──
  const [inventory, setInventory] = createSignal<InventoryEntry[]>([]);
  const [loadingInv, setLoadingInv] = createSignal(false);
  const [character, setCharacter] = createSignal<CharacterDto | null>(null);

  // ── Give state ──
  const [grantQuantity, setGrantQuantity] = createSignal(1);
  const [grantingItemId, setGrantingItemId] = createSignal<string | null>(null);
  const [givenItemId, setGivenItemId] = createSignal<string | null>(null);
  const [xpAmount, setXpAmount] = createSignal(250);
  const [goldAmount, setGoldAmount] = createSignal(10);
  const [goldType, setGoldType] = createSignal<CoinType>("gp");
  const [updatingProgression, setUpdatingProgression] = createSignal(false);

  // ── View toggle: "stats" | "inventory" | "give" ──
  const [view, setView] = createSignal<"stats" | "inventory" | "give">("stats");

  // ── Derived data ──
  const unit = () => {
    const id = dmInspectedUnit();
    return id ? units[id] : null;
  };

  const playerInfo = () => {
    const u = unit();
    if (!u?.ownerUserId) return null;
    return getOtherPlayers().find((p) => p.userId === u.ownerUserId) ?? null;
  };

  const characterId = () => playerInfo()?.selectedCharacterId ?? null;

  const filteredCatalog = createMemo(() => {
    const q = catalogSearch().trim().toLowerCase();
    const cat = catalogFilter();
    return catalog().filter((item) => {
      if (cat !== "all" && item.category !== cat) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    });
  });

  const totalItems = createMemo(() =>
    inventory().reduce((sum, e) => sum + e.quantity, 0),
  );

  // ── Load catalog on mount ──
  onMount(async () => {
    try {
      const items = await InventoryService.getCatalog();
      setCatalog(items);
    } catch (err) {
      console.error("[DM Inspect] Failed to load catalog:", err);
    }
  });

  // ── Load inventory when unit changes ──
  let unsubscribe: (() => void) | null = null;

  const loadInventory = async (charId: string) => {
    setLoadingInv(true);
    try {
      // Pass the current campaign id so the back applies the DM auth path
      // (`CanAccessCharacterAsync` accepts owner OR DM-of-campaign). Without
      // it the DM isn't the owner and the endpoint 403s (BUG-L).
      const campaignId = sessionState.session?.campaignId;
      const entries = await InventoryService.getCharacterInventory(charId, campaignId);
      setInventory(entries);
    } catch (err) {
      console.error("[DM Inspect] Failed to load inventory:", err);
      setInventory([]);
    } finally {
      setLoadingInv(false);
    }
  };

  const loadCharacter = async (charId: string) => {
    try {
      const data = await CharacterService.getCharacter(charId);
      setCharacter(data);
    } catch (err) {
      console.error("[DM Inspect] Failed to load character:", err);
      setCharacter(null);
    }
  };

  const currentCharId = createMemo(() => characterId());
  const currentUnitId = createMemo(() => dmInspectedUnit());

  // Reload inventory + resubscribe whenever the inspected character changes.
  createEffect(
    on(currentCharId, (charId) => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (charId) {
        loadInventory(charId);
        loadCharacter(charId);
        unsubscribe = InventoryService.onInventoryChanged(handleInventoryChanged);
      } else {
        setInventory([]);
        setCharacter(null);
      }
    }),
  );

  // Reset the sub-view + the in-flight grant guard when the DM clicks a
  // different player's unit. Without this the panel stays on (e.g.) the
  // "Donner" tab showing stale state from the previous inspect, which looked
  // like "the panel doesn't switch" in testing.
  createEffect(
    on(currentUnitId, () => {
      setView("stats");
      setGrantingItemId(null);
      setGivenItemId(null);
      setUpdatingProgression(false);
    }),
  );

  onCleanup(() => {
    if (unsubscribe) unsubscribe();
  });

  const handleInventoryChanged = (evt: InventoryChangedEvent) => {
    const charId = currentCharId();
    if (!charId || evt.characterId !== charId) return;

    if (evt.action === "Added") {
      setInventory((prev) => {
        const idx = prev.findIndex((e) => e.id === evt.entry.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = evt.entry;
          return copy;
        }
        return [...prev, evt.entry].sort((a, b) => a.item.name.localeCompare(b.item.name));
      });
    } else if (evt.action === "Updated") {
      setInventory((prev) => {
        const idx = prev.findIndex((e) => e.id === evt.entry.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = evt.entry;
          return copy;
        }
        return prev;
      });
    } else if (evt.action === "Removed") {
      setInventory((prev) => prev.filter((e) => e.id !== evt.entry.id));
    }
  };

  // ── Give item handler ──
  // Single code path: the hub's DmGrantItem now persists via the inventory
  // service and broadcasts both ItemGranted (toast) and InventoryChanged
  // (state). A global in-flight guard stops the "click item A then B before A
  // resolves" double-grant race — a per-item disable wasn't enough.
  const feedbackTimer: { id: ReturnType<typeof setTimeout> | null } = { id: null };

  const handleGiveItem = async (item: Item) => {
    if (grantingItemId() !== null) return;
    const charId = currentCharId();
    const player = playerInfo();
    if (!charId || !player) return;
    setGrantingItemId(item.id);
    try {
      await dmGrantItem({
        targetUserId: player.userId,
        itemId: item.id,
        itemName: item.name,
        quantity: grantQuantity(),
        description: item.description,
      });
      setGivenItemId(item.id);
      setGrantQuantity(1);
      if (feedbackTimer.id) clearTimeout(feedbackTimer.id);
      feedbackTimer.id = setTimeout(() => {
        setGivenItemId(null);
        setGrantingItemId(null);
        feedbackTimer.id = null;
      }, 1200);
    } catch (e: any) {
      console.error("[DM Inspect] Grant item failed:", e);
      setGrantingItemId(null);
    }
  };

  onCleanup(() => {
    if (feedbackTimer.id) clearTimeout(feedbackTimer.id);
  });

  const close = () => setDmInspectedUnit(null);

  const handleAwardXp = async () => {
    const player = playerInfo();
    const charId = currentCharId();
    const amount = Math.max(1, Math.floor(xpAmount()));
    if (!player || !charId || updatingProgression()) return;
    setUpdatingProgression(true);
    try {
      await dmAwardExperience({ targetUserId: player.userId, experienceAmount: amount });
      await loadCharacter(charId);
    } catch (e) {
      console.error("[DM Inspect] Award XP failed:", e);
    } finally {
      setUpdatingProgression(false);
    }
  };

  const handleForceLevelUp = async () => {
    const player = playerInfo();
    const charId = currentCharId();
    if (!player || !charId || updatingProgression()) return;
    setUpdatingProgression(true);
    try {
      await dmForceLevelUp({ targetUserId: player.userId, levels: 1 });
      await loadCharacter(charId);
    } catch (e) {
      console.error("[DM Inspect] Force level up failed:", e);
    } finally {
      setUpdatingProgression(false);
    }
  };

  const handleGrantGold = async () => {
    const player = playerInfo();
    const amount = Math.floor(goldAmount());
    if (!player || amount === 0 || updatingProgression()) return;
    setUpdatingProgression(true);
    try {
      await dmGrantGold({
        targetUserId: player.userId,
        amount,
        currencyType: goldType(),
        // Legacy field for older backend compatibility.
        goldPieces: amount,
      });
    } catch (e) {
      console.error("[DM Inspect] Grant gold failed:", e);
    } finally {
      setUpdatingProgression(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <Show when={isDm() && unit()}>
      {(u) => {
        const s = () => u().stats;
        const p = () => playerInfo();
        const hpPct = () => Math.round((s().currentHealth / s().maxHealth) * 100);
        const apPct = () => Math.round((s().currentActionPoints / s().maxActionPoints) * 100);

        return (
          <div class="dm-inspect-panel">
            {/* Header */}
            <div class="flex items-center gap-2 mb-2">
              <span class={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${u().team === Team.PLAYER ? "bg-emerald-400" : "bg-red-400"}`} />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-white truncate">{u().name}</div>
                <Show when={p()}>
                  <div class="text-[10px] text-purple-300/60">{p()!.userName}</div>
                </Show>
              </div>
              <button class="text-purple-400/50 hover:text-white transition-colors cursor-pointer" onClick={close}>
                <X class="w-4 h-4" />
              </button>
            </div>

            {/* View toggle — inventory + give are player-only (characters
                carry inventory; enemies / allies don't). Stats + HP tools
                work on any unit. */}
            <div class="flex gap-0.5 mb-2">
              <button
                class={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                  view() === "stats" ? "bg-purple-500/20 text-purple-200 border border-purple-500/30" : "text-purple-400/50 hover:text-purple-300 border border-transparent"
                }`}
                onClick={() => setView("stats")}
              >Stats</button>
              <Show when={u().team === Team.PLAYER}>
                <button
                  class={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                    view() === "inventory" ? "bg-purple-500/20 text-purple-200 border border-purple-500/30" : "text-purple-400/50 hover:text-purple-300 border border-transparent"
                  }`}
                  onClick={() => setView("inventory")}
                >
                  Inventaire
                  <Show when={totalItems() > 0}>
                    <span class="ml-1 text-[8px] text-purple-300/50">({totalItems()})</span>
                  </Show>
                </button>
                <button
                  class={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                    view() === "give" ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "text-purple-400/50 hover:text-purple-300 border border-transparent"
                  }`}
                  onClick={() => setView("give")}
                >
                  <Sparkles class="w-3 h-3 inline mr-0.5" />
                  Donner
                </button>
              </Show>
            </div>

            {/* ── STATS VIEW ── */}
            <Show when={view() === "stats"}>
              <div class="space-y-1.5">
                {/* HP bar + DM heal/damage tool */}
                <div class="space-y-0.5">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="flex items-center gap-1 text-red-300"><Heart class="w-3 h-3" /> PV</span>
                    <span class="text-white/80 font-mono">{s().currentHealth}/{s().maxHealth}</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div class="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all" style={{ width: `${hpPct()}%` }} />
                  </div>
                  <Show when={isDm()}>
                    <div class="flex items-center justify-between gap-1 mt-1 text-[10px]">
                      <span class="text-purple-300/60">MJ :</span>
                      <div class="flex items-center gap-0.5">
                        <HpAdjustBtn unitId={u().id} delta={-10} label="-10" tone="red" />
                        <HpAdjustBtn unitId={u().id} delta={-1} label="-1" tone="red" />
                        <HpAdjustBtn unitId={u().id} delta={+1} label="+1" tone="green" />
                        <HpAdjustBtn unitId={u().id} delta={+10} label="+10" tone="green" />
                        <HpAdjustBtn unitId={u().id} delta={s().maxHealth} label="Max" tone="green" />
                      </div>
                    </div>
                  </Show>
                </div>

                {/* AP bar */}
                <div class="space-y-0.5">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="flex items-center gap-1 text-amber-300"><Zap class="w-3 h-3" /> PA</span>
                    <span class="text-white/80 font-mono">{s().currentActionPoints}/{s().maxActionPoints}</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div class="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all" style={{ width: `${apPct()}%` }} />
                  </div>
                </div>

                {/* Stat grid */}
                <div class="grid grid-cols-2 gap-1 mt-1">
                  <StatRow icon={<Swords class="w-3 h-3 text-orange-300" />} label="Attaque" value={s().attackDamage} />
                  <StatRow icon={<Shield class="w-3 h-3 text-sky-300" />} label="Défense" value={s().defense} />
                  <StatRow icon={<Footprints class="w-3 h-3 text-emerald-300" />} label="Déplacement" value={s().movementRange} />
                  <StatRow icon={<Swords class="w-3 h-3 text-purple-300" />} label="Portée" value={s().attackRange} />
                </div>

                <Show when={u().team === Team.PLAYER && currentCharId()}>
                  <div class="mt-2 space-y-1.5 rounded-lg border border-purple-500/20 bg-purple-500/5 p-2">
                    <div class="flex items-center justify-between text-[10px]">
                      <span class="text-purple-200/80 flex items-center gap-1"><TrendingUp class="w-3 h-3" /> Progression</span>
                      <span class="text-white/80">Niv. {character()?.level ?? "?"}</span>
                    </div>
                    <Show when={character()}>
                      <div class="grid grid-cols-3 gap-1 text-[9px]">
                        <StatMini label="FOR" value={character()!.abilities.strength} />
                        <StatMini label="DEX" value={character()!.abilities.dexterity} />
                        <StatMini label="CON" value={character()!.abilities.constitution} />
                        <StatMini label="INT" value={character()!.abilities.intelligence} />
                        <StatMini label="SAG" value={character()!.abilities.wisdom} />
                        <StatMini label="CHA" value={character()!.abilities.charisma} />
                      </div>
                      <div class="text-[9px] text-purple-200/70 text-center">
                        XP stockée: <span class="font-mono text-white/85">{character()!.experiencePoints}</span> / 1000
                      </div>
                    </Show>
                    <div class="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        class="dm-input h-7 text-[10px]"
                        value={xpAmount()}
                        onInput={(e) => setXpAmount(Math.max(1, Number(e.currentTarget.value) || 1))}
                      />
                      <button
                        class="px-2 py-1 rounded-md text-[10px] bg-violet-500/25 border border-violet-400/30 text-violet-100 hover:bg-violet-500/35 transition-colors disabled:opacity-50"
                        disabled={updatingProgression()}
                        onClick={handleAwardXp}
                      >
                        +XP
                      </button>
                      <button
                        class="px-2 py-1 rounded-md text-[10px] bg-yellow-500/25 border border-yellow-400/30 text-yellow-100 hover:bg-yellow-500/35 transition-colors disabled:opacity-50"
                        disabled={updatingProgression()}
                        onClick={handleForceLevelUp}
                      >
                        Level Up
                      </button>
                    </div>

                    <div class="flex items-center gap-1">
                      <input
                        type="number"
                        class="dm-input h-7 text-[10px]"
                        value={goldAmount()}
                        onInput={(e) => setGoldAmount(Math.trunc(Number(e.currentTarget.value) || 0))}
                      />
                      <select
                        class="dm-input h-7 text-[10px] px-1"
                        value={goldType()}
                        onChange={(e) => setGoldType(e.currentTarget.value as CoinType)}
                      >
                        <For each={COIN_TYPES}>
                          {(coin) => <option value={coin.value}>{coin.label}</option>}
                        </For>
                      </select>
                      <button
                        class="px-2 py-1 rounded-md text-[10px] bg-amber-500/25 border border-amber-400/30 text-amber-100 hover:bg-amber-500/35 transition-colors disabled:opacity-50 flex items-center gap-1"
                        disabled={updatingProgression() || goldAmount() === 0}
                        onClick={handleGrantGold}
                      >
                        <Coins class="w-3 h-3" />
                        Donner
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Position */}
                <div class="text-[9px] text-purple-300/40 text-center mt-1">
                  Position: <span class="font-mono text-purple-300/60">{u().position.x}, {u().position.z}</span>
                </div>
              </div>
            </Show>

            {/* ── INVENTORY VIEW ── */}
            <Show when={view() === "inventory"}>
              <div class="dm-catalog-grid max-h-48 overflow-y-auto">
                <Show when={loadingInv()}>
                  <div class="flex justify-center py-4">
                    <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                </Show>
                <Show when={!loadingInv() && inventory().length === 0}>
                  <div class="text-center py-4">
                    <Package class="w-6 h-6 text-purple-400/20 mx-auto mb-1" />
                    <p class="text-[10px] text-purple-300/40">Inventaire vide</p>
                  </div>
                </Show>
                <Show when={!loadingInv() && inventory().length > 0}>
                  <div class="space-y-1">
                    <For each={inventory()}>{(entry) => {
                      const style = getCategoryStyle(entry.item.category);
                      return (
                        <div class={`flex items-center gap-2 p-1.5 rounded-lg border border-white/8 bg-gradient-to-r ${style.gradient}`}>
                          <div class={`flex-shrink-0 w-7 h-7 rounded-md bg-black/20 flex items-center justify-center`}>
                            <ItemIcon iconKey={entry.item.icon} size="1.1rem" class={style.text} />
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class={`text-[10px] font-semibold ${style.text} truncate`}>{entry.item.name}</div>
                            <div class="text-[8px] text-white/40 truncate">{entry.item.description}</div>
                          </div>
                          <Show when={entry.quantity > 1}>
                            <span class="text-[10px] font-bold text-white/70 bg-black/30 px-1.5 py-0.5 rounded-full">×{entry.quantity}</span>
                          </Show>
                        </div>
                      );
                    }}</For>
                  </div>
                </Show>
              </div>
            </Show>

            {/* ── GIVE ITEMS VIEW ── */}
            <Show when={view() === "give"}>
              <div class="space-y-1.5">
                <Show when={!currentCharId()}>
                  {/* Three distinct cases to communicate:
                      1. Unit has no matching session player (genuinely orphan).
                      2. Player picked a default template — items can't persist,
                         so gifting is disabled by design.
                      3. Player has a real character slot but selection hasn't
                         reached us yet (timing / reconnect). */}
                  <p class="text-[9px] text-amber-300/60 text-center py-2">
                    {!playerInfo()
                      ? "Impossible d'associer cette unité à un joueur de la session"
                      : playerInfo()!.selectedDefaultTemplate
                        ? "Départ rapide : les objets ne peuvent être donnés qu'à un personnage persisté. Le joueur doit créer un personnage pour recevoir des objets."
                        : "Chargement du personnage… (si persiste, le joueur doit resélectionner son personnage dans le lobby)"}
                  </p>
                </Show>
                <Show when={currentCharId()}>
                  {/* Search */}
                  <div class="relative">
                    <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-400/40" />
                    <input
                      type="text"
                      value={catalogSearch()}
                      onInput={(e) => setCatalogSearch(e.currentTarget.value)}
                      placeholder="Rechercher…"
                      class="dm-input w-full pl-7"
                    />
                  </div>

                  {/* Category chips */}
                  <div class="flex flex-wrap gap-0.5">
                    <For each={CATEGORY_FILTERS}>{(f) => (
                      <button
                        onClick={() => setCatalogFilter(f.value)}
                        class={`px-1.5 py-0.5 rounded-full text-[8px] font-semibold border transition-all ${
                          catalogFilter() === f.value
                            ? "bg-purple-500/25 border-purple-400/40 text-purple-200"
                            : "bg-transparent border-transparent text-purple-400/40 hover:text-purple-300 hover:bg-purple-500/10"
                        }`}
                      >
                        {f.label}
                      </button>
                    )}</For>
                  </div>

                  {/* Quantity */}
                  <div class="flex items-center gap-1 justify-center">
                    <button class="dm-qty-btn" onClick={() => setGrantQuantity((v) => Math.max(1, v - 1))}>
                      <Minus class="w-2.5 h-2.5" />
                    </button>
                    <span class="text-xs text-white/80 font-mono w-6 text-center">{grantQuantity()}</span>
                    <button class="dm-qty-btn" onClick={() => setGrantQuantity((v) => Math.min(99, v + 1))}>
                      <Plus class="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Catalog grid */}
                  <div class="dm-catalog-grid max-h-36 overflow-y-auto pr-0.5">
                    <Show when={filteredCatalog().length > 0} fallback={
                      <p class="text-[9px] text-purple-300/40 text-center py-3">Aucun objet trouvé</p>
                    }>
                      <div class="grid grid-cols-2 gap-1">
                        <For each={filteredCatalog()}>{(item) => {
                          const style = getCategoryStyle(item.category);
                          const justGiven = () => givenItemId() === item.id;
                          const isGiving = () => grantingItemId() === item.id;
                          return (
                            <button
                              class={`dm-catalog-item group relative rounded-lg overflow-hidden border text-left transition-all ${
                                justGiven()
                                  ? "border-emerald-400/50 bg-emerald-500/15 scale-95"
                                  : "border-white/8 hover:border-purple-400/30 hover:bg-purple-500/8"
                              }`}
                              disabled={isGiving()}
                              onClick={() => handleGiveItem(item)}
                              title={`${item.name} — ${item.description}`}
                            >
                              {/* "Offert !" flash */}
                              <Show when={justGiven()}>
                                <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-emerald-900/70 backdrop-blur-sm rounded-lg">
                                  <Check class="w-4 h-4 text-emerald-300" />
                                  <span class="text-emerald-200 text-[8px] font-bold mt-0.5">Offert !</span>
                                </div>
                              </Show>

                              <div class="flex items-center gap-1.5 p-1.5">
                                <div class={`flex-shrink-0 w-7 h-7 rounded-md bg-gradient-to-br ${style.gradient} border ${style.ring} flex items-center justify-center`}>
                                  <ItemIcon iconKey={item.icon} size="1.1rem" class={style.text} />
                                </div>
                                <div class="min-w-0 flex-1">
                                  <div class={`text-[9px] font-semibold ${style.text} truncate leading-tight`}>{item.name}</div>
                                  <div class="text-[7px] text-purple-300/40 truncate leading-tight">{item.description}</div>
                                </div>
                              </div>

                              <div class={`absolute top-0.5 right-0.5 text-[6px] uppercase tracking-wider font-bold px-1 py-px rounded-full border ${style.badge} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                {style.label}
                              </div>
                            </button>
                          );
                        }}</For>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        );
      }}
    </Show>
  );
}

function StatMini(props: { label: string; value: number }) {
  return (
    <div class="rounded-md border border-white/10 bg-black/20 px-1.5 py-1 text-center">
      <div class="text-[8px] text-purple-300/55">{props.label}</div>
      <div class="text-[10px] text-white/90 font-semibold">{props.value}</div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function StatRow(props: { icon: any; label: string; value: number }) {
  return (
    <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5">
      {props.icon}
      <span class="text-[9px] text-white/50 flex-1">{props.label}</span>
      <span class="text-[10px] text-white/80 font-mono font-semibold">{props.value}</span>
    </div>
  );
}

function HpAdjustBtn(props: { unitId: string; delta: number; label: string; tone: "red" | "green" }) {
  const toneClass = () =>
    props.tone === "red"
      ? "text-red-200 bg-red-500/15 hover:bg-red-500/25 border-red-500/30"
      : "text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30";
  const apply = async () => {
    try {
      await dmAdjustHp(props.unitId, props.delta);
    } catch (err) {
      console.warn("[DM] dmAdjustHp failed", err);
    }
  };
  return (
    <button
      onClick={apply}
      class={`px-1.5 py-0.5 rounded border text-[9px] font-mono cursor-pointer transition-colors ${toneClass()}`}
      title={props.delta > 0 ? `Soigner ${props.delta}` : `Infliger ${Math.abs(props.delta)} dégâts`}
    >
      {props.label}
    </button>
  );
}
