import { createSignal, For, Show } from "solid-js";
import { Dices, X } from "lucide-solid";
import { signalRService } from "../../services/signalr/SignalRService";
import { getOtherPlayers } from "../../stores/session.store";
import { pendingRequestsForDm } from "../../stores/diceRequests.store";
import { playMenuClickSound } from "../../game/audio/SoundIntegration";
import type { PlayerInfo } from "../../types/multiplayer";

export default function DiceRequestPanel() {
  const [label, setLabel] = createSignal("");
  const [targetAll, setTargetAll] = createSignal(true);
  const [selected, setSelected] = createSignal<string[]>([]);
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const nonDmPlayers = (): PlayerInfo[] => getOtherPlayers();

  function toggleSelected(userId: string): void {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  async function requestRoll(): Promise<void> {
    setError(null);
    setSending(true);
    playMenuClickSound();
    try {
      await signalRService.invoke("DmRequestRoll", {
        diceType: "d20",
        targetUserIds: targetAll() ? [] : selected(),
        label: label().trim() || null,
      });
      setLabel("");
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSending(false);
    }
  }

  async function cancelRoll(requestId: string): Promise<void> {
    try {
      await signalRService.invoke("DmCancelRollRequest", requestId);
    } catch {
      // Idempotent server-side — silent swallow.
    }
  }

  return (
    <div class="mt-2 space-y-2">
      <input
        class="dm-input w-full"
        placeholder="Label (ex: Perception)"
        value={label()}
        onInput={(e) => setLabel(e.currentTarget.value)}
      />

      <label class="dm-input flex items-center gap-2 cursor-pointer py-1.5">
        <input
          type="checkbox"
          class="accent-purple-500"
          checked={targetAll()}
          onChange={(e) => setTargetAll(e.currentTarget.checked)}
        />
        <span>Tous les joueurs</span>
      </label>

      <Show when={!targetAll()}>
        <div class="space-y-1 max-h-28 overflow-y-auto">
          <For each={nonDmPlayers()}>
            {(p: PlayerInfo) => (
              <label class="dm-input flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  class="accent-purple-500"
                  checked={selected().includes(p.userId)}
                  onChange={() => toggleSelected(p.userId)}
                />
                <span>{p.userName}</span>
              </label>
            )}
          </For>
        </div>
      </Show>

      <button
        class="dm-btn w-full flex items-center justify-center gap-2"
        disabled={sending() || (!targetAll() && selected().length === 0)}
        onClick={requestRoll}
      >
        <Dices class="w-3 h-3" />
        Demander un jet
      </button>

      <Show when={error()}>
        <p class="text-rose-400 text-xs">{error()}</p>
      </Show>

      <Show when={pendingRequestsForDm().length > 0}>
        <div class="space-y-1 max-h-32 overflow-y-auto mt-2 pt-2 border-t border-purple-500/20">
          <For each={pendingRequestsForDm()}>
            {(req) => {
              const submittedCount = () => Object.keys(req.results).length;
              return (
                <div class="flex items-center gap-1 text-[10px] text-purple-300/80 bg-purple-500/5 rounded-lg px-2 py-1 border border-purple-500/15">
                  <span class="flex-1 truncate">
                    {req.label ?? "Jet de dé"}
                  </span>
                  <span>
                    {submittedCount()}/{req.expectedCount}
                  </span>
                  <button
                    class="text-rose-400/60 hover:text-rose-300"
                    onClick={() => cancelRoll(req.requestId)}
                    aria-label="Annuler"
                  >
                    <X class="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
