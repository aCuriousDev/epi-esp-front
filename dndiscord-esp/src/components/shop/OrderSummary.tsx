import { For, Show, type Component } from "solid-js";
import { ReceiptText } from "lucide-solid";
import { shopCart } from "../../stores/shopCart.store";
import { formatPrice, getCountry } from "../../data/shopCatalog";
import ShopItemPreview from "./ShopItemPreview";

interface Props {
  /** When provided, VAT is computed for this country code. */
  countryCode?: string;
  /** Compact mode hides line previews (used in narrow screens / step header). */
  compact?: boolean;
  /** Optional title override (defaults to "Order summary"). */
  title?: string;
}

/**
 * Reusable order summary block, used on the cart page and at every step
 * of the checkout flow. Reads its data straight from the cart store.
 */
export const OrderSummary: Component<Props> = (props) => {
  const country = () => (props.countryCode ? getCountry(props.countryCode) : null);
  const subtotal = () => shopCart.subtotalCents();
  const taxCents = () =>
    props.countryCode ? shopCart.taxCentsFor(props.countryCode) : 0;
  const total = () =>
    props.countryCode ? shopCart.totalCentsFor(props.countryCode) : subtotal();

  return (
    <aside class="relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl shadow-black/30">
      <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
      <div class="relative z-10 space-y-4">
        <h3 class="flex items-center gap-2 font-display text-lg text-white tracking-wide">
          <ReceiptText class="w-4 h-4 text-gold-300" />
          {props.title ?? "Order summary"}
        </h3>

        <Show
          when={!shopCart.isEmpty()}
          fallback={<p class="text-sm text-slate-400">Your cart is empty.</p>}
        >
          <ul class="divide-y divide-white/5">
            <For each={shopCart.resolvedLines()}>
              {(rl) => (
                <li class="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                  <Show when={!props.compact}>
                    <ShopItemPreview item={rl.item} size="thumb" />
                  </Show>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-white truncate">{rl.item.title}</p>
                    <p class="text-xs text-slate-400">
                      Qty {rl.line.quantity} ·{" "}
                      <span class="text-slate-300">
                        {formatPrice(rl.item.priceCents)}
                      </span>
                    </p>
                  </div>
                  <span class="text-sm font-semibold text-white tabular-nums">
                    {formatPrice(rl.lineTotalCents)}
                  </span>
                </li>
              )}
            </For>
          </ul>

          <div class="space-y-1 text-sm pt-2 border-t border-white/10">
            <Row label="Subtotal" value={formatPrice(subtotal())} />
            <Show
              when={props.countryCode}
              fallback={
                <p class="text-xs text-slate-400 italic">
                  Tax calculated at checkout.
                </p>
              }
            >
              <Row
                label={
                  country()?.isEU
                    ? `VAT (20% — ${country()?.name})`
                    : `Tax (${country()?.name ?? props.countryCode})`
                }
                value={formatPrice(taxCents())}
                muted={taxCents() === 0}
              />
            </Show>
            <div class="flex items-center justify-between pt-2 border-t border-white/10">
              <span class="font-display text-base text-white tracking-wide">
                Total
              </span>
              <span class="font-display text-lg text-gold-300 tabular-nums">
                {formatPrice(total())}
              </span>
            </div>
          </div>
        </Show>
      </div>
    </aside>
  );
};

const Row: Component<{ label: string; value: string; muted?: boolean }> = (p) => (
  <div class="flex items-center justify-between">
    <span class={`text-slate-300 ${p.muted ? "opacity-70" : ""}`}>{p.label}</span>
    <span class={`tabular-nums ${p.muted ? "text-slate-400" : "text-white"}`}>
      {p.value}
    </span>
  </div>
);

export default OrderSummary;
