import { Show, type Component } from "solid-js";
import { X, Plus, Check, ShoppingCart } from "lucide-solid";
import type { ShopItem } from "../../data/shopCatalog";
import { formatPrice } from "../../data/shopCatalog";
import { shopCart } from "../../stores/shopCart.store";

interface Props {
  item: ShopItem | null;
  onClose: () => void;
  onAdd: () => void;
  added: boolean;
}

const AuraPreviewModal: Component<Props> = (props) => {
  const glow = () =>
    props.item?.preview.kind === "aura"
      ? (props.item.preview as { kind: "aura"; glow: string }).glow
      : "";

  const inCart = () =>
    !!shopCart.resolvedLines().find((rl) => rl.item.id === props.item?.id);
  const qty = () =>
    shopCart.resolvedLines().find((rl) => rl.item.id === props.item?.id)?.line.quantity ?? 0;
  const atMax = () => qty() >= (props.item?.maxQuantity ?? 1);

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).dataset.backdrop) props.onClose();
  }

  return (
    <Show when={props.item !== null}>
      {/* Backdrop */}
      <div
        data-backdrop="true"
        onClick={handleBackdrop}
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        style={{ animation: "auraModalFadeIn 200ms ease-out" }}
      >
        {/* Panel */}
        <div
          class="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10"
          style={{
            background: "linear-gradient(160deg, #12112A 0%, #1A1832 60%, #0F0E20 100%)",
            animation: "auraModalSlideUp 220ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Close */}
          <button
            type="button"
            onClick={props.onClose}
            class="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors focus-ring-gold"
            aria-label="Close"
          >
            <X class="w-4 h-4" />
          </button>

          {/* Portrait stage */}
          <div class="relative flex items-center justify-center py-10 px-6 bg-gradient-to-b from-ink-900/80 to-transparent overflow-hidden">
            {/* Background ambient glow matching the aura colour */}
            <div
              class="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% 60%, ${extractGlowColor(glow())} 0%, transparent 70%)`,
                opacity: "0.35",
              }}
            />

            {/* Pulsing ring behind portrait */}
            <div
              class="absolute w-44 h-44 rounded-full pointer-events-none"
              style={{
                "box-shadow": glow(),
                animation: "auraPulse 2.4s ease-in-out infinite",
                opacity: "0.5",
              }}
            />

            {/* Portrait */}
            <img
              src="/assets/classes/rogue.png"
              alt="Character portrait"
              class="relative z-10 w-40 h-40 rounded-full object-cover border-2 border-white/20"
              style={{ "box-shadow": glow() }}
            />
          </div>

          {/* Content */}
          <div class="px-6 pb-6 space-y-4">
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-display text-2xl text-white tracking-wide leading-tight">
                {props.item!.title}
              </h3>
              <span class="font-display text-xl text-gold-300 whitespace-nowrap pt-0.5">
                {formatPrice(props.item!.priceCents)}
              </span>
            </div>

            <p class="text-sm text-slate-300/80 leading-relaxed">
              {props.item!.description}
            </p>

            {/* CTA */}
            <div class="flex items-center gap-3 pt-1">
              <Show when={inCart()}>
                <span class="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <Check class="w-3.5 h-3.5" />
                  {qty()} in cart
                </span>
              </Show>
              <button
                type="button"
                onClick={props.onAdd}
                disabled={atMax()}
                class={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 focus-ring-gold ${
                  props.added
                    ? "bg-emerald-500 text-white scale-95"
                    : atMax()
                      ? "bg-white/10 text-slate-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-500 text-white hover:-translate-y-0.5 shadow-lg shadow-purple-900/40"
                }`}
              >
                <Show
                  when={props.added}
                  fallback={
                    <>
                      <Show when={!inCart()} fallback={<ShoppingCart class="w-4 h-4" />}>
                        <Plus class="w-4 h-4" />
                      </Show>
                      {atMax() ? "Already in cart" : inCart() ? "Add another" : "Add to cart"}
                    </>
                  }
                >
                  <Check class="w-4 h-4" /> Added!
                </Show>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes auraModalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes auraModalSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes auraPulse {
          0%, 100% { transform: scale(0.95); opacity: 0.4; }
          50%       { transform: scale(1.08); opacity: 0.65; }
        }
      `}</style>
    </Show>
  );
};

/** Extract a rough rgba colour from a box-shadow string for the ambient background. */
function extractGlowColor(glow: string): string {
  const match = glow.match(/rgba\([^)]+\)/);
  return match ? match[0] : "rgba(169,104,174,0.4)";
}

export default AuraPreviewModal;
