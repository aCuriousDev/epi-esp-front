import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { Plus, Minus } from "lucide-solid";
import "../services/iconSetup";
import { InventoryService } from "../services/inventory.service";
import { signalRService } from "../services/signalr/SignalRService";
import type { WalletDto, WalletChangedEvent } from "../types/inventory";

interface WalletPanelProps {
  characterId: string;
  isMJ?: boolean;
}

interface CoinDef {
  key: keyof Omit<WalletDto, "totalInCopper">;
  label: string;
  abbr: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  ring: string;
}

const COINS: CoinDef[] = [
  {
    key: "platinumPieces",
    label: "Platine",
    abbr: "PP",
    icon: "game-icons:crown-coin",
    color: "text-slate-100",
    bg: "from-slate-400/20 to-slate-300/10",
    border: "border-slate-300/30",
    ring: "ring-slate-300/20",
  },
  {
    key: "goldPieces",
    label: "Or",
    abbr: "PO",
    icon: "game-icons:gold-stack",
    color: "text-yellow-300",
    bg: "from-yellow-500/20 to-amber-400/10",
    border: "border-yellow-400/30",
    ring: "ring-yellow-400/20",
  },
  {
    key: "electrumPieces",
    label: "Électrum",
    abbr: "PE",
    icon: "game-icons:coinflip",
    color: "text-blue-300",
    bg: "from-blue-500/20 to-cyan-400/10",
    border: "border-blue-400/30",
    ring: "ring-blue-400/20",
  },
  {
    key: "silverPieces",
    label: "Argent",
    abbr: "PA",
    icon: "game-icons:two-coins",
    color: "text-slate-300",
    bg: "from-slate-500/20 to-gray-400/10",
    border: "border-slate-400/30",
    ring: "ring-slate-400/20",
  },
  {
    key: "copperPieces",
    label: "Cuivre",
    abbr: "PC",
    icon: "game-icons:coins-pile",
    color: "text-orange-400",
    bg: "from-orange-500/20 to-amber-600/10",
    border: "border-orange-400/30",
    ring: "ring-orange-400/20",
  },
];

export default function WalletPanel(props: WalletPanelProps) {
  const [wallet, setWallet] = createSignal<WalletDto>({
    copperPieces: 0,
    silverPieces: 0,
    electrumPieces: 0,
    goldPieces: 0,
    platinumPieces: 0,
    totalInCopper: 0,
  });
  const [loading, setLoading] = createSignal(true);
  const [modifying, setModifying] = createSignal<string | null>(null);

  const loadWallet = async () => {
    try {
      const data = await InventoryService.getWallet(props.characterId);
      setWallet(data);
    } catch (err) {
      console.error("Failed to load wallet", err);
    } finally {
      setLoading(false);
    }
  };

  const handleModify = async (coinKey: string, delta: number) => {
    setModifying(coinKey);
    try {
      const request: Record<string, number> = {
        copperPieces: 0,
        silverPieces: 0,
        electrumPieces: 0,
        goldPieces: 0,
        platinumPieces: 0,
      };
      request[coinKey] = delta;
      const updated = await InventoryService.modifyWallet(
        props.characterId,
        request,
      );
      setWallet(updated);
    } catch (err) {
      console.error("Failed to modify wallet", err);
    } finally {
      setTimeout(() => setModifying(null), 300);
    }
  };

  // SignalR
  const handleWalletChanged = (evt: WalletChangedEvent) => {
    if (evt.characterId !== props.characterId) return;
    setWallet(evt.wallet);
  };

  let unsubscribe: (() => void) | null = null;

  onMount(async () => {
    await loadWallet();

    const subscribe = () => {
      unsubscribe = InventoryService.onWalletChanged(handleWalletChanged);
    };

    if (signalRService.isConnected) {
      subscribe();
    } else {
      const retry = setInterval(() => {
        if (signalRService.isConnected) {
          clearInterval(retry);
          subscribe();
        }
      }, 500);
      setTimeout(() => clearInterval(retry), 5000);
    }
  });

  onCleanup(() => {
    if (unsubscribe) unsubscribe();
  });

  return (
    <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl mb-4">
      {/* Header */}
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/30 via-amber-400/20 to-orange-500/30 border border-yellow-400/30 flex items-center justify-center shadow-lg shadow-yellow-500/10">
          <Icon icon="game-icons:shiny-purse" width="1.4em" height="1.4em" class="text-yellow-300" />
        </div>
        <h3 class="font-display text-lg text-white leading-tight">Bourse</h3>
      </div>

      <Show
        when={!loading()}
        fallback={
          <div class="flex items-center justify-center py-6">
            <div class="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        }
      >
        <div class="grid grid-cols-5 gap-2">
          <For each={COINS}>
            {(coin) => {
              const value = () => wallet()[coin.key] as number;
              const isModifying = () => modifying() === coin.key;
              return (
                <div
                  class={`relative rounded-xl bg-gradient-to-br ${coin.bg} border ${coin.border} ring-1 ${coin.ring} p-3 text-center transition-all ${
                    isModifying() ? "scale-95" : "hover:scale-[1.02]"
                  }`}
                >
                  {/* Coin icon */}
                  <div class="flex items-center justify-center mb-1.5">
                    <Icon icon={coin.icon} width="2em" height="2em" class={coin.color} />
                  </div>

                  {/* Value + label */}
                  <div class={`text-xl font-bold ${coin.color} tabular-nums`}>
                    {value()}
                  </div>
                  <div class="text-[10px] text-slate-400 font-semibold mt-0.5 leading-tight">
                    {coin.label}
                  </div>

                  {/* +/- controls (MJ only) */}
                  <Show when={props.isMJ}>
                    <div class="flex gap-1 mt-2 justify-center">
                      <button
                        onClick={() => handleModify(coin.key, -1)}
                        disabled={value() === 0}
                        class="w-6 h-6 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={`Retirer 1 ${coin.label}`}
                      >
                        <Minus class="w-3 h-3 text-red-400" />
                      </button>
                      <button
                        onClick={() => handleModify(coin.key, 1)}
                        class="w-6 h-6 rounded bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 flex items-center justify-center transition-colors"
                        title={`Ajouter 1 ${coin.label}`}
                      >
                        <Plus class="w-3 h-3 text-green-400" />
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
