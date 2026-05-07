import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  type JSX,
} from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-solid";
import { shopCart } from "../stores/shopCart.store";
import {
  COUNTRIES,
  formatPrice,
  getCountry,
} from "../data/shopCatalog";
import ShopHeader from "../components/shop/ShopHeader";
import OrderSummary from "../components/shop/OrderSummary";

/**
 * Shop Checkout Page — multi-step purchase flow
 *
 * Steps: billing → payment → review → confirmation.
 * Frontend-only mock: the "Place order" button performs a 1.5s fake delay
 * (no network call), generates a local order ID, clears the cart and shows
 * a confirmation screen.
 *
 * Card data, billing addresses and any other PII are NEVER persisted —
 * they live in component memory for the duration of the checkout session
 * and are dropped on confirmation or page navigation.
 */

type Step = "billing" | "payment" | "review" | "confirmation";

interface BillingForm {
  fullName: string;
  email: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  state: string;
  isBusiness: boolean;
  vatNumber: string;
}

interface PaymentForm {
  method: "card" | "paypal" | "applepay";
  cardNumber: string; // formatted "XXXX XXXX XXXX XXXX"
  cardName: string;
  cardExpiry: string; // "MM/YY"
  cardCvv: string;
  saveCard: boolean;
}

const DEFAULT_BILLING: BillingForm = {
  fullName: "",
  email: "",
  country: "FR",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  state: "",
  isBusiness: false,
  vatNumber: "",
};

const DEFAULT_PAYMENT: PaymentForm = {
  method: "card",
  cardNumber: "",
  cardName: "",
  cardExpiry: "",
  cardCvv: "",
  saveCard: false,
};

export default function ShopCheckoutPage() {
  const navigate = useNavigate();

  const [step, setStep] = createSignal<Step>("billing");
  const [billing, setBilling] = createSignal<BillingForm>({ ...DEFAULT_BILLING });
  const [payment, setPayment] = createSignal<PaymentForm>({ ...DEFAULT_PAYMENT });
  const [billingErrors, setBillingErrors] = createSignal<Partial<Record<keyof BillingForm, string>>>({});
  const [paymentErrors, setPaymentErrors] = createSignal<Partial<Record<keyof PaymentForm, string>>>({});
  const [submitting, setSubmitting] = createSignal(false);
  const [orderId, setOrderId] = createSignal<string | null>(null);
  const [orderTotalCents, setOrderTotalCents] = createSignal<number>(0);

  // If the user lands on /shop/checkout with an empty cart, bounce back to
  // the catalog. Skipped on the confirmation step (cart is intentionally
  // emptied at that point).
  onMount(() => {
    if (shopCart.isEmpty() && step() !== "confirmation") {
      navigate("/shop/cart", { replace: true });
    }
  });
  createEffect(() => {
    if (step() === "confirmation") return;
    if (shopCart.isEmpty()) navigate("/shop/cart", { replace: true });
  });

  /* ─────── Step navigation ─────── */

  function goToStep(target: Step) {
    setStep(target);
    queueMicrotask(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function submitBilling(e: Event) {
    e.preventDefault();
    const errors = validateBilling(billing());
    setBillingErrors(errors);
    if (Object.keys(errors).length === 0) goToStep("payment");
  }

  function submitPayment(e: Event) {
    e.preventDefault();
    const errors = validatePayment(payment());
    setPaymentErrors(errors);
    if (Object.keys(errors).length === 0) goToStep("review");
  }

  function placeOrder() {
    if (submitting()) return;
    setSubmitting(true);
    // Snapshot the total before clearing the cart so the confirmation page
    // can still display it.
    const total = shopCart.totalCentsFor(billing().country);
    setOrderTotalCents(total);

    // Mock async payment processing.
    window.setTimeout(() => {
      setOrderId(generateOrderId());
      shopCart.clear();
      setSubmitting(false);
      goToStep("confirmation");
    }, 1500);
  }

  return (
    <div class="checkout-page relative min-h-screen w-full overflow-y-auto">
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl" />
        <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl" />
      </div>
      <div class="vignette fixed inset-0 pointer-events-none" />

      <ShopHeader title="Checkout" hideCart />

      <main class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
        <Show when={step() !== "confirmation"}>
          <Stepper current={step()} onJump={goToStep} />
        </Show>

        <div
          class={`grid grid-cols-1 ${
            step() === "confirmation" ? "" : "lg:grid-cols-[1fr_360px]"
          } gap-6 items-start`}
        >
          {/* Main column */}
          <section class="space-y-4">
            <Switch>
              <Match when={step() === "billing"}>
                <BillingStep
                  value={billing()}
                  errors={billingErrors()}
                  onChange={setBilling}
                  onSubmit={submitBilling}
                />
              </Match>
              <Match when={step() === "payment"}>
                <PaymentStep
                  value={payment()}
                  errors={paymentErrors()}
                  onChange={setPayment}
                  onBack={() => goToStep("billing")}
                  onSubmit={submitPayment}
                />
              </Match>
              <Match when={step() === "review"}>
                <ReviewStep
                  billing={billing()}
                  payment={payment()}
                  submitting={submitting()}
                  onBack={() => goToStep("payment")}
                  onPlaceOrder={placeOrder}
                />
              </Match>
              <Match when={step() === "confirmation"}>
                <ConfirmationStep
                  orderId={orderId() ?? ""}
                  totalCents={orderTotalCents()}
                  email={billing().email}
                />
              </Match>
            </Switch>
          </section>

          {/* Sticky summary (hidden on confirmation) */}
          <Show when={step() !== "confirmation"}>
            <div class="lg:sticky lg:top-20 space-y-3">
              <OrderSummary countryCode={billing().country} />
              <p class="flex items-start gap-2 text-[11px] text-slate-400 px-1">
                <Lock class="w-3 h-3 mt-0.5 shrink-0" />
                Mock checkout — no real payment is processed and no card data
                is sent or stored.
              </p>
            </div>
          </Show>
        </div>
      </main>

      <style jsx>{`
        .checkout-page {
          background: linear-gradient(135deg, var(--ink-700) 0%, var(--ink-800) 50%, var(--ink-900) 100%);
        }
      `}</style>
    </div>
  );
}

/* ───────────────────────── Stepper ───────────────────────── */

const STEPS: { id: Step; label: string; icon: () => JSX.Element }[] = [
  { id: "billing", label: "Billing", icon: () => <MapPin class="w-4 h-4" /> },
  { id: "payment", label: "Payment", icon: () => <CreditCard class="w-4 h-4" /> },
  { id: "review", label: "Review", icon: () => <ReceiptText class="w-4 h-4" /> },
];

function Stepper(props: { current: Step; onJump: (s: Step) => void }) {
  const currentIdx = () => STEPS.findIndex((s) => s.id === props.current);

  return (
    <ol class="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1">
      <For each={STEPS}>
        {(s, i) => {
          const status = () =>
            i() < currentIdx() ? "done" : i() === currentIdx() ? "current" : "todo";
          return (
            <>
              <li class="flex-1 min-w-fit">
                <button
                  type="button"
                  onClick={() => {
                    if (status() === "done") props.onJump(s.id);
                  }}
                  disabled={status() !== "done"}
                  class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                    status() === "current"
                      ? "border-gold-300/50 bg-gold-300/10 text-white"
                      : status() === "done"
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15 cursor-pointer"
                        : "border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <span
                    class={`grid place-items-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                      status() === "current"
                        ? "bg-gold-300 text-ink-900"
                        : status() === "done"
                          ? "bg-emerald-400 text-ink-900"
                          : "bg-white/10 text-slate-300"
                    }`}
                  >
                    <Show when={status() === "done"} fallback={<>{i() + 1}</>}>
                      <Check class="w-3.5 h-3.5" />
                    </Show>
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] uppercase tracking-wider opacity-70">
                      Step {i() + 1}
                    </p>
                    <p class="text-sm font-semibold truncate flex items-center gap-1.5">
                      <span class="hidden sm:inline-flex">{s.icon()}</span>
                      {s.label}
                    </p>
                  </div>
                </button>
              </li>
              <Show when={i() < STEPS.length - 1}>
                <li
                  aria-hidden="true"
                  class="hidden sm:block flex-1 max-w-[40px] h-px bg-white/10"
                />
              </Show>
            </>
          );
        }}
      </For>
    </ol>
  );
}

/* ───────────────────────── Input helpers ───────────────────────── */

/**
 * Base Tailwind class for every checkout text/email/password input.
 * Matches the convention used in CreateCampaign.tsx (bg-ink-600 / border-ink-500).
 */
const INPUT_BASE =
  "w-full px-3.5 py-3 bg-ink-600 border rounded-ds-sm text-high text-[14px] outline-none transition-colors placeholder:text-mute focus:border-gold-400 hover:border-ink-400";

/** Returns the full input class string, optionally with error styling and extras. */
function ic(extra = "", hasError = false): string {
  const border = hasError ? "border-danger" : "border-ink-500";
  return `${INPUT_BASE} ${border}${extra ? " " + extra : ""}`;
}

/** Inline style that turns a plain <select> into a styled dropdown. */
const SELECT_STYLE = {
  appearance: "none",
  "background-image":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23F4C542' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E\")",
  "background-repeat": "no-repeat",
  "background-position": "right 0.75rem center",
  "padding-right": "2rem",
} as const;

/* ───────────────────────── Step 1: Billing ───────────────────────── */

function BillingStep(props: {
  value: BillingForm;
  errors: Partial<Record<keyof BillingForm, string>>;
  onChange: (next: BillingForm) => void;
  onSubmit: (e: Event) => void;
}) {
  function patch<K extends keyof BillingForm>(key: K, value: BillingForm[K]) {
    props.onChange({ ...props.value, [key]: value });
  }
  const country = () => getCountry(props.value.country);
  const showState = () =>
    props.value.country === "US" || props.value.country === "CA";
  const showVat = () => country()?.isEU && props.value.isBusiness;

  return (
    <form onSubmit={props.onSubmit} class="space-y-5" novalidate>
      <SectionCard
        icon={<MapPin class="w-5 h-5 text-purple-300" />}
        title="Billing address"
        subtitle="Used to issue your receipt and compute applicable taxes."
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Full name"
            error={props.errors.fullName}
            class="sm:col-span-2"
          >
            <input
              type="text"
              autocomplete="name"
              value={props.value.fullName}
              onInput={(e) => patch("fullName", e.currentTarget.value)}
              placeholder="Aria Shadowblade"
              class={ic("", !!props.errors.fullName)}
            />
          </Field>

          <Field
            label="Email"
            error={props.errors.email}
            class="sm:col-span-2"
            hint="Receipt will be sent here."
          >
            <input
              type="email"
              autocomplete="email"
              value={props.value.email}
              onInput={(e) => patch("email", e.currentTarget.value)}
              placeholder="adventurer@example.com"
              class={ic("", !!props.errors.email)}
            />
          </Field>

          <Field label="Country" error={props.errors.country}>
            <select
              value={props.value.country}
              onChange={(e) => patch("country", e.currentTarget.value)}
              class={ic("", !!props.errors.country)}
              style={SELECT_STYLE}
              autocomplete="country"
            >
              <For each={COUNTRIES}>
                {(c) => (
                  <option value={c.code} style={{ background: "#14162B", color: "#F5F1E4" }}>
                    {c.name}
                  </option>
                )}
              </For>
            </select>
          </Field>

          <Show when={showState()}>
            <Field
              label={props.value.country === "US" ? "State" : "Province"}
              error={props.errors.state}
            >
              <input
                type="text"
                autocomplete="address-level1"
                value={props.value.state}
                onInput={(e) => patch("state", e.currentTarget.value)}
                placeholder={props.value.country === "US" ? "CA" : "QC"}
                class={ic("", !!props.errors.state)}
              />
            </Field>
          </Show>

          <Field
            label="Address"
            error={props.errors.addressLine1}
            class="sm:col-span-2"
          >
            <input
              type="text"
              autocomplete="address-line1"
              value={props.value.addressLine1}
              onInput={(e) => patch("addressLine1", e.currentTarget.value)}
              placeholder="42 Tavern Lane"
              class={ic("", !!props.errors.addressLine1)}
            />
          </Field>

          <Field
            label="Apartment, suite, etc."
            optional
            class="sm:col-span-2"
          >
            <input
              type="text"
              autocomplete="address-line2"
              value={props.value.addressLine2}
              onInput={(e) => patch("addressLine2", e.currentTarget.value)}
              placeholder="Apt 3B"
              class={ic()}
            />
          </Field>

          <Field label="City" error={props.errors.city}>
            <input
              type="text"
              autocomplete="address-level2"
              value={props.value.city}
              onInput={(e) => patch("city", e.currentTarget.value)}
              placeholder="Waterdeep"
              class={ic("", !!props.errors.city)}
            />
          </Field>

          <Field label="Postal code" error={props.errors.postalCode}>
            <input
              type="text"
              autocomplete="postal-code"
              value={props.value.postalCode}
              onInput={(e) => patch("postalCode", e.currentTarget.value)}
              placeholder="75001"
              class={ic("", !!props.errors.postalCode)}
            />
          </Field>
        </div>

        <Show when={country()?.isEU}>
          <div class="pt-4 border-t border-white/10 space-y-3">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={props.value.isBusiness}
                onChange={(e) => patch("isBusiness", e.currentTarget.checked)}
                class="w-4 h-4 rounded cursor-pointer"
                style={{ "accent-color": "var(--gold-400)" }}
              />
              <span class="text-sm text-slate-200">
                I'm purchasing as a business (EU VAT applies)
              </span>
            </label>

            <Show when={showVat()}>
              <Field label="VAT number" error={props.errors.vatNumber}>
                <input
                  type="text"
                  value={props.value.vatNumber}
                  onInput={(e) =>
                    patch("vatNumber", e.currentTarget.value.toUpperCase())
                  }
                  placeholder="FR12345678901"
                  class={ic("uppercase", !!props.errors.vatNumber)}
                />
              </Field>
            </Show>
          </div>
        </Show>
      </SectionCard>

      <div class="flex flex-col sm:flex-row gap-3 sm:justify-between">
        <A
          href="/shop/cart"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-sm transition-colors focus-ring-gold"
        >
          <ArrowLeft class="w-4 h-4" />
          Back to cart
        </A>
        <button
          type="submit"
          class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors focus-ring-gold shadow-lg shadow-purple-900/30"
        >
          Continue to payment
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────── Step 2: Payment ───────────────────────── */

function PaymentStep(props: {
  value: PaymentForm;
  errors: Partial<Record<keyof PaymentForm, string>>;
  onChange: (next: PaymentForm) => void;
  onBack: () => void;
  onSubmit: (e: Event) => void;
}) {
  function patch<K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) {
    props.onChange({ ...props.value, [key]: value });
  }

  const brand = createMemo(() => detectBrand(props.value.cardNumber));
  const cvvLength = () => (brand() === "amex" ? 4 : 3);

  function onCardNumberInput(e: InputEvent) {
    const target = e.currentTarget as HTMLInputElement;
    patch("cardNumber", formatCardNumber(target.value));
  }
  function onExpiryInput(e: InputEvent) {
    const target = e.currentTarget as HTMLInputElement;
    patch("cardExpiry", formatExpiry(target.value));
  }
  function onCvvInput(e: InputEvent) {
    const target = e.currentTarget as HTMLInputElement;
    patch("cardCvv", target.value.replace(/\D/g, "").slice(0, cvvLength()));
  }

  return (
    <form onSubmit={props.onSubmit} class="space-y-5" novalidate>
      <SectionCard
        icon={<CreditCard class="w-5 h-5 text-purple-300" />}
        title="Payment method"
        subtitle="Choose how you want to support us. Your card never leaves this device."
      >
        {/* Method tabs */}
        <div class="grid grid-cols-3 gap-2">
          <MethodTab
            active={props.value.method === "card"}
            label="Card"
            sub="Visa · MC · Amex"
            onClick={() => patch("method", "card")}
            icon={<CreditCard class="w-4 h-4" />}
          />
          <MethodTab
            active={props.value.method === "paypal"}
            label="PayPal"
            sub="Coming soon"
            disabled
            onClick={() => patch("method", "paypal")}
            icon={<span class="font-display text-xs">P</span>}
          />
          <MethodTab
            active={props.value.method === "applepay"}
            label="Apple Pay"
            sub="Coming soon"
            disabled
            onClick={() => patch("method", "applepay")}
            icon={<span class="font-display text-xs"></span>}
          />
        </div>

        <Show when={props.value.method === "card"}>
          <div class="space-y-4 pt-4 border-t border-white/10">
            {/* Card preview */}
            <CardPreview
              brand={brand()}
              number={props.value.cardNumber}
              name={props.value.cardName}
              expiry={props.value.cardExpiry}
            />

            <Field label="Card number" error={props.errors.cardNumber}>
              <div class="relative">
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="cc-number"
                  value={props.value.cardNumber}
                  onInput={onCardNumberInput}
                  placeholder="1234 5678 9012 3456"
                  class={ic("pr-16 font-mono tracking-wider", !!props.errors.cardNumber)}
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-slate-300 pointer-events-none">
                  {brandLabel(brand())}
                </span>
              </div>
            </Field>

            <Field label="Name on card" error={props.errors.cardName}>
              <input
                type="text"
                autocomplete="cc-name"
                value={props.value.cardName}
                onInput={(e) => patch("cardName", e.currentTarget.value)}
                placeholder="ARIA SHADOWBLADE"
                class={ic("uppercase", !!props.errors.cardName)}
              />
            </Field>

            <div class="grid grid-cols-2 gap-4">
              <Field label="Expiry (MM/YY)" error={props.errors.cardExpiry}>
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="cc-exp"
                  value={props.value.cardExpiry}
                  onInput={onExpiryInput}
                  placeholder="08/29"
                  class={ic("font-mono", !!props.errors.cardExpiry)}
                />
              </Field>
              <Field
                label={`CVV (${cvvLength()} digits)`}
                error={props.errors.cardCvv}
              >
                <input
                  type="password"
                  inputmode="numeric"
                  autocomplete="cc-csc"
                  value={props.value.cardCvv}
                  onInput={onCvvInput}
                  placeholder={brand() === "amex" ? "1234" : "123"}
                  class={ic("font-mono tracking-widest", !!props.errors.cardCvv)}
                />
              </Field>
            </div>

            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={props.value.saveCard}
                onChange={(e) => patch("saveCard", e.currentTarget.checked)}
                class="w-4 h-4 rounded cursor-pointer"
                style={{ "accent-color": "var(--gold-400)" }}
              />
              <span class="text-sm text-slate-200">
                Save this card for future support
              </span>
            </label>

            <p class="flex items-start gap-2 text-xs text-slate-400">
              <ShieldCheck class="w-4 h-4 mt-0.5 text-emerald-300 shrink-0" />
              In a real integration this form would tokenize your card via a
              PCI-compliant provider (Stripe, Adyen…). Nothing is sent here.
            </p>
          </div>
        </Show>

        <Show when={props.value.method !== "card"}>
          <div class="pt-4 border-t border-white/10 text-center text-sm text-slate-400 py-8">
            <Sparkles class="w-6 h-6 mx-auto mb-3 text-gold-300" />
            This payment method is coming soon. For now please use a card.
          </div>
        </Show>
      </SectionCard>

      <div class="flex flex-col sm:flex-row gap-3 sm:justify-between">
        <button
          type="button"
          onClick={props.onBack}
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-sm transition-colors focus-ring-gold"
        >
          <ArrowLeft class="w-4 h-4" />
          Back to billing
        </button>
        <button
          type="submit"
          disabled={props.value.method !== "card"}
          class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold transition-colors focus-ring-gold shadow-lg shadow-purple-900/30"
        >
          Review order
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

function MethodTab(props: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
  icon: JSX.Element;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      class={`relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all focus-ring-gold ${
        props.active
          ? "border-gold-300/50 bg-gold-300/10 text-white"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      } ${props.disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        class={`grid place-items-center w-8 h-8 rounded-lg ${
          props.active ? "bg-gold-300/20 text-gold-300" : "bg-white/5"
        }`}
      >
        {props.icon}
      </span>
      <span class="text-sm font-semibold">{props.label}</span>
      <span class="text-[10px] uppercase tracking-wider text-slate-400">
        {props.sub}
      </span>
    </button>
  );
}

function CardPreview(props: {
  brand: CardBrand;
  number: string;
  name: string;
  expiry: string;
}) {
  const display = () => {
    const masked = props.number.trim() || "•••• •••• •••• ••••";
    return masked;
  };
  return (
    <div class="card-preview relative aspect-[1.586/1] max-w-[360px] rounded-2xl p-5 text-white shadow-xl shadow-black/40 border border-white/10 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-plum-700 via-arcindigo-700 to-ink-800" />
      <div class="absolute -top-12 -right-12 w-40 h-40 bg-gold-300/15 rounded-full blur-2xl" />
      <div class="relative z-10 flex flex-col justify-between h-full">
        <div class="flex items-start justify-between">
          <div class="w-9 h-7 rounded-md bg-gradient-to-br from-gold-300 to-gold-500 shadow-inner" />
          <span class="text-[10px] uppercase tracking-[0.18em] text-white/80">
            {brandLabel(props.brand)}
          </span>
        </div>
        <p class="font-mono text-base sm:text-lg tracking-[0.2em] mt-3 truncate">
          {display()}
        </p>
        <div class="flex items-end justify-between gap-3 pt-2">
          <div class="min-w-0">
            <p class="text-[9px] uppercase tracking-wider text-white/60">
              Cardholder
            </p>
            <p class="text-xs font-semibold uppercase tracking-wide truncate">
              {props.name || "YOUR NAME"}
            </p>
          </div>
          <div class="text-right">
            <p class="text-[9px] uppercase tracking-wider text-white/60">
              Expires
            </p>
            <p class="text-xs font-mono">{props.expiry || "MM/YY"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 3: Review ───────────────────────── */

function ReviewStep(props: {
  billing: BillingForm;
  payment: PaymentForm;
  submitting: boolean;
  onBack: () => void;
  onPlaceOrder: () => void;
}) {
  const country = () => getCountry(props.billing.country);
  const lastFour = () => {
    const digits = props.payment.cardNumber.replace(/\D/g, "");
    return digits.slice(-4) || "····";
  };
  const total = () => shopCart.totalCentsFor(props.billing.country);

  return (
    <div class="space-y-5">
      <SectionCard
        icon={<MapPin class="w-5 h-5 text-purple-300" />}
        title="Billing address"
      >
        <div class="text-sm text-slate-200 space-y-0.5">
          <p class="font-semibold text-white">{props.billing.fullName}</p>
          <p class="text-slate-300">{props.billing.email}</p>
          <p>{props.billing.addressLine1}</p>
          <Show when={props.billing.addressLine2}>
            <p>{props.billing.addressLine2}</p>
          </Show>
          <p>
            {props.billing.postalCode} {props.billing.city}
            <Show when={props.billing.state}>
              {" "}
              · {props.billing.state}
            </Show>
          </p>
          <p>{country()?.name ?? props.billing.country}</p>
          <Show when={props.billing.isBusiness && props.billing.vatNumber}>
            <p class="text-xs text-slate-400 pt-1">
              VAT: {props.billing.vatNumber}
            </p>
          </Show>
        </div>
      </SectionCard>

      <SectionCard
        icon={<CreditCard class="w-5 h-5 text-purple-300" />}
        title="Payment method"
      >
        <div class="flex items-center gap-4">
          <div class="w-14 h-9 rounded-lg bg-gradient-to-br from-plum-700 to-arcindigo-700 grid place-items-center text-[10px] uppercase tracking-wider font-bold text-white">
            {brandLabel(detectBrand(props.payment.cardNumber))}
          </div>
          <div>
            <p class="text-sm font-semibold text-white font-mono tracking-wider">
              •••• •••• •••• {lastFour()}
            </p>
            <p class="text-xs text-slate-400">
              {props.payment.cardName.toUpperCase()} · expires{" "}
              {props.payment.cardExpiry}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<ShoppingBag class="w-5 h-5 text-purple-300" />}
        title="Items"
      >
        <OrderSummary countryCode={props.billing.country} title=" " />
      </SectionCard>

      <div class="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-start gap-3">
        <ShieldCheck class="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
        <p class="text-xs text-slate-300/85 leading-relaxed">
          By clicking <strong>Place order</strong> you agree to our{" "}
          <A href="/terms" class="underline hover:text-white">
            Terms of Service
          </A>
          . This is a frontend-only mock — clicking the button performs no real
          charge and stores no payment details.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 sm:justify-between">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.submitting}
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-sm transition-colors focus-ring-gold disabled:opacity-50"
        >
          <ArrowLeft class="w-4 h-4" />
          Back to payment
        </button>
        <button
          type="button"
          onClick={props.onPlaceOrder}
          disabled={props.submitting}
          class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-colors focus-ring-gold shadow-lg shadow-purple-900/30 disabled:opacity-70 disabled:cursor-wait min-w-[200px]"
        >
          <Show
            when={!props.submitting}
            fallback={
              <>
                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            }
          >
            <Lock class="w-4 h-4" />
            Place order · {formatPrice(total())}
          </Show>
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 4: Confirmation ───────────────────────── */

function ConfirmationStep(props: {
  orderId: string;
  totalCents: number;
  email: string;
}) {
  return (
    <div class="confirmation-card relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 sm:p-12 text-center shadow-2xl shadow-black/30 max-w-2xl mx-auto">
      <div class="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent rounded-2xl pointer-events-none" />
      <div class="relative z-10 space-y-5">
        <div class="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-300/30 grid place-items-center">
          <CheckCircle2 class="w-10 h-10 text-emerald-300" />
        </div>

        <div class="space-y-2">
          <h2 class="font-display text-3xl text-white tracking-wide">
            Thank you, traveler!
          </h2>
          <p class="text-slate-300/80 max-w-md mx-auto">
            Your support is what keeps the campaign rolling. A receipt has been
            sent to your email.
          </p>
        </div>

        <div class="bg-white/5 border border-white/10 rounded-xl p-4 inline-block min-w-[260px] text-left">
          <p class="text-[10px] uppercase tracking-wider text-slate-400">
            Order number
          </p>
          <p class="font-mono text-base text-gold-300 tracking-wider mt-0.5">
            {props.orderId}
          </p>
          <div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-4 text-sm">
            <span class="text-slate-300">Total charged</span>
            <span class="font-semibold text-white tabular-nums">
              {formatPrice(props.totalCents)}
            </span>
          </div>
          <p class="mt-2 text-xs text-slate-400 truncate">
            Receipt: {props.email}
          </p>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <A
            href="/shop"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-sm transition-colors focus-ring-gold"
          >
            Back to the shop
          </A>
          <A
            href="/"
            class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors focus-ring-gold shadow-lg shadow-purple-900/30"
          >
            Return to game
            <ArrowRight class="w-4 h-4" />
          </A>
        </div>

        <p class="text-[11px] text-slate-500 italic pt-3">
          Frontend-only mock — no real payment was processed.
        </p>
      </div>

      <style jsx>{`
        .confirmation-card { animation: confirmIn 0.45s ease-out; }
        @keyframes confirmIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ───────────────────────── Shared building blocks ───────────────────────── */

function SectionCard(props: {
  icon: JSX.Element;
  title: string;
  subtitle?: string;
  children: JSX.Element;
}) {
  return (
    <section class="relative bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/30">
      <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
      <div class="relative z-10 space-y-4">
        <header class="space-y-1">
          <h3 class="flex items-center gap-2 font-display text-lg text-white tracking-wide">
            {props.icon}
            {props.title}
          </h3>
          <Show when={props.subtitle}>
            <p class="text-xs text-slate-400">{props.subtitle}</p>
          </Show>
        </header>
        {props.children}
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <label class={`block space-y-1.5 ${props.class ?? ""}`}>
      <span class="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-slate-300">
        <span>{props.label}</span>
        <Show when={props.optional}>
          <span class="text-[10px] text-slate-500 normal-case tracking-normal italic">
            optional
          </span>
        </Show>
      </span>
      {props.children}
      <Show when={props.error}>
        <span class="block text-xs text-rose-300">{props.error}</span>
      </Show>
      <Show when={!props.error && props.hint}>
        <span class="block text-xs text-slate-400">{props.hint}</span>
      </Show>
    </label>
  );
}

/* ───────────────────────── Validation ───────────────────────── */

function validateBilling(b: BillingForm): Partial<Record<keyof BillingForm, string>> {
  const errors: Partial<Record<keyof BillingForm, string>> = {};
  if (!b.fullName.trim()) errors.fullName = "Required.";
  else if (b.fullName.trim().length < 2) errors.fullName = "Too short.";

  if (!b.email.trim()) errors.email = "Required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email.trim()))
    errors.email = "Enter a valid email address.";

  if (!b.country) errors.country = "Required.";
  if (!b.addressLine1.trim()) errors.addressLine1 = "Required.";
  if (!b.city.trim()) errors.city = "Required.";

  if (!b.postalCode.trim()) errors.postalCode = "Required.";
  else if (b.postalCode.trim().length < 3) errors.postalCode = "Too short.";

  if ((b.country === "US" || b.country === "CA") && !b.state.trim())
    errors.state = "Required for US/Canada.";

  if (b.isBusiness && getCountry(b.country)?.isEU) {
    if (!b.vatNumber.trim()) errors.vatNumber = "Required for EU businesses.";
    else if (!/^[A-Z]{2}[A-Z0-9]{8,12}$/.test(b.vatNumber.trim()))
      errors.vatNumber = "Format: 2 letters + 8 to 12 alphanumeric chars.";
  }

  return errors;
}

function validatePayment(p: PaymentForm): Partial<Record<keyof PaymentForm, string>> {
  const errors: Partial<Record<keyof PaymentForm, string>> = {};
  if (p.method !== "card") {
    errors.method = "Pick the card method (others are coming soon).";
    return errors;
  }

  const digits = p.cardNumber.replace(/\D/g, "");
  if (!digits) errors.cardNumber = "Required.";
  else if (digits.length < 13 || digits.length > 19)
    errors.cardNumber = "Card number looks too short or too long.";
  else if (!luhnCheck(digits))
    errors.cardNumber = "Card number is invalid (failed checksum).";

  if (!p.cardName.trim()) errors.cardName = "Required.";
  else if (p.cardName.trim().length < 2) errors.cardName = "Too short.";

  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(p.cardExpiry);
  if (!expiryMatch) errors.cardExpiry = "Format: MM/YY.";
  else {
    const month = Number(expiryMatch[1]);
    const year = 2000 + Number(expiryMatch[2]);
    if (month < 1 || month > 12) errors.cardExpiry = "Month must be 01–12.";
    else {
      const now = new Date();
      const expiry = new Date(year, month, 0, 23, 59, 59); // last day of month
      if (expiry.getTime() < now.getTime())
        errors.cardExpiry = "Card has expired.";
    }
  }

  const expectedCvvLength = detectBrand(p.cardNumber) === "amex" ? 4 : 3;
  if (!p.cardCvv) errors.cardCvv = "Required.";
  else if (p.cardCvv.length !== expectedCvvLength)
    errors.cardCvv = `CVV must be ${expectedCvvLength} digits.`;

  return errors;
}

/* ───────────────────────── Card helpers ───────────────────────── */

type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

function detectBrand(input: string): CardBrand {
  const digits = input.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^6(011|5|4[4-9]|22)/.test(digits)) return "discover";
  return "unknown";
}

function brandLabel(b: CardBrand): string {
  switch (b) {
    case "visa":
      return "VISA";
    case "mastercard":
      return "MASTERCARD";
    case "amex":
      return "AMEX";
    case "discover":
      return "DISCOVER";
    default:
      return "CARD";
  }
}

function formatCardNumber(value: string): string {
  const isAmex = detectBrand(value) === "amex";
  const digits = value.replace(/\D/g, "").slice(0, isAmex ? 15 : 19);
  // Amex uses 4-6-5 grouping; everything else uses 4-4-4-4(-3).
  if (isAmex) {
    const a = digits.slice(0, 4);
    const b = digits.slice(4, 10);
    const c = digits.slice(10, 15);
    return [a, b, c].filter(Boolean).join(" ");
  }
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function luhnCheck(digitsOnly: string): boolean {
  if (!/^\d+$/.test(digitsOnly)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let n = digitsOnly.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function generateOrderId(): string {
  // Format: DND-YYYYMMDD-XXXXX (X = uppercase alphanum)
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `DND-${ymd}-${suffix}`;
}
