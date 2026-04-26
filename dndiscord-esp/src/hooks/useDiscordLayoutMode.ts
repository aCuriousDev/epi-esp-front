import { createSignal, onCleanup, onMount } from "solid-js";

export type DiscordLayoutMode = "focused" | "pip" | "grid";

const MODE_BY_ENUM: Record<number, DiscordLayoutMode> = {
  0: "focused",
  1: "pip",
  2: "grid",
};

/**
 * Subscribes to Discord Embedded App SDK ACTIVITY_LAYOUT_MODE_UPDATE.
 * Returns "focused" outside Discord or before the SDK is ready.
 */
export function useDiscordLayoutMode(): () => DiscordLayoutMode {
  const [mode, setMode] = createSignal<DiscordLayoutMode>("focused");

  onMount(async () => {
    try {
      const { getDiscordSdk } = await import("../discord");
      const sdk = getDiscordSdk();
      if (!sdk) return;

      await sdk.ready();

      const handler = (data: { layout_mode?: number }) => {
        const v = data?.layout_mode;
        if (typeof v === "number" && MODE_BY_ENUM[v] !== undefined) {
          setMode(MODE_BY_ENUM[v]);
        }
      };

      // Event names are stringly-typed in SDK v2; cast avoids a hard dep.
      (sdk as unknown as {
        subscribe: (event: string, cb: (d: unknown) => void) => void;
      }).subscribe("ACTIVITY_LAYOUT_MODE_UPDATE", handler as (d: unknown) => void);

      onCleanup(() => {
        try {
          (sdk as unknown as {
            unsubscribe: (event: string, cb: (d: unknown) => void) => void;
          }).unsubscribe(
            "ACTIVITY_LAYOUT_MODE_UPDATE",
            handler as (d: unknown) => void,
          );
        } catch {
          // SDK already torn down — ignore.
        }
      });
    } catch {
      // Outside Discord (no SDK reachable) — stay "focused".
    }
  });

  return mode;
}
