import { Show, type Component } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, ShoppingBag, ShoppingCart } from "lucide-solid";
import { shopCart } from "../../stores/shopCart.store";

interface Props {
  /** Title displayed in the center of the header. */
  title: string;
  /** Hide the cart icon button (e.g. on the cart page itself). */
  hideCart?: boolean;
}

/**
 * Sticky top bar shared by every shop page.
 *
 * Mirrors the chrome used by the public legal pages
 * (`CookiesPolicy`, `TermsOfService`, …) so the shop section feels native to
 * the rest of the app.
 */
export const ShopHeader: Component<Props> = (props) => {
  const navigate = useNavigate();

  return (
    <header class="sticky top-0 z-30 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-game-dark/80 backdrop-blur-md">
      <button
        type="button"
        onClick={() => navigate(-1)}
        class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors focus-ring-gold rounded"
      >
        <ArrowLeft class="w-5 h-5" />
        <span class="hidden sm:inline">Back</span>
      </button>

      <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2 truncate">
        <ShoppingBag class="w-5 h-5 text-gold-300 shrink-0" />
        <span class="truncate">{props.title}</span>
      </h1>

      <Show
        when={!props.hideCart}
        fallback={<div class="w-10 sm:w-24" aria-hidden="true" />}
      >
        <A
          href="/shop/cart"
          aria-label={`Open cart (${shopCart.itemCount()} items)`}
          class="relative inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-gold-300/40 text-slate-200 hover:text-white transition-all focus-ring-gold"
        >
          <ShoppingCart class="w-5 h-5" />
          <Show when={shopCart.itemCount() > 0}>
            <span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-gold-300 text-ink-900 text-[11px] font-bold grid place-items-center shadow-md">
              {shopCart.itemCount()}
            </span>
          </Show>
        </A>
      </Show>
    </header>
  );
};

export default ShopHeader;
