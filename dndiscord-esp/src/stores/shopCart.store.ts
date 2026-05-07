/**
 * Shop Cart Store
 *
 * Reactive cart state for the support shop. Persisted to localStorage so it
 * survives reloads and tab restarts. Items are stored as `{ itemId, quantity }`
 * pairs; full item data is resolved from `shopCatalog.ts` on demand to keep
 * the persisted payload minimal and forward-compatible with catalog updates.
 *
 * Frontend-only mock — no payment processor, no server sync.
 */

import { createMemo, createSignal } from "solid-js";
import {
  findShopItem,
  vatRateFor,
  type ShopItem,
} from "../data/shopCatalog";

const STORAGE_KEY = "dndiscord_shop_cart_v1";

export interface CartLine {
  itemId: string;
  quantity: number;
}

export interface ResolvedCartLine {
  line: CartLine;
  item: ShopItem;
  /** quantity × priceCents */
  lineTotalCents: number;
}

interface PersistedCart {
  lines: CartLine[];
}

/* ───────────────────────── Persistence ───────────────────────── */

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedCart;
    if (!parsed || !Array.isArray(parsed.lines)) return [];
    // Drop any line whose item no longer exists in the catalog and clamp
    // the quantity to the item's allowed range.
    return parsed.lines
      .map((l) => {
        const item = findShopItem(l.itemId);
        if (!item) return null;
        const qty = Math.max(
          1,
          Math.min(item.maxQuantity, Math.floor(Number(l.quantity) || 1)),
        );
        return { itemId: l.itemId, quantity: qty };
      })
      .filter((l): l is CartLine => l !== null);
  } catch {
    return [];
  }
}

function persist(lines: CartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines }));
  } catch {
    /* storage unavailable (private mode, quota) — non-fatal */
  }
}

/* ───────────────────────── Reactive state ───────────────────────── */

const [lines, setLines] = createSignal<CartLine[]>(load());

function commit(next: CartLine[]) {
  setLines(next);
  persist(next);
}

/* ───────────────────────── Actions ───────────────────────── */

function addItem(itemId: string, qty: number = 1): void {
  const item = findShopItem(itemId);
  if (!item) return;

  const current = lines();
  const idx = current.findIndex((l) => l.itemId === itemId);
  if (idx >= 0) {
    const desired = current[idx].quantity + qty;
    const clamped = Math.max(1, Math.min(item.maxQuantity, desired));
    if (clamped === current[idx].quantity) return;
    const next = current.slice();
    next[idx] = { ...next[idx], quantity: clamped };
    commit(next);
  } else {
    const clamped = Math.max(1, Math.min(item.maxQuantity, qty));
    commit([...current, { itemId, quantity: clamped }]);
  }
}

function setQuantity(itemId: string, qty: number): void {
  const item = findShopItem(itemId);
  if (!item) return;

  const current = lines();
  const idx = current.findIndex((l) => l.itemId === itemId);
  if (idx < 0) return;

  if (qty <= 0) {
    commit(current.filter((l) => l.itemId !== itemId));
    return;
  }
  const clamped = Math.max(1, Math.min(item.maxQuantity, Math.floor(qty)));
  if (clamped === current[idx].quantity) return;

  const next = current.slice();
  next[idx] = { ...next[idx], quantity: clamped };
  commit(next);
}

function removeItem(itemId: string): void {
  const next = lines().filter((l) => l.itemId !== itemId);
  if (next.length !== lines().length) commit(next);
}

function clear(): void {
  if (lines().length === 0) return;
  commit([]);
}

/* ───────────────────────── Derived state ───────────────────────── */

const resolvedLines = createMemo<ResolvedCartLine[]>(() =>
  lines()
    .map((line) => {
      const item = findShopItem(line.itemId);
      if (!item) return null;
      return {
        line,
        item,
        lineTotalCents: item.priceCents * line.quantity,
      } satisfies ResolvedCartLine;
    })
    .filter((x): x is ResolvedCartLine => x !== null),
);

const itemCount = createMemo<number>(() =>
  resolvedLines().reduce((sum, rl) => sum + rl.line.quantity, 0),
);

const isEmpty = createMemo<boolean>(() => resolvedLines().length === 0);

const subtotalCents = createMemo<number>(() =>
  resolvedLines().reduce((sum, rl) => sum + rl.lineTotalCents, 0),
);

/** Compute VAT for a given country and the current cart subtotal. */
function taxCentsFor(countryCode: string): number {
  const rate = vatRateFor(countryCode);
  if (rate <= 0) return 0;
  return Math.round(subtotalCents() * rate);
}

/** Compute final total (subtotal + tax) for a given country. */
function totalCentsFor(countryCode: string): number {
  return subtotalCents() + taxCentsFor(countryCode);
}

/* ───────────────────────── Public API ───────────────────────── */

export const shopCart = {
  // Raw lines (mostly internal — pages should prefer `resolvedLines`)
  lines,
  // Resolved + derived
  resolvedLines,
  itemCount,
  isEmpty,
  subtotalCents,
  taxCentsFor,
  totalCentsFor,
  // Actions
  add: addItem,
  setQuantity,
  remove: removeItem,
  clear,
};
