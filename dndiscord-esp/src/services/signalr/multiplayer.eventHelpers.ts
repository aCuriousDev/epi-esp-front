/**
 * Pure event helpers extracted from multiplayer.service.ts — importable in tests
 * without pulling in SolidJS stores.
 */

import type {
  CharacterProgressedPublicPayload,
  GoldGrantedPublicPayload,
} from "../../types/multiplayer";

export function unwrapPayload<T>(message: T | { payload?: T }): T {
  return ((message as { payload?: T })?.payload ?? message) as T;
}

export function dispatchProgressionPublic(payload: CharacterProgressedPublicPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CharacterProgressedPublicPayload>("dm-character-progressed-public", {
      detail: payload,
    }),
  );
}

export function dispatchGoldGrantedPublic(payload: GoldGrantedPublicPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<GoldGrantedPublicPayload>("dm-gold-granted-public", {
      detail: payload,
    }),
  );
}
