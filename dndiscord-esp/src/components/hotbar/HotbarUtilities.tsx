import { Component, Show } from "solid-js";
import { Package, Coins, Flag } from "lucide-solid";

interface HotbarUtilitiesProps {
  onOpenInventory: () => void;
  onOpenWallet: () => void;
  /** True when "Fin du tour" should surface. */
  canEndTurn: boolean;
  onEndTurn: () => void;
}

/**
 * Right cluster of the hotbar — inventory toggle, wallet toggle, end-turn.
 */
export const HotbarUtilities: Component<HotbarUtilitiesProps> = (props) => {
  return (
    <div class="flex items-end gap-1.5">
      <div class="flex items-end gap-1.5 px-2 py-2 rounded-xl bg-gradient-to-br from-zinc-950/85 to-slate-950/85 border border-white/10 shadow-lg backdrop-blur-sm">
        <button
          onClick={props.onOpenInventory}
          class="flex flex-col items-center justify-center w-11 h-11 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 hover:border-white/20 text-slate-200 transition-colors focus-ring-gold"
          title="Inventaire"
        >
          <Package class="w-4 h-4" />
          <span class="text-[8px] mt-0.5 uppercase tracking-wider">Sac</span>
        </button>
        <button
          onClick={props.onOpenWallet}
          class="flex flex-col items-center justify-center w-11 h-11 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 hover:border-white/20 text-amber-200 transition-colors focus-ring-gold"
          title="Portefeuille"
        >
          <Coins class="w-4 h-4" />
          <span class="text-[8px] mt-0.5 uppercase tracking-wider">Or</span>
        </button>
      </div>

      <Show when={props.canEndTurn}>
        <button
          onClick={props.onEndTurn}
          class="flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-500 to-amber-600 text-game-darker hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/30 transition-colors focus-ring-gold font-bold"
          title="Fin du tour"
        >
          <Flag class="w-4 h-4" />
          <span class="text-[9px] mt-0.5 uppercase tracking-wider">Fin</span>
        </button>
      </Show>
    </div>
  );
};
