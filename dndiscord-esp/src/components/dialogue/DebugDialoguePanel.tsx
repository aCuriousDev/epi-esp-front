import { Component, createSignal, For } from "solid-js";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-solid";
import { getPlayerUnits } from "../../game/stores/UnitsStore";
import { showPlayerBubble, showDmMessage } from "../../stores/dialogue.store";

// Couleurs assignées aux joueurs pour les bulles
const PLAYER_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"];

export const DebugDialoguePanel: Component = () => {
  const [collapsed, setCollapsed] = createSignal(true);
  const [text, setText] = createSignal("");
  const [selectedUnitId, setSelectedUnitId] = createSignal("");
  const [isDm, setIsDm] = createSignal(false);

  const playerUnits = () => getPlayerUnits();

  const send = () => {
    const msg = text().trim();
    if (!msg) return;

    if (isDm()) {
      showDmMessage(msg);
    } else {
      const unitId = selectedUnitId();
      const players = playerUnits();
      const unit = players.find((u) => u.id === unitId) ?? players[0];
      if (!unit) return;

      const idx = players.indexOf(unit);
      const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
      showPlayerBubble(unit.id, msg, unit.name, color);
      // Auto-select this unit for next time
      setSelectedUnitId(unit.id);
    }

    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      class="absolute top-14 right-4 z-50"
      style={{ "max-width": "320px" }}
    >
      {/* Toggle button */}
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        classList={{
          "bg-purple-600/80 border-purple-400/40 text-white hover:bg-purple-600": true,
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <MessageCircle class="w-3.5 h-3.5" />
        <span>Debug Dialogue</span>
        {collapsed() ? (
          <ChevronUp class="w-3 h-3" />
        ) : (
          <ChevronDown class="w-3 h-3" />
        )}
      </button>

      {/* Panel body */}
      {!collapsed() && (
        <div
          class="mt-2 p-3 rounded-xl border border-white/10 backdrop-blur-lg space-y-3"
          style={{ background: "rgba(15, 15, 25, 0.9)" }}
        >
          {/* DM toggle */}
          <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-300 select-none">
            <input
              type="checkbox"
              checked={isDm()}
              onChange={(e) => setIsDm(e.currentTarget.checked)}
              class="accent-purple-500 w-3.5 h-3.5"
            />
            Parler en tant que MJ
          </label>

          {/* Player dropdown (hidden when DM mode) */}
          {!isDm() && (
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                Joueur
              </label>
              <select
                class="w-full bg-game-dark border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                value={selectedUnitId()}
                onChange={(e) => setSelectedUnitId(e.currentTarget.value)}
              >
                <For each={playerUnits()}>
                  {(unit) => <option value={unit.id}>{unit.name}</option>}
                </For>
              </select>
            </div>
          )}

          {/* Text input */}
          <div>
            <input
              type="text"
              class="w-full bg-game-dark border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              placeholder={isDm() ? "Message du MJ…" : "Message du joueur…"}
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Send button */}
          <button
            class="w-full py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 transition-colors disabled:opacity-40"
            disabled={!text().trim()}
            onClick={send}
          >
            Envoyer
          </button>
        </div>
      )}
    </div>
  );
};
