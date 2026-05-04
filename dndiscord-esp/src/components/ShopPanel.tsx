import { createSignal, onMount, For, Show, createMemo } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { X, ShoppingBag, Search, Coins } from "lucide-solid";
import { InventoryService } from "../services/inventory.service";
import { getCategoryStyle } from "../services/itemVisuals";
import ItemIcon from "./common/ItemIcon";
import type { Item, ItemCategory, WalletDto } from "../types/inventory";
import "../services/iconSetup";

interface ShopPanelProps {
  characterId: string;
  campaignId?: string;
  onClose: () => void;
}

const CATEGORY_FILTERS: Array<{ value: "all" | ItemCategory; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "Consumable", label: "Consommables" },
  { value: "Weapon", label: "Armes" },
  { value: "Armor", label: "Armures" },
  { value: "Tool", label: "Outils" },
  { value: "Magic", label: "Magie" },
];

export default function ShopPanel(props: ShopPanelProps) {
  const [catalog, setCatalog] = createSignal<Item[]>([]);
  const [wallet, setWallet] = createSignal<WalletDto | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [categoryFilter, setCategoryFilter] = createSignal<"all" | ItemCategory>("all");
  const [buyingId, setBuyingId] = createSignal<string | null>(null);
  const [feedback, setFeedback] = createSignal<{ id: string; ok: boolean; msg: string } | null>(null);

  onMount(async () => {
    try {
      const [items, w] = await Promise.all([
        InventoryService.getCatalog(),
        InventoryService.getWallet(props.characterId),
      ]);
      // only show items that are purchasable
      setCatalog(items.filter((i) => i.goldCost > 0));
      setWallet(w);
    } catch (err) {
      console.error("[ShopPanel] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  });

  const filteredCatalog = createMemo(() => {
    const q = search().trim().toLowerCase();
    const cat = categoryFilter();
    return catalog().filter((item) => {
      const matchCat = cat === "all" || item.category === cat;
      const matchQ = !q || item.name.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  });

  const canAfford = (item: Item) => (wallet()?.goldPieces ?? 0) >= item.goldCost;

  const handleBuy = async (item: Item) => {
    if (buyingId()) return;
    setBuyingId(item.id);
    setFeedback(null);
    try {
      const result = await InventoryService.buyItem(props.characterId, {
        itemId: item.id,
        quantity: 1,
        campaignId: props.campaignId,
      });
      setWallet((prev) => prev ? { ...prev, goldPieces: result.remainingGold } : prev);
      setFeedback({ id: item.id, ok: true, msg: `${item.name} acheté !` });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Achat impossible";
      setFeedback({ id: item.id, ok: false, msg });
    } finally {
      setBuyingId(null);
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: "0",
        "z-index": "1100",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        background: "rgba(0,0,0,0.65)",
        "backdrop-filter": "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div
        style={{
          width: "min(560px, 95vw)",
          "max-height": "85vh",
          display: "flex",
          "flex-direction": "column",
          background: "var(--ink-800, #14162B)",
          border: "1px solid rgba(255,255,255,0.08)",
          "border-radius": "16px",
          "box-shadow": "0 40px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "0.75rem",
            padding: "1rem 1.25rem",
            "border-bottom": "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,224,138,0.05)",
          }}
        >
          <ShoppingBag class="w-5 h-5 text-yellow-300" />
          <span style={{ flex: 1, "font-weight": "700", "font-size": "1rem", color: "#F5F1E4" }}>
            Boutique de l'aventurier
          </span>

          {/* Gold balance */}
          <Show when={wallet()}>
            <div
              class="flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)" }}
            >
              <Icon icon="game-icons:gold-stack" class="w-4 h-4 text-yellow-300" />
              <span style={{ "font-size": "0.85rem", "font-weight": "700", color: "#fde047", "font-variant-numeric": "tabular-nums" }}>
                {wallet()!.goldPieces} PO
              </span>
            </div>
          </Show>

          <button
            onClick={props.onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              display: "flex",
            }}
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        {/* Search + filters */}
        <div style={{ padding: "0.75rem 1.25rem", "border-bottom": "1px solid rgba(255,255,255,0.05)" }}>
          <div class="relative mb-2">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-sm text-white/80 placeholder-white/25 outline-none focus:border-yellow-400/40"
            />
          </div>
          <div class="flex gap-1.5 flex-wrap">
            <For each={CATEGORY_FILTERS}>
              {(f) => (
                <button
                  onClick={() => setCategoryFilter(f.value)}
                  class="px-2 py-0.5 rounded-md text-xs transition-colors"
                  style={{
                    background: categoryFilter() === f.value ? "rgba(234,179,8,0.25)" : "rgba(255,255,255,0.06)",
                    border: categoryFilter() === f.value ? "1px solid rgba(234,179,8,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: categoryFilter() === f.value ? "#fde047" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {f.label}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Item grid */}
        <div style={{ flex: 1, "overflow-y": "auto", padding: "0.75rem 1.25rem" }}>
          <Show when={loading()}>
            <p class="text-center text-white/30 text-sm py-8">Chargement…</p>
          </Show>

          <Show when={!loading() && filteredCatalog().length === 0}>
            <p class="text-center text-white/30 text-sm py-8">Aucun article disponible.</p>
          </Show>

          <Show when={!loading() && filteredCatalog().length > 0}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "0.5rem" }}>
              <For each={filteredCatalog()}>
                {(item) => {
                  const style = getCategoryStyle(item.category);
                  const affordable = () => canAfford(item);
                  const isBuying = () => buyingId() === item.id;
                  const fb = () => feedback()?.id === item.id ? feedback() : null;

                  return (
                    <div
                      class={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${style.gradient} ring-1 ${style.ring} transition-opacity`}
                      style={{ opacity: affordable() ? "1" : "0.55" }}
                    >
                      {/* Icon */}
                      <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-black/30">
                        <ItemIcon iconKey={item.icon} class="w-6 h-6" />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, "min-width": 0 }}>
                        <div class="flex items-center gap-2">
                          <span
                            class="font-semibold text-sm truncate"
                            style={{ color: "#F5F1E4" }}
                          >
                            {item.name}
                          </span>
                          <span
                            class={`text-[10px] px-1.5 py-0.5 rounded border ${style.badge} flex-shrink-0`}
                          >
                            {style.label}
                          </span>
                        </div>
                        <p class="text-xs text-white/45 truncate mt-0.5">{item.description}</p>

                        <Show when={fb()}>
                          <p
                            class="text-[11px] mt-1 font-medium"
                            style={{ color: fb()!.ok ? "#4ade80" : "#f87171" }}
                          >
                            {fb()!.msg}
                          </p>
                        </Show>
                      </div>

                      {/* Price + buy */}
                      <div class="flex-shrink-0 flex flex-col items-end gap-1.5">
                        <div class="flex items-center gap-1">
                          <Icon icon="game-icons:gold-stack" class="w-3.5 h-3.5 text-yellow-300" />
                          <span
                            style={{
                              "font-size": "0.85rem",
                              "font-weight": "700",
                              color: affordable() ? "#fde047" : "#f87171",
                              "font-variant-numeric": "tabular-nums",
                            }}
                          >
                            {item.goldCost} PO
                          </span>
                        </div>
                        <button
                          disabled={!affordable() || isBuying()}
                          onClick={() => handleBuy(item)}
                          class="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: affordable() ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.05)",
                            border: affordable() ? "1px solid rgba(234,179,8,0.4)" : "1px solid rgba(255,255,255,0.1)",
                            color: affordable() ? "#fde047" : "rgba(255,255,255,0.3)",
                          }}
                        >
                          <Coins class="w-3 h-3" />
                          {isBuying() ? "…" : "Acheter"}
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: "0.6rem 1.25rem",
            "border-top": "1px solid rgba(255,255,255,0.05)",
            "font-size": "0.7rem",
            color: "rgba(255,255,255,0.25)",
            "text-align": "center",
          }}
        >
          Les articles en rouge sont hors de portée de votre bourse.
        </div>
      </div>
    </div>
  );
}
