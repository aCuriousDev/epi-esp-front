import { Match, Show, Switch, type Component } from "solid-js";
import { Beer, Coffee, Crown, Dices, Heart } from "lucide-solid";
import type { ShopItem, TipPreview } from "../../data/shopCatalog";

interface Props {
  item: ShopItem;
  /** Visual size — `card` for catalog cards, `thumb` for cart line items. */
  size?: "card" | "thumb";
}

/**
 * Renders a category-aware preview of a shop item.
 *
 * The same component is used in:
 *   - the catalog cards (large)
 *   - the cart and order-summary line items (thumbnail)
 */
export const ShopItemPreview: Component<Props> = (props) => {
  const isThumb = () => props.size === "thumb";

  return (
    <Switch>
      <Match when={props.item.preview.kind === "dice"}>
        <Show
          when={props.item.image && !isThumb()}
          fallback={
            <DicePreview
              bg={(props.item.preview as { kind: "dice"; bg: string; diceColor: string }).bg}
              color={
                (props.item.preview as { kind: "dice"; bg: string; diceColor: string })
                  .diceColor
              }
              thumb={isThumb()}
            />
          }
        >
          <DiceImagePreview src={props.item.image!} alt={props.item.title} />
        </Show>
      </Match>
      <Match when={props.item.preview.kind === "title"}>
        <TitlePreview
          color={(props.item.preview as { kind: "title"; color: string; label: string }).color}
          label={
            (props.item.preview as { kind: "title"; color: string; label: string }).label
          }
          thumb={isThumb()}
        />
      </Match>
      <Match when={props.item.preview.kind === "aura"}>
        <AuraPreview
          glow={(props.item.preview as { kind: "aura"; glow: string }).glow}
          thumb={isThumb()}
        />
      </Match>
      <Match when={props.item.preview.kind === "tip"}>
        <TipIconPreview preview={props.item.preview as TipPreview} thumb={isThumb()} />
      </Match>
    </Switch>
  );
};

const DiceImagePreview: Component<{ src: string; alt: string }> = (p) => (
  <div class="w-full h-36 rounded-xl overflow-hidden relative bg-black/40">
    <img
      src={p.src}
      alt={p.alt}
      class="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
      loading="lazy"
    />
    {/* subtle vignette overlay so the card text below doesn't clash */}
    <div class="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-game-dark/70 to-transparent pointer-events-none" />
  </div>
);

const DicePreview: Component<{ bg: string; color: string; thumb: boolean }> = (p) => (
  <div
    class={`rounded-xl grid place-items-center ${
      p.thumb ? "w-14 h-14 shrink-0" : "w-full h-24"
    }`}
    style={{ background: p.bg }}
  >
    <Dices
      class={p.thumb ? "w-6 h-6" : "w-10 h-10"}
      style={{ color: p.color, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
    />
  </div>
);

const TitlePreview: Component<{ color: string; label: string; thumb: boolean }> = (
  p,
) => (
  <div
    class={`rounded-xl grid place-items-center bg-gradient-to-br from-plum-900/60 to-arcindigo-900/60 border border-white/5 ${
      p.thumb ? "w-14 h-14 shrink-0 px-1" : "w-full h-24"
    }`}
  >
    <span
      class={
        p.thumb
          ? "font-display text-[9px] tracking-[0.18em] uppercase text-center leading-tight"
          : "font-display text-lg tracking-[0.2em] uppercase"
      }
      style={{ color: p.color }}
    >
      {p.thumb ? "« A »" : `« ${p.label} »`}
    </span>
  </div>
);

const AuraPreview: Component<{ glow: string; thumb: boolean }> = (p) => (
  <div
    class={`rounded-xl grid place-items-center bg-ink-900/60 border border-white/5 relative overflow-hidden ${
      p.thumb ? "w-14 h-14 shrink-0" : "w-full h-24"
    }`}
  >
    <img
      src="/assets/classes/rogue.png"
      alt="Character portrait preview"
      class={`rounded-full object-cover border-2 border-white/20 ${
        p.thumb ? "w-9 h-9" : "w-14 h-14"
      }`}
      style={{ "box-shadow": p.glow }}
    />
  </div>
);

const TipIconPreview: Component<{ preview: TipPreview; thumb: boolean }> = (p) => {
  const Icon =
    p.preview.icon === "coffee"
      ? Coffee
      : p.preview.icon === "beer"
        ? Beer
        : p.preview.icon === "heart"
          ? Heart
          : Crown;
  const tone = p.preview.highlighted
    ? "from-amber-500/30 to-amber-600/10 border-amber-300/40 text-amber-200"
    : "from-amber-500/15 to-amber-600/5 border-amber-300/20 text-amber-300";

  return (
    <div
      class={`rounded-xl grid place-items-center bg-gradient-to-br border ${tone} ${
        p.thumb ? "w-14 h-14 shrink-0" : "w-full h-24"
      }`}
    >
      <Icon class={p.thumb ? "w-6 h-6" : "w-10 h-10"} />
    </div>
  );
};

export default ShopItemPreview;
