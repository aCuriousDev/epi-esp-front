import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "node:events";
import {
  unwrapPayload,
  dispatchProgressionPublic,
  dispatchGoldGrantedPublic,
} from "../multiplayer.eventHelpers";
import type {
  CharacterProgressedPublicPayload,
  GoldGrantedPublicPayload,
} from "../../../types/multiplayer";

// ---------------------------------------------------------------------------
// Minimal window shim for Node — only what dispatchProgressionPublic /
// dispatchGoldGrantedPublic actually touch (dispatchEvent + CustomEvent).
// ---------------------------------------------------------------------------

class MockEventTarget {
  private _listeners: Map<string, Array<(e: Event) => void>> = new Map();

  addEventListener(type: string, fn: (e: Event) => void) {
    const list = this._listeners.get(type) ?? [];
    list.push(fn);
    this._listeners.set(type, list);
  }

  removeEventListener(type: string, fn: (e: Event) => void) {
    const list = this._listeners.get(type) ?? [];
    this._listeners.set(type, list.filter((f) => f !== fn));
  }

  dispatchEvent(event: Event): boolean {
    const type = (event as { type: string }).type;
    for (const fn of this._listeners.get(type) ?? []) fn(event);
    return true;
  }
}

let mockWindow: MockEventTarget;

beforeAll(() => {
  mockWindow = new MockEventTarget();
  // Inject into globalThis so typeof window !== "undefined" inside the helper
  (globalThis as any).window = mockWindow;
  // CustomEvent is not defined in Node — provide a minimal shim
  if (typeof (globalThis as any).CustomEvent === "undefined") {
    (globalThis as any).CustomEvent = class CustomEvent<T> extends EventEmitter {
      type: string;
      detail: T;
      constructor(type: string, init?: { detail?: T }) {
        super();
        this.type = type;
        this.detail = init?.detail as T;
      }
    };
  }
});

afterAll(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).CustomEvent;
});

// ---------------------------------------------------------------------------
// unwrapPayload
// ---------------------------------------------------------------------------

describe("unwrapPayload", () => {
  it("returns the message directly when there is no .payload wrapper", () => {
    const msg = { targetUserId: "u1", newLevel: 5, levelUps: 1, targetCharacterName: "Aria" };
    expect(unwrapPayload(msg)).toBe(msg);
  });

  it("unwraps .payload when the message is a GameMessage wrapper", () => {
    const inner = { targetUserId: "u2", amount: 10, currencyType: "gp" as const };
    const wrapped = { type: "GoldGrantedPublic", sequenceNumber: 1, payload: inner };
    expect(unwrapPayload(wrapped)).toBe(inner);
  });

  it("returns message directly when .payload is undefined", () => {
    const msg = { targetUserId: "u3" } as any;
    expect(unwrapPayload(msg)).toBe(msg);
  });

  it("returns null without throwing when message is null", () => {
    expect(unwrapPayload<unknown>(null as any)).toBeNull();
  });

  it("returns undefined without throwing when message is undefined", () => {
    expect(unwrapPayload<unknown>(undefined as any)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// dispatchProgressionPublic
// ---------------------------------------------------------------------------

describe("dispatchProgressionPublic", () => {
  it("dispatches a CustomEvent with type 'dm-character-progressed-public'", () => {
    const received: Event[] = [];
    mockWindow.addEventListener("dm-character-progressed-public", (e) => received.push(e));

    const payload: CharacterProgressedPublicPayload = {
      targetUserId: "u1",
      targetCharacterName: "Aria",
      newLevel: 5,
      levelUps: 1,
    };

    dispatchProgressionPublic(payload);

    expect(received).toHaveLength(1);
    const evt = received[0] as CustomEvent<CharacterProgressedPublicPayload>;
    expect(evt.type).toBe("dm-character-progressed-public");
    expect(evt.detail).toEqual(payload);
  });

  it("carries the payload in event.detail verbatim", () => {
    const received: CustomEvent<CharacterProgressedPublicPayload>[] = [];
    mockWindow.addEventListener("dm-character-progressed-public", (e) =>
      received.push(e as CustomEvent<CharacterProgressedPublicPayload>),
    );

    const payload: CharacterProgressedPublicPayload = {
      targetUserId: "u99",
      targetCharacterName: "Thorin",
      newLevel: 10,
      levelUps: 2,
    };

    dispatchProgressionPublic(payload);
    const last = received[received.length - 1];
    expect(last.detail).toBe(payload);
  });
});

// ---------------------------------------------------------------------------
// dispatchGoldGrantedPublic
// ---------------------------------------------------------------------------

describe("dispatchGoldGrantedPublic", () => {
  it("dispatches a CustomEvent with type 'dm-gold-granted-public'", () => {
    const received: Event[] = [];
    mockWindow.addEventListener("dm-gold-granted-public", (e) => received.push(e));

    const payload: GoldGrantedPublicPayload = {
      targetUserId: "u2",
      targetCharacterName: "Legolas",
      currencyType: "gp",
      amount: 50,
    };

    dispatchGoldGrantedPublic(payload);

    expect(received).toHaveLength(1);
    const evt = received[0] as CustomEvent<GoldGrantedPublicPayload>;
    expect(evt.type).toBe("dm-gold-granted-public");
    expect(evt.detail).toEqual(payload);
  });

  it("carries the correct currencyType in event.detail", () => {
    const received: CustomEvent<GoldGrantedPublicPayload>[] = [];
    mockWindow.addEventListener("dm-gold-granted-public", (e) =>
      received.push(e as CustomEvent<GoldGrantedPublicPayload>),
    );

    const payload: GoldGrantedPublicPayload = {
      targetUserId: "u3",
      targetCharacterName: "Gimli",
      currencyType: "pp",
      amount: 5,
    };

    dispatchGoldGrantedPublic(payload);
    const last = received[received.length - 1];
    expect(last.detail.currencyType).toBe("pp");
    expect(last.detail.amount).toBe(5);
  });
});
