import { Component, For, createMemo } from "solid-js";
import { partyChatState } from "../stores/partyChat.store";
import { sessionState } from "../stores/session.store";

export const PartyChatPanel: Component = () => {
  const messages = createMemo(() => {
    const sid = sessionState.session?.sessionId;
    if (!sid) return [];
    return partyChatState.messages.filter((m) => m.sessionId === sid);
  });

  return (
    <div class="panel-game">
      <h4 class="font-fantasy text-game-gold text-sm mb-3">Chat (voice)</h4>
      <div class="max-h-64 overflow-y-auto space-y-2 pr-1" role="log" aria-live="polite" aria-label="Party chat messages">
        <For
          each={messages()}
          fallback={
            <p class="text-xs text-gray-500">No messages yet.</p>
          }
        >
          {(m) => (
            <div class="text-xs">
              <div class="flex items-center gap-2">
                <span
                  class={`px-1.5 py-0.5 rounded border text-[10px] ${
                    m.authorRole === "DM"
                      ? "border-game-gold/50 text-game-gold bg-game-gold/10"
                      : "border-white/10 text-gray-300 bg-white/5"
                  }`}
                >
                  {m.authorRole === "DM" ? "MJ" : "Joueur"}
                </span>
                <span class="text-gray-200 font-medium truncate">
                  {m.authorName}
                </span>
                <span class="text-gray-500">
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div class="text-gray-300 break-words mt-0.5">{m.content}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
