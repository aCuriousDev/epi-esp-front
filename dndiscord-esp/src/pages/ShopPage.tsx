import { For, Show, createSignal, onCleanup, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import {
  Beer,
  Check,
  Coffee,
  Crown,
  Dices,
  Heart,
  Info,
  Minus,
  Palette,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-solid";
import {
  SHOP_AURAS,
  SHOP_DICE_SKINS,
  SHOP_TIPS,
  SHOP_TITLES,
  formatPrice,
  type ShopItem,
} from "../data/shopCatalog";
import { shopCart } from "../stores/shopCart.store";
import ShopHeader from "../components/shop/ShopHeader";
import ShopItemPreview from "../components/shop/ShopItemPreview";
import DicePreviewModal from "../components/shop/DicePreviewModal";
import AuraPreviewModal from "../components/shop/AuraPreviewModal";

/**
 * Shop Page - Catalog (entry point)
 *
 * Lists tip-jar amounts plus three cosmetic categories (dice skins, exclusive
 * titles, portrait auras). Every CTA adds the item to the persistent shop
 * cart; users then move on to `/shop/cart` and `/shop/checkout`.
 *
 * Frontend-only mock — no real payment processor is wired in.
 */
export default function ShopPage() {
  const [toast, setToast] = createSignal<string | null>(null);
  let toastTimer: number | undefined;

  // Dice modal state
  const [modalItem, setModalItem] = createSignal<ShopItem | null>(null);
  const [modalAdded, setModalAdded] = createSignal(false);
  let modalAddedTimer: number | undefined;

  // Aura modal state
  const [auraModalItem, setAuraModalItem] = createSignal<ShopItem | null>(null);
  const [auraModalAdded, setAuraModalAdded] = createSignal(false);
  let auraModalAddedTimer: number | undefined;

  onCleanup(() => {
    if (toastTimer) window.clearTimeout(toastTimer);
    if (modalAddedTimer) window.clearTimeout(modalAddedTimer);
    if (auraModalAddedTimer) window.clearTimeout(auraModalAddedTimer);
  });

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setToast(null), 2400);
  }

  function handleAdd(item: ShopItem) {
    shopCart.add(item.id, 1);
    showToast(`Added "${item.title}" to your cart.`);
  }

  function handleModalAdd() {
    const item = modalItem();
    if (!item) return;
    shopCart.add(item.id, 1);
    setModalAdded(true);
    if (modalAddedTimer) window.clearTimeout(modalAddedTimer);
    modalAddedTimer = window.setTimeout(() => setModalAdded(false), 750);
  }

  function handleAuraModalAdd() {
    const item = auraModalItem();
    if (!item) return;
    shopCart.add(item.id, 1);
    setAuraModalAdded(true);
    if (auraModalAddedTimer) window.clearTimeout(auraModalAddedTimer);
    auraModalAddedTimer = window.setTimeout(() => setAuraModalAdded(false), 750);
  }

  return (
    <div class="shop-page relative min-h-screen w-full overflow-y-auto">
      {/* Animated background blobs (matches LoginPage vocabulary) */}
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>
      <div class="vignette fixed inset-0 pointer-events-none" />

      <ShopHeader title="Support shop" />

      <main class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10 pb-24 space-y-10">
        {/* Hero */}
        <section class="text-center space-y-4">
          <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs uppercase tracking-[0.18em] text-mid">
            <Heart class="w-3.5 h-3.5 text-rose-300" />
            A passion-built project
          </span>
          <h2 class="shop-title font-display text-4xl sm:text-5xl tracking-wide">
            Support DnDiscord
          </h2>
          <p class="text-slate-200/80 max-w-2xl mx-auto text-base leading-relaxed">
            DnDiscord is built by a small team of D&amp;D fans, on our own time and
            our own dime. If you enjoy the app, you can help us cover hosting and
            keep the project alive — every contribution counts. In return, grab a
            small cosmetic souvenir if you like.
          </p>
          <p class="text-xs text-slate-400/80 italic max-w-xl mx-auto">
            No pay-to-win, ever. Cosmetics only.
          </p>

        </section>

        {/* Tip jar — main support CTA */}
        <section class="shop-card relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/30">
          <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
          <div class="relative z-10 space-y-5">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-300/20 grid place-items-center">
                <Coffee class="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h3 class="text-xl font-semibold text-white">Buy us a coffee</h3>
                <p class="text-sm text-slate-300/80 mt-1">
                  One-shot tip — choose an amount that feels right.
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <For each={SHOP_TIPS}>
                {(tip) => (
                  <TipButton
                    item={tip}
                    icon={tipIcon(tip)}
                    onAdd={() => handleAdd(tip)}
                  />
                )}
              </For>
            </div>
          </div>
        </section>

        {/* Catalog sections */}
        <CatalogSection
          icon={<Dices class="w-5 h-5 text-purple-300" />}
          title="Dice skins"
          subtitle="Re-skin your rolls — purely cosmetic, doesn't change any outcome."
        >
          <For each={SHOP_DICE_SKINS}>
            {(item) => (
              <CosmeticCard
                item={item}
                onAdd={() => handleAdd(item)}
                onPreview={item.image ? () => setModalItem(item) : undefined}
              />
            )}
          </For>
        </CatalogSection>

        <CatalogSection
          icon={<Sparkles class="w-5 h-5 text-amber-300" />}
          title="Exclusive titles"
          subtitle="A flavor word displayed under your profile name."
        >
          <For each={SHOP_TITLES}>
            {(item) => <CosmeticCard item={item} onAdd={() => handleAdd(item)} />}
          </For>
        </CatalogSection>

        <CatalogSection
          icon={<Palette class="w-5 h-5 text-rose-300" />}
          title="Portrait auras"
          subtitle="A glow effect around your character portrait."
        >
          <For each={SHOP_AURAS}>
            {(item) => (
              <CosmeticCard
                item={item}
                onAdd={() => handleAdd(item)}
                onPreview={() => setAuraModalItem(item)}
              />
            )}
          </For>
        </CatalogSection>

        {/* Promise / disclaimer */}
        <section class="rounded-2xl border border-white/10 bg-white/5 p-5 flex gap-4 items-start">
          <Info class="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div class="text-sm text-slate-300/85 space-y-1">
            <p class="font-semibold text-white">Our promise</p>
            <p>
              The shop will <strong>never</strong> sell power, XP, stats, or
              gameplay shortcuts. Items here are minor cosmetics and a way to
              say thanks. Your account works exactly the same with or without
              any of them.
            </p>
          </div>
        </section>

        <footer class="text-center space-y-2 pt-2">
          <p class="text-slate-400/60 text-xs">
            Need to sign in or create an account first?{" "}
            <A href="/login" class="text-slate-300 hover:text-white underline">
              Go to login
            </A>
          </p>
          <p class="flex items-center justify-center gap-2 text-[11px] text-slate-400/50">
            <A href="/terms" class="hover:text-slate-300 transition-colors">
              Terms of service
            </A>
            <span>·</span>
            <A href="/privacy" class="hover:text-slate-300 transition-colors">
              Privacy policy
            </A>
            <span>·</span>
            <A href="/legal" class="hover:text-slate-300 transition-colors">
              Legal notice
            </A>
          </p>
        </footer>
      </main>

      {/* Dice preview modal */}
      <DicePreviewModal
        item={modalItem()}
        onClose={() => { setModalItem(null); setModalAdded(false); }}
        onAdd={handleModalAdd}
        added={modalAdded()}
      />

      {/* Aura preview modal */}
      <AuraPreviewModal
        item={auraModalItem()}
        onClose={() => { setAuraModalItem(null); setAuraModalAdded(false); }}
        onAdd={handleAuraModalAdd}
        added={auraModalAdded()}
      />

      {/* Toast (add-to-cart confirmation) */}
      <Show when={toast()}>
        <div
          role="status"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 shadow-xl backdrop-blur-md max-w-md"
        >
          <Check class="w-5 h-5 text-emerald-300 flex-shrink-0" />
          <span class="text-sm">{toast()}</span>
        </div>
      </Show>

      <style jsx>{`
        .shop-page {
          background: linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%);
        }

        .shop-title {
          background: linear-gradient(
            135deg,
            var(--gold-200) 0%,
            var(--gold-300) 25%,
            var(--plum-300) 50%,
            var(--gold-300) 75%,
            var(--gold-200) 100%
          );
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 40px rgba(244, 197, 66, 0.35);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
          animation: shopGradientShift 5s ease-in-out infinite;
        }

        @keyframes shopGradientShift {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }

        .shop-card {
          animation: shopCardSlideUp 0.55s ease-out;
        }

        @keyframes shopCardSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .delay-1000 {
          animation-delay: 1s;
        }

        /* ── Tip button: menu-card hover (shimmer + lift + glow) ── */
        .tip-btn {
          transition:
            transform 200ms ease,
            box-shadow 200ms ease,
            border-color 200ms ease;
        }
        .tip-shimmer {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(120deg, transparent 30%, rgba(244,197,66,0.10) 50%, transparent 70%);
          background-size: 250% 100%;
          background-position: 100% 0;
          transition: background-position 600ms ease;
          pointer-events: none;
        }
        .tip-btn:hover .tip-shimmer {
          background-position: 0 0;
        }
        .tip-btn:hover {
          transform: translateY(-3px);
          box-shadow:
            0 14px 36px rgba(0,0,0,0.5),
            0 0 0 1px rgba(244,197,66,0.15),
            0 0 24px rgba(244,197,66,0.12);
        }

        /* ── Tip button: flying hearts ── */
        .tip-heart {
          color: #f4c542;
          line-height: 1;
          animation-name: tipHeartFly;
          animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
          animation-fill-mode: forwards;
          animation-iteration-count: 1;
          opacity: 0;
          transform: translateX(-50%);
          filter: drop-shadow(0 0 6px rgba(244,197,66,0.85));
        }

        @keyframes tipHeartFly {
          0%   { opacity: 0;   transform: translateX(-50%) translateY(0)     scale(0.4); }
          12%  { opacity: 1;   transform: translateX(-50%) translateY(-10px) scale(1.25); }
          55%  { opacity: 1;   transform: translateX(-50%) translateY(-70px) scale(1.0); }
          100% { opacity: 0;   transform: translateX(-50%) translateY(-140px) scale(0.65); }
        }

      `}</style>
    </div>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function tipIcon(item: ShopItem): JSX.Element {
  if (item.preview.kind !== "tip") return <Coffee class="w-5 h-5" />;
  switch (item.preview.icon) {
    case "coffee":
      return <Coffee class="w-5 h-5" />;
    case "beer":
      return <Beer class="w-5 h-5" />;
    case "heart":
      return <Heart class="w-5 h-5" />;
    case "crown":
      return <Crown class="w-5 h-5" />;
  }
}

/* ───────────────────────── Shared add-animation hook ───────────────────────── */

interface Particle {
  id: number;
  /** horizontal offset from button centre in px */
  x: number;
  /** vertical start offset from button centre in px (negative = up) */
  y: number;
  /** glyph size in px */
  size: number;
  /** total animation duration in ms */
  dur: number;
  /** stagger delay in ms */
  delay: number;
  /** angle in degrees for sparkle rotation spread */
  angle: number;
}

let _pid = 0;

/**
 * Shared hook that drives:
 *  - `hearts`   — flying ♥ particles (tip buttons)
 *  - `sparkles` — flying ✦ particles (cosmetic cards)
 *  - `popped`   — brief scale-pop on the trigger element
 *  - `aura`     — glow burst flag (true for ~600 ms after add)
 */
function useAddAnimation() {
  const [hearts, setHearts] = createSignal<Particle[]>([]);
  const [sparkles, setSparkles] = createSignal<Particle[]>([]);
  const [popped, setPopped] = createSignal(false);
  const [aura, setAura] = createSignal(false);

  function makeParticles(count: number, spreadX: number): Particle[] {
    return Array.from({ length: count }, (_, i) => ({
      id: ++_pid,
      x: (Math.random() - 0.5) * spreadX,
      y: -(12 + Math.random() * 20),
      size: 9 + Math.random() * 13,
      dur: 650 + Math.random() * 500,
      delay: i * 45,
      angle: (Math.random() - 0.5) * 30,
    }));
  }

  function fire(kind: "hearts" | "sparkles", count: number, spreadX: number) {
    const batch = makeParticles(count, spreadX);

    if (kind === "hearts") setHearts((h) => [...h, ...batch]);
    else setSparkles((s) => [...s, ...batch]);

    setPopped(true);
    setAura(true);

    const t1 = window.setTimeout(() => setPopped(false), 180);
    const t2 = window.setTimeout(() => setAura(false), 650);
    const longestDur = Math.max(...batch.map((p) => p.dur + p.delay)) + 100;
    const t3 = window.setTimeout(() => {
      if (kind === "hearts")
        setHearts((h) => h.filter((p) => !batch.includes(p)));
      else setSparkles((s) => s.filter((p) => !batch.includes(p)));
    }, longestDur);

    onCleanup(() => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    });
  }

  return { hearts, sparkles, popped, aura, fire };
}

/* ───────────────────────── TipButton ───────────────────────── */

function TipButton(props: {
  item: ShopItem;
  icon: JSX.Element;
  onAdd: () => void;
}) {
  const highlighted = () =>
    props.item.preview.kind === "tip" && props.item.preview.highlighted === true;
  const shortLabel = () =>
    props.item.title.replace(/^Buy us a /, "").replace(/^Mythic supporter$/, "Mythic");

  const { hearts, popped, fire } = useAddAnimation();

  function handleClick() {
    fire("hearts", 10, 120);
    props.onAdd();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`tip-btn group relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border focus-ring-gold overflow-visible ${
        highlighted()
          ? "bg-gradient-to-br from-amber-500/25 to-amber-600/10 border-amber-300/40 hover:border-amber-200/60"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-gold-300/50"
      }`}
      aria-label={`Add ${props.item.title} to cart for ${formatPrice(props.item.priceCents)}`}
    >
      {/* Shimmer sweep (menu-card style) */}
      <span aria-hidden="true" class="tip-shimmer" />

      {/* Flying hearts */}
      <For each={hearts()}>
        {(p) => (
          <span
            aria-hidden="true"
            class="tip-heart pointer-events-none absolute select-none"
            style={{
              left: `calc(50% + ${p.x}px)`,
              bottom: "40%",
              "font-size": `${p.size}px`,
              "animation-duration": `${p.dur}ms`,
              "animation-delay": `${p.delay}ms`,
            }}
          >
            ♥
          </span>
        )}
      </For>

      <span
        class={`${
          highlighted() ? "text-amber-200" : "text-slate-300"
        } transition-transform ${popped() ? "scale-[1.6]" : "group-hover:scale-110"}`}
        style={{ "transition-duration": popped() ? "80ms" : "200ms" }}
      >
        {props.icon}
      </span>
      <span class="text-xs uppercase tracking-wider text-slate-300/80">
        {shortLabel()}
      </span>
      <span class="font-semibold text-white text-base">
        {formatPrice(props.item.priceCents)}
      </span>
    </button>
  );
}

function CatalogSection(props: {
  icon: JSX.Element;
  title: string;
  subtitle: string;
  children: JSX.Element;
}) {
  return (
    <section class="space-y-4">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 class="flex items-center gap-2 font-display text-2xl text-white tracking-wide">
            {props.icon}
            {props.title}
          </h3>
          <p class="text-sm text-slate-400 mt-1">{props.subtitle}</p>
        </div>
      </header>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {props.children}
      </div>
    </section>
  );
}

function CosmeticCard(props: { item: ShopItem; onAdd: () => void; onPreview?: () => void }) {
  const cartLine = () =>
    shopCart.resolvedLines().find((rl) => rl.item.id === props.item.id);
  const inCart = () => !!cartLine();
  const qty = () => cartLine()?.line.quantity ?? 0;
  const atMax = () => qty() >= props.item.maxQuantity;

  const { popped, fire } = useAddAnimation();
  const [added, setAdded] = createSignal(false);
  let addedTimer: number | undefined;

  onCleanup(() => { if (addedTimer) window.clearTimeout(addedTimer); });

  function handleAdd() {
    if (atMax()) return;
    fire("sparkles", 0, 0);
    props.onAdd();
    setAdded(true);
    if (addedTimer) window.clearTimeout(addedTimer);
    addedTimer = window.setTimeout(() => setAdded(false), 750);
  }

  return (
    <article class="group relative flex flex-col gap-3 p-4 bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-gold-300/40 hover:-translate-y-0.5 transition-all shadow-lg shadow-black/20 overflow-visible">
      <Show when={props.item.tag}>
        <span class="absolute top-3 right-3 z-10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-plum-700/60 border border-plum-300/40 text-plum-300">
          {props.item.tag}
        </span>
      </Show>
 
      <div
        class={props.onPreview ? "relative cursor-pointer" : "relative"}
        style={{
          transform: popped() ? "scale(0.94)" : "scale(1)",
          transition: popped() ? "transform 80ms ease" : "transform 160ms ease",
        }}
        onClick={() => props.onPreview?.()}
        role={props.onPreview ? "button" : undefined}
        aria-label={props.onPreview ? `Preview ${props.item.title}` : undefined}
      >
        <ShopItemPreview item={props.item} size="card" />
      </div>

      <div class="flex-1 space-y-1">
        <h4 class="font-semibold text-white">{props.item.title}</h4>
        <p class="text-xs text-slate-400 leading-relaxed">{props.item.description}</p>
      </div>

      <div class="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
        <span class="font-display text-lg text-gold-300 tracking-wide">
          {formatPrice(props.item.priceCents)}
        </span>

        <Show
          when={inCart()}
          fallback={
            /* ── Not in cart: single Add button with green flash ── */
            <button
              type="button"
              onClick={handleAdd}
              class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus-ring-gold ${
                added()
                  ? "bg-emerald-500 text-white scale-95"
                  : "bg-purple-600 hover:bg-purple-500 text-white"
              }`}
            >
              <Show
                when={added()}
                fallback={<><Plus class="w-3.5 h-3.5" />Add to cart</>}
              >
                <Check class="w-3.5 h-3.5" />Added!
              </Show>
            </button>
          }
        >
          {/* ── In cart: quantity stepper + remove ── */}
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shopCart.setQuantity(props.item.id, qty() - 1)}
              class="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors focus-ring-gold"
              aria-label="Decrease quantity"
            >
              <Minus class="w-3 h-3" />
            </button>
            <span class="w-5 text-center text-sm font-medium text-white tabular-nums select-none">
              {qty()}
            </span>
            <button
              type="button"
              onClick={handleAdd}
              disabled={atMax()}
              class="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white flex items-center justify-center transition-colors focus-ring-gold"
              aria-label="Increase quantity"
            >
              <Plus class="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => shopCart.remove(props.item.id)}
              class="ml-0.5 w-7 h-7 rounded-md bg-red-500/15 hover:bg-red-500/35 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors focus-ring-gold"
              aria-label="Remove from cart"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </Show>
      </div>
    </article>
  );
}
