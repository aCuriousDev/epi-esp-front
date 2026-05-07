import { Show, type Component } from "solid-js";
import { X, ShoppingCart, Plus, Check } from "lucide-solid";
import type { ShopItem } from "../../data/shopCatalog";
import { formatPrice } from "../../data/shopCatalog";
import { shopCart } from "../../stores/shopCart.store";

/**
 * Full-screen overlay modal that shows a dice skin in large format
 * with its design description and an add-to-cart CTA.
 */

/** Short flavour text describing each skin's design — keyed by item id. */
const DESIGN_LORE: Record<string, string> = {
  "dice-onyx-gold":
    "Carved from pure obsidian and edged in 24-karat gold leaf, the Onyx & Gold set radiates understated prestige. Each face is mirror-polished to catch the candlelight of the tavern where your campaign began.",
  "dice-arcane-crimson":
    "Forged in crimson resin swirled with violet mana sparks, these dice channel the raw energy of a freshly cast spell. The golden engravings glow faintly under arcane illumination — a sorcerer's favourite companion.",
  "dice-verdant-grove":
    "Cut from enchanted malachite found deep in the Verdant Grove, these dice carry the scent of pine and rain. Bronze-inlaid numbers recall the ranger's compass, always pointing toward the next horizon.",
  "dice-frostforged":
    "Cooled in the glacial springs of the northern peaks, these dice carry a faint inner luminescence. The pale blue faces whisper of winter storms, and each roll feels like cracking ancient ice.",
  "dice-royal-saffron":
    "Struck from solid saffron gold and inscribed with the court's own calligraphy, the Royal Saffron set is the choice of kings and seasoned commanders. Heavy, warm, and unmistakably regal.",
  "dice-mythic-pack":
    "An artefact of impossible craft — every face of the Mythic Pack shifts through the full spectrum of elemental power. Crimson. Frost. Verdant. Gold. Void. All five essences bound into one legendary set that defies the laws of material planes.",
};

interface Props {
  item: ShopItem | null;
  onClose: () => void;
  onAdd: () => void;
  added: boolean;
}

const DicePreviewModal: Component<Props> = (props) => {
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
        style={{ animation: "modalFadeIn 200ms ease-out" }}
      >
        {/* Panel */}
        <div
          class="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10"
          style={{
            background: "linear-gradient(160deg, #12112A 0%, #1A1832 60%, #0F0E20 100%)",
            animation: "modalSlideUp 220ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={props.onClose}
            class="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors focus-ring-gold"
            aria-label="Close"
          >
            <X class="w-4 h-4" />
          </button>

          {/* Hero image */}
          <div class="relative w-full h-64 sm:h-72 bg-black/40 overflow-hidden">
            <Show
              when={props.item!.image}
              fallback={
                <div
                  class="w-full h-full"
                  style={{ background: (props.item!.preview as { bg?: string }).bg ?? "#1A1A2E" }}
                />
              }
            >
              <img
                src={props.item!.image}
                alt={props.item!.title}
                class="w-full h-full object-cover object-center"
              />
            </Show>
            {/* Gradient bottom fade */}
            <div class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#12112A] to-transparent pointer-events-none" />

            {/* Tag badge */}
            <Show when={props.item!.tag}>
              <span class="absolute top-3 left-3 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-plum-700/80 border border-plum-300/40 text-plum-300">
                {props.item!.tag}
              </span>
            </Show>
          </div>

          {/* Content */}
          <div class="px-6 pb-6 -mt-2 space-y-4">
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-display text-2xl text-white tracking-wide leading-tight">
                {props.item!.title}
              </h3>
              <span class="font-display text-xl text-gold-300 whitespace-nowrap pt-0.5">
                {formatPrice(props.item!.priceCents)}
              </span>
            </div>

            {/* Short description */}
            <p class="text-sm text-slate-300/80 leading-relaxed">
              {props.item!.description}
            </p>

            {/* Lore / design description */}
            <Show when={DESIGN_LORE[props.item!.id]}>
              <div class="rounded-xl bg-white/5 border border-white/8 p-4">
                <p class="text-xs text-slate-400 leading-relaxed italic">
                  {DESIGN_LORE[props.item!.id]}
                </p>
              </div>
            </Show>

            {/* CTA row */}
            <div class="flex items-center gap-3 pt-1">
              <Show when={inCart()}>
                <span class="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <Check class="w-3.5 h-3.5" />
                  {qty()} in cart
                </span>
              </Show>
              <button
                type="button"
                onClick={() => { props.onAdd(); }}
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
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </Show>
  );
};

export default DicePreviewModal;
