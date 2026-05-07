import { For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
  ArrowRight,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-solid";
import { shopCart } from "../stores/shopCart.store";
import { formatPrice } from "../data/shopCatalog";
import ShopHeader from "../components/shop/ShopHeader";
import ShopItemPreview from "../components/shop/ShopItemPreview";

/**
 * Shop Cart Page
 *
 * Reviews the current cart contents before the user moves on to the
 * multi-step checkout. Quantities are bounded by each item's `maxQuantity`
 * (cosmetics cap at 1; tip jar items can stack up to 20).
 */
export default function ShopCartPage() {
  const navigate = useNavigate();

  function handleCheckout() {
    if (shopCart.isEmpty()) return;
    navigate("/shop/checkout");
  }

  return (
    <div class="cart-page relative min-h-screen w-full overflow-y-auto">
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl" />
        <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl" />
      </div>
      <div class="vignette fixed inset-0 pointer-events-none" />

      <ShopHeader title="Your cart" hideCart />

      <main class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10 pb-24 space-y-6">
        <header class="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 class="font-display text-3xl text-white tracking-wide">
              Cart review
            </h2>
            <p class="text-sm text-slate-400 mt-1">
              <Show
                when={!shopCart.isEmpty()}
                fallback="Your cart is empty for now."
              >
                {shopCart.itemCount()}{" "}
                {shopCart.itemCount() === 1 ? "item" : "items"} ready to check out.
              </Show>
            </p>
          </div>

          <Show when={!shopCart.isEmpty()}>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Empty your cart?")) shopCart.clear();
              }}
              class="text-xs uppercase tracking-wider text-slate-400 hover:text-rose-300 underline decoration-dotted underline-offset-4 transition-colors"
            >
              Empty cart
            </button>
          </Show>
        </header>

        <Show when={!shopCart.isEmpty()} fallback={<EmptyCart />}>
          <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            {/* Line items */}
            <ul class="space-y-3">
              <For each={shopCart.resolvedLines()}>
                {(rl) => (
                  <li class="cart-line relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-lg shadow-black/20">
                    <ShopItemPreview item={rl.item} size="thumb" />

                    <div class="flex-1 min-w-0">
                      <p class="text-base font-semibold text-white truncate">
                        {rl.item.title}
                      </p>
                      <p class="text-xs text-slate-400 line-clamp-2">
                        {rl.item.description}
                      </p>
                      <p class="text-xs text-slate-300/80 mt-1">
                        Unit price:{" "}
                        <span class="text-white">
                          {formatPrice(rl.item.priceCents)}
                        </span>
                      </p>
                    </div>

                    <div class="flex flex-col items-end gap-2 shrink-0">
                      <span class="font-display text-lg text-gold-300 tabular-nums">
                        {formatPrice(rl.lineTotalCents)}
                      </span>

                      <Show
                        when={rl.item.maxQuantity > 1}
                        fallback={
                          <span class="text-[10px] uppercase tracking-wider text-slate-500">
                            Single owner
                          </span>
                        }
                      >
                        <QuantityStepper
                          value={rl.line.quantity}
                          min={1}
                          max={rl.item.maxQuantity}
                          onChange={(n) =>
                            shopCart.setQuantity(rl.item.id, n)
                          }
                        />
                      </Show>

                      <button
                        type="button"
                        onClick={() => shopCart.remove(rl.item.id)}
                        class="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-300 transition-colors"
                        aria-label={`Remove ${rl.item.title}`}
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </li>
                )}
              </For>
            </ul>

            {/* Sticky summary */}
            <div class="lg:sticky lg:top-20 space-y-4">
              <CartSummary />

              <button
                type="button"
                onClick={handleCheckout}
                class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors focus-ring-gold shadow-lg shadow-purple-900/30"
              >
                <Lock class="w-4 h-4" />
                Continue to checkout
                <ArrowRight class="w-4 h-4" />
              </button>

              <A
                href="/shop"
                class="block text-center text-sm text-slate-300/80 hover:text-white underline decoration-dotted underline-offset-4 transition-colors"
              >
                Continue shopping
              </A>
            </div>
          </div>
        </Show>
      </main>

      <style jsx>{`
        .cart-page {
          background: linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%);
        }
        .cart-line {
          animation: cartLineSlideUp 0.35s ease-out;
        }
        @keyframes cartLineSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function EmptyCart() {
  return (
    <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center space-y-4">
      <div class="w-16 h-16 rounded-2xl mx-auto grid place-items-center bg-white/5 border border-white/10">
        <ShoppingBag class="w-8 h-8 text-gold-300" />
      </div>
      <div>
        <h3 class="font-display text-xl text-white">Nothing here yet</h3>
        <p class="text-sm text-slate-400 mt-1">
          Browse the catalog to add tips or cosmetics to your cart.
        </p>
      </div>
      <A
        href="/shop"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors focus-ring-gold"
      >
        Visit the shop
      </A>
    </div>
  );
}

function CartSummary() {
  return (
    <aside class="relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl shadow-black/30">
      <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
      <div class="relative z-10 space-y-3">
        <h3 class="font-display text-lg text-white tracking-wide">
          Order summary
        </h3>

        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-300">
            Subtotal ({shopCart.itemCount()}{" "}
            {shopCart.itemCount() === 1 ? "item" : "items"})
          </span>
          <span class="text-white tabular-nums">
            {formatPrice(shopCart.subtotalCents())}
          </span>
        </div>
        <p class="text-xs text-slate-400 italic">
          Tax calculated at checkout based on your billing country.
        </p>

        <div class="flex items-center justify-between pt-3 border-t border-white/10">
          <span class="font-display text-base text-white tracking-wide">
            Total (excl. tax)
          </span>
          <span class="font-display text-lg text-gold-300 tabular-nums">
            {formatPrice(shopCart.subtotalCents())}
          </span>
        </div>
      </div>
    </aside>
  );
}

function QuantityStepper(props: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const dec = () => props.onChange(Math.max(props.min, props.value - 1));
  const inc = () => props.onChange(Math.min(props.max, props.value + 1));

  return (
    <div
      class="inline-flex items-center rounded-lg border border-white/10 bg-white/5 overflow-hidden"
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={dec}
        disabled={props.value <= props.min}
        class="w-7 h-7 grid place-items-center text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring-gold"
        aria-label="Decrease quantity"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>
      <span class="px-2 min-w-[28px] text-center text-sm font-semibold text-white tabular-nums">
        {props.value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={props.value >= props.max}
        class="w-7 h-7 grid place-items-center text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring-gold"
        aria-label="Increase quantity"
      >
        <Plus class="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
