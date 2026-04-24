import {
  createSignal,
  onCleanup,
  onMount,
  For,
  Show,
  createMemo,
} from "solid-js";
import {
  Package,
  Trash2,
  Plus,
  Gift,
  X,
  Sparkles,
  Search,
  Check,
  Beaker,
} from "lucide-solid";
import { InventoryService } from "../services/inventory.service";
import { signalRService } from "../services/signalr/SignalRService";
import { getCategoryStyle } from "../services/itemVisuals";
import { sessionState } from "../stores/session.store";
import ItemIcon from "./common/ItemIcon";
import type {
  InventoryChangedEvent,
  InventoryEntry,
  Item,
  ItemCategory,
} from "../types/inventory";

interface InventoryPanelProps {
  characterId: string;
  isMJ?: boolean;
}

interface RevealItem {
  id: number;
  name: string;
  description: string;
  iconKey: string;
  quantity: number;
  category: ItemCategory;
}

const CATEGORY_FILTERS: Array<{ value: "all" | ItemCategory; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "Consumable", label: "Consommables" },
  { value: "Weapon", label: "Armes" },
  { value: "Armor", label: "Armures" },
  { value: "Tool", label: "Outils" },
  { value: "Magic", label: "Magie" },
  { value: "Treasure", label: "Trésors" },
];

/**
 * Panneau d'inventaire pour la fiche personnage (POC).
 */
export default function InventoryPanel(props: InventoryPanelProps) {
  const [entries, setEntries] = createSignal<InventoryEntry[]>([]);
  const [catalog, setCatalog] = createSignal<Item[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const [showCatalog, setShowCatalog] = createSignal(false);
  const [catalogSearch, setCatalogSearch] = createSignal("");
  const [catalogFilter, setCatalogFilter] = createSignal<"all" | ItemCategory>(
    "all",
  );

  const [categoryFilter, setCategoryFilter] = createSignal<"all" | ItemCategory>(
    "all",
  );
  const [removingId, setRemovingId] = createSignal<string | null>(null);
  const [highlightId, setHighlightId] = createSignal<string | null>(null);
  const [givenItemId, setGivenItemId] = createSignal<string | null>(null);
  const [usingId, setUsingId] = createSignal<string | null>(null);
  // Single in-flight guard so clicking item A then item B before A resolves
  // can't trigger a second give — per-item disabled wasn't enough.
  const [isGiving, setIsGiving] = createSignal(false);

  /** Campaign id for the current session (if any). Required by give + MJ-remove. */
  const currentCampaignId = () => sessionState.session?.campaignId ?? null;

  // Reveal overlay plein écran quand un objet est reçu
  const [reveal, setReveal] = createSignal<RevealItem | null>(null);
  const [revealPhase, setRevealPhase] = createSignal<"in" | "out">("in");
  let revealCounter = 0;
  let revealTimer1: number | undefined;
  let revealTimer2: number | undefined;

  const triggerReveal = (item: RevealItem) => {
    if (revealTimer1) clearTimeout(revealTimer1);
    if (revealTimer2) clearTimeout(revealTimer2);
    setRevealPhase("in");
    setReveal(item);
    revealTimer1 = window.setTimeout(() => setRevealPhase("out"), 1800);
    revealTimer2 = window.setTimeout(() => setReveal(null), 2200);
  };

  // ---- Data loading ----

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await InventoryService.getCharacterInventory(
        props.characterId,
      );
      setEntries(data);
    } catch (err) {
      console.error("Failed to load inventory", err);
      setError("Impossible de charger l'inventaire.");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const items = await InventoryService.getCatalog();
      setCatalog(items);
    } catch (err) {
      console.error("Failed to load catalog", err);
      // Surface the failure so the MJ sees why the "Don du MJ" catalog is
      // empty — without this the UI was indistinguishable from a backend
      // that simply has zero items seeded.
      setError("Impossible de charger le catalogue.");
    }
  };

  // ---- Actions ----

  const handleDrop = async (entry: InventoryEntry) => {
    setRemovingId(entry.id);
    // Pass campaignId when the MJ is removing from someone else's bag so the
    // back-side auth check accepts us. Owner removing their own stuff doesn't
    // need it.
    const campaignId = props.isMJ ? currentCampaignId() ?? undefined : undefined;
    try {
      await InventoryService.removeEntry(props.characterId, entry.id, campaignId);
      setTimeout(() => {
        if (entry.quantity > 1) {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, quantity: e.quantity - 1 } : e,
            ),
          );
        } else {
          setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        }
        setRemovingId(null);
      }, 260);
    } catch (err) {
      console.error("Failed to remove entry", err);
      setError("Impossible de jeter l'objet.");
      setRemovingId(null);
    }
  };

  const handleUse = async (entry: InventoryEntry) => {
    if (usingId()) return;
    setUsingId(entry.id);
    try {
      await InventoryService.useEntry(
        props.characterId,
        entry.id,
        currentCampaignId() ?? undefined,
      );
      // Success: InventoryChanged + InventoryItemUsed will update the UI via SignalR.
    } catch (err) {
      console.error("Failed to use entry", err);
      setError("Impossible d'utiliser cet objet.");
    } finally {
      setUsingId(null);
    }
  };

  const handleGive = async (item: Item) => {
    if (isGiving()) return;
    const campaignId = currentCampaignId();
    if (!campaignId) {
      setError("Vous devez être dans une session pour donner un objet.");
      return;
    }
    setIsGiving(true);
    setGivenItemId(item.id);
    try {
      await InventoryService.giveItem(props.characterId, {
        itemId: item.id,
        quantity: 1,
        campaignId,
      });
      // Flash "Offert !" stays visible briefly before clearing.
      feedbackTimer = window.setTimeout(() => {
        setGivenItemId(null);
        setIsGiving(false);
        feedbackTimer = undefined;
      }, 1200);
    } catch (err) {
      console.error("Failed to give item", err);
      setError("Impossible d'ajouter l'objet.");
      setGivenItemId(null);
      setIsGiving(false);
    }
  };

  let feedbackTimer: number | undefined;

  // ---- SignalR event handling ----

  const handleInventoryChanged = (evt: InventoryChangedEvent) => {
    if (evt.characterId !== props.characterId) return;

    if (evt.action === "Added") {
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === evt.entry.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = evt.entry;
          return copy;
        }
        return [...prev, evt.entry].sort((a, b) =>
          a.item.name.localeCompare(b.item.name),
        );
      });

      setHighlightId(evt.entry.id);
      setTimeout(() => setHighlightId(null), 2400);

      triggerReveal({
        id: ++revealCounter,
        name: evt.entry.item.name,
        description: evt.entry.item.description,
        iconKey: evt.entry.item.icon,
        quantity: evt.entry.quantity,
        category: evt.entry.item.category,
      });
    } else if (evt.action === "Updated") {
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.id === evt.entry.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = evt.entry;
          return copy;
        }
        return prev;
      });
    } else if (evt.action === "Removed") {
      setEntries((prev) => prev.filter((e) => e.id !== evt.entry.id));
    }
  };

  let unsubscribe: (() => void) | null = null;
  let retryInterval: number | undefined;
  let retryTimeout: number | undefined;

  onMount(async () => {
    await loadInventory();
    if (props.isMJ) await loadCatalog();

    const subscribe = () => {
      unsubscribe = InventoryService.onInventoryChanged(handleInventoryChanged);
    };

    if (signalRService.isConnected) {
      subscribe();
    } else {
      // Poll for a connection up to 5 s. Track the timer ids so onCleanup can
      // clear them if the component unmounts during the retry window.
      retryInterval = window.setInterval(() => {
        if (signalRService.isConnected) {
          if (retryInterval) window.clearInterval(retryInterval);
          retryInterval = undefined;
          if (retryTimeout) window.clearTimeout(retryTimeout);
          retryTimeout = undefined;
          subscribe();
        }
      }, 500);
      retryTimeout = window.setTimeout(() => {
        if (retryInterval) window.clearInterval(retryInterval);
        retryInterval = undefined;
      }, 5000);
    }
  });

  onCleanup(() => {
    if (unsubscribe) unsubscribe();
    if (revealTimer1) clearTimeout(revealTimer1);
    if (revealTimer2) clearTimeout(revealTimer2);
    if (feedbackTimer) window.clearTimeout(feedbackTimer);
    if (retryInterval) window.clearInterval(retryInterval);
    if (retryTimeout) window.clearTimeout(retryTimeout);
  });

  // ---- Derived ----

  const filteredEntries = createMemo(() => {
    const filter = categoryFilter();
    if (filter === "all") return entries();
    return entries().filter((e) => e.item.category === filter);
  });

  const totalItems = createMemo(() =>
    entries().reduce((sum, e) => sum + e.quantity, 0),
  );

  const filteredCatalog = createMemo(() => {
    const q = catalogSearch().trim().toLowerCase();
    const cat = catalogFilter();
    return catalog().filter((item) => {
      if (cat !== "all" && item.category !== cat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  });

  return (
    <>
      <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 via-yellow-500/20 to-orange-500/30 border border-amber-400/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Package class="w-6 h-6 text-amber-300" />
            </div>
            <h2 class="font-display text-2xl text-white leading-tight">
              Inventaire
            </h2>
          </div>

          <Show when={props.isMJ}>
            <button
              onClick={() => setShowCatalog(true)}
              class="group px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/30 text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
            >
              <Gift class="w-4 h-4 group-hover:rotate-12 transition-transform" />
              Don du MJ
            </button>
          </Show>
        </div>

        {/* Category filter chips */}
        <div class="flex flex-wrap gap-2 mb-5">
          <For each={CATEGORY_FILTERS}>
            {(f) => (
              <button
                onClick={() => setCategoryFilter(f.value)}
                class={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  categoryFilter() === f.value
                    ? "bg-white/15 border-white/30 text-white shadow-sm"
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            )}
          </For>
        </div>

        <Show when={error()}>
          <div class="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            {error()}
          </div>
        </Show>

        {/* Grid of items */}
        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center justify-center py-16">
              <div class="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          }
        >
          <Show
            when={filteredEntries().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="mb-3 opacity-30">
                  <ItemIcon iconKey="" size="4rem" class="text-slate-400" />
                </div>
                <p class="text-slate-400 text-sm">
                  {entries().length === 0
                    ? "L'inventaire est vide. Demandez au MJ de vous offrir un objet !"
                    : "Aucun objet dans cette catégorie."}
                </p>
              </div>
            }
          >
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <For each={filteredEntries()}>
                {(entry) => {
                  const style = getCategoryStyle(entry.item.category);
                  const isRemoving = () => removingId() === entry.id;
                  const isHighlighted = () => highlightId() === entry.id;
                  return (
                    <div
                      class={`group relative rounded-2xl overflow-hidden border border-white/10 ring-1 ${
                        style.ring
                      } bg-gradient-to-br ${style.gradient} backdrop-blur-sm p-4 shadow-lg ${
                        style.glow
                      } transition-all duration-500 ${
                        isRemoving()
                          ? "opacity-0 scale-75 -translate-y-4 blur-sm"
                          : isHighlighted()
                            ? "scale-[1.05] ring-4 ring-amber-300/80 shadow-2xl shadow-amber-500/50 animate-pulse"
                            : "hover:scale-[1.02] hover:ring-2"
                      }`}
                    >
                      {/* Category badge */}
                      <div
                        class={`absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${style.badge}`}
                      >
                        {style.label}
                      </div>

                      {/* Top-right: quantity badge + trash icon */}
                      <div class="absolute top-2 right-2 flex items-center gap-1.5">
                        <Show when={entry.quantity > 1}>
                          <div class="min-w-[24px] h-6 px-2 rounded-full bg-black/50 backdrop-blur border border-white/20 flex items-center justify-center text-xs font-bold text-white">
                            ×{entry.quantity}
                          </div>
                        </Show>
                        <Show when={props.isMJ}>
                          <button
                            onClick={() => handleDrop(entry)}
                            class="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 flex items-center justify-center transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Jeter"
                          >
                            <Trash2 class="w-3 h-3 text-red-400" />
                          </button>
                        </Show>
                      </div>

                      {/* Item icon */}
                      <div class="flex items-center justify-center h-20 mt-4 mb-3 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300">
                        <ItemIcon iconKey={entry.item.icon} size="4rem" class={style.text} />
                      </div>

                      {/* Name + desc */}
                      <div class="text-center">
                        <div class={`font-bold text-sm ${style.text}`}>
                          {entry.item.name}
                        </div>
                        <div class="text-[11px] text-slate-300/80 mt-1 line-clamp-2 min-h-[28px]">
                          {entry.item.description}
                        </div>
                      </div>

                      {/* Use button on consumables (owner-only — the back enforces) */}
                      <Show when={entry.item.category === "Consumable"}>
                        <button
                          onClick={() => handleUse(entry)}
                          disabled={usingId() === entry.id}
                          class="mt-2 py-1 w-full rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-[10px] font-semibold text-emerald-200 flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Beaker class="w-3 h-3" />
                          {usingId() === entry.id ? "…" : "Utiliser"}
                        </button>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Catalog modal */}
      <Show when={showCatalog()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowCatalog(false)}
        >
          <div
            class="bg-game-dark/95 border border-white/15 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div class="p-6 border-b border-white/10 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/40 to-indigo-500/40 border border-purple-400/30 flex items-center justify-center">
                  <Sparkles class="w-5 h-5 text-purple-200" />
                </div>
                <div>
                  <h3 class="font-display text-xl text-white">
                    Catalogue du MJ
                  </h3>
                  <p class="text-xs text-slate-400">
                    Choisissez un objet à offrir au joueur
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCatalog(false)}
                class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            {/* Search + filters */}
            <div class="p-4 border-b border-white/10 space-y-3">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={catalogSearch()}
                  onInput={(e) => setCatalogSearch(e.currentTarget.value)}
                  placeholder="Rechercher un objet…"
                  class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-400/50 focus:bg-white/10 transition-colors"
                />
              </div>
              <div class="flex flex-wrap gap-2">
                <For each={CATEGORY_FILTERS}>
                  {(f) => (
                    <button
                      onClick={() => setCatalogFilter(f.value)}
                      class={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        catalogFilter() === f.value
                          ? "bg-white/15 border-white/30 text-white"
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Modal body */}
            <div class="p-4 overflow-y-auto">
              <Show
                when={filteredCatalog().length > 0}
                fallback={
                  <div class="py-12 text-center text-slate-400 text-sm">
                    Aucun objet ne correspond à votre recherche.
                  </div>
                }
              >
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <For each={filteredCatalog()}>
                    {(item) => {
                      const style = getCategoryStyle(item.category);
                      const justGiven = () => givenItemId() === item.id;
                      return (
                        <div
                          class={`group relative rounded-2xl overflow-hidden border ring-1 p-3 text-left transition-all shadow-lg ${style.glow} ${
                            justGiven()
                              ? "border-emerald-400/50 ring-emerald-400/40 bg-gradient-to-br from-emerald-500/30 via-green-500/20 to-emerald-600/30 scale-95"
                              : `border-white/10 ${style.ring} bg-gradient-to-br ${style.gradient}`
                          }`}
                        >
                          {/* Flash "Offert !" overlay */}
                          <Show when={justGiven()}>
                            <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-emerald-900/70 backdrop-blur-sm rounded-2xl">
                              <div class="w-10 h-10 rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center mb-2">
                                <Check class="w-6 h-6 text-emerald-300" />
                              </div>
                              <span class="text-emerald-200 text-sm font-bold">
                                Offert !
                              </span>
                            </div>
                          </Show>
                          <div
                            class={`absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border ${style.badge}`}
                          >
                            {style.label}
                          </div>
                          <div class="flex items-center justify-center h-14 mt-3 mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                            <ItemIcon iconKey={item.icon} size="3rem" class={style.text} />
                          </div>
                          <div class="text-center">
                            <div class={`font-bold text-xs ${style.text}`}>
                              {item.name}
                            </div>
                            <div class="text-[10px] text-slate-300/70 line-clamp-2 mt-0.5">
                              {item.description}
                            </div>
                          </div>
                          <button
                            onClick={() => handleGive(item)}
                            disabled={justGiven() || isGiving()}
                            class="mt-2 py-1 w-full rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-center text-[10px] font-semibold text-white flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus class="w-3 h-3" />
                            Offrir
                          </button>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Reveal overlay — effet dramatique plein écran quand un objet est reçu */}
      <Show when={reveal()}>
        {(revealItem) => {
          const style = getCategoryStyle(revealItem().category);
          return (
            <div
              class={`fixed inset-0 z-[70] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
                revealPhase() === "in" ? "opacity-100" : "opacity-0"
              }`}
            >
              {/* Dim backdrop */}
              <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

              {/* Radial glow burst */}
              <div
                class={`absolute w-[600px] h-[600px] rounded-full bg-gradient-radial ${style.gradient} blur-3xl opacity-80 animate-pulse`}
                style={{
                  background:
                    "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(168,85,247,0.3) 40%, transparent 70%)",
                }}
              />

              {/* Rotating rays */}
              <div
                class="absolute w-[500px] h-[500px] rounded-full opacity-40"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.3) 20deg, transparent 40deg, transparent 80deg, rgba(168,85,247,0.3) 100deg, transparent 120deg, transparent 160deg, rgba(251,191,36,0.3) 180deg, transparent 200deg, transparent 240deg, rgba(168,85,247,0.3) 260deg, transparent 280deg, transparent 320deg, rgba(251,191,36,0.3) 340deg, transparent 360deg)",
                  animation: "spin 8s linear infinite",
                }}
              />

              {/* Main card */}
              <div
                class={`relative flex flex-col items-center gap-4 px-10 py-8 rounded-3xl border-2 ${style.ring} bg-gradient-to-br ${style.gradient} backdrop-blur-xl shadow-2xl ${style.glow} transition-all duration-700 ${
                  revealPhase() === "in"
                    ? "scale-100 translate-y-0"
                    : "scale-90 translate-y-4"
                }`}
                style={{
                  "box-shadow":
                    "0 0 80px rgba(251,191,36,0.4), 0 0 160px rgba(168,85,247,0.3)",
                }}
              >
                {/* "Objet reçu !" banner */}
                <div class="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/30 backdrop-blur">
                  <Sparkles class="w-4 h-4 text-yellow-300 animate-pulse" />
                  <span class="text-white font-bold text-xs uppercase tracking-widest">
                    Objet reçu
                  </span>
                  <Sparkles class="w-4 h-4 text-yellow-300 animate-pulse" />
                </div>

                {/* Huge icon */}
                <div
                  class="leading-none drop-shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
                  style={{
                    animation:
                      "revealBounce 1.8s cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  <ItemIcon iconKey={revealItem().iconKey} size="10rem" class={style.text} />
                </div>

                {/* Name */}
                <div class="text-center">
                  <div
                    class={`font-display text-4xl font-bold ${style.text} drop-shadow-lg`}
                  >
                    {revealItem().name}
                  </div>
                  <Show when={revealItem().quantity > 1}>
                    <div class="text-white/90 text-xl font-bold mt-1">
                      ×{revealItem().quantity}
                    </div>
                  </Show>
                  <div class="text-slate-200/90 text-sm mt-2 max-w-xs">
                    {revealItem().description}
                  </div>
                </div>

                {/* Category badge */}
                <div
                  class={`text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full border ${style.badge}`}
                >
                  {style.label}
                </div>
              </div>
            </div>
          );
        }}
      </Show>

      {/* Keyframes inline pour l'animation d'apparition */}
      <style>{`
        @keyframes revealBounce {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          40% {
            transform: scale(1.3) rotate(15deg);
            opacity: 1;
          }
          60% {
            transform: scale(0.95) rotate(-5deg);
          }
          80% {
            transform: scale(1.05) rotate(2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </>
  );
}
