import { Component, Show, createSignal } from "solid-js";
import { Users, LogOut, UserX, Loader2 } from "lucide-solid";
import { sessionState, setSessionLoading, setSessionError } from "../stores/session.store";
import {
  createSession,
  joinSession,
  leaveSession,
  kickPlayer,
  ensureMultiplayerHandlersRegistered,
} from "../services/signalr/multiplayer.service";
import { signalRService } from "../services/signalr/SignalRService";
import { authStore } from "../stores/auth.store";
import { PlayerRole } from "../types/multiplayer";

export const SessionPanel: Component = () => {
  const [campaignIdInput, setCampaignIdInput] = createSignal("");
  const [sessionIdInput, setSessionIdInput] = createSignal("");

  const isDm = () => {
    const session = sessionState.session;
    const userId = authStore.user()?.id;
    if (!session || !userId) return false;
    return session.players.some((p) => p.userId === userId && p.role === PlayerRole.DungeonMaster);
  };

  const handleConnectAndCreate = async () => {
    const campaignId = campaignIdInput().trim();
    if (!campaignId) {
      setSessionError("Enter a campaign ID (GUID).");
      return;
    }
    setSessionError(null);
    setSessionLoading(true);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
        ensureMultiplayerHandlersRegistered();
      }
      await createSession(campaignId);
    } catch (e: any) {
      setSessionError(e?.message ?? "Failed to create session.");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleConnectAndJoin = async () => {
    const sessionId = sessionIdInput().trim();
    if (!sessionId) {
      setSessionError("Enter the session ID to join.");
      return;
    }
    setSessionError(null);
    setSessionLoading(true);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
        ensureMultiplayerHandlersRegistered();
      }
      const result = await joinSession(sessionId);
      if (!result.success) setSessionError(result.message ?? "Failed to join.");
    } catch (e: any) {
      setSessionError(e?.message ?? "Failed to join session.");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleLeave = async () => {
    setSessionLoading(true);
    try {
      await leaveSession();
    } catch (e: any) {
      setSessionError(e?.message ?? "Error leaving session.");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleKick = async (userId: string) => {
    try {
      await kickPlayer(userId);
    } catch (e: any) {
      setSessionError(e?.message ?? "Error kicking player.");
    }
  };

  return (
    <div class="panel-game">
      <h3 class="font-fantasy text-game-gold text-lg mb-3 flex items-center gap-2">
        <Users class="w-5 h-5" />
        Multiplayer
      </h3>

      <Show when={sessionState.error}>
        <p class="text-red-400 text-sm mb-3">{sessionState.error}</p>
      </Show>

      <Show
        when={sessionState.session}
        fallback={
          <div class="space-y-4">
            <p class="text-gray-400 text-sm">
              Connect to the hub then create or join a session.
            </p>
            <div class="space-y-2">
              <label class="block text-xs text-gray-500">Campaign ID (create a session)</label>
              <input
                type="text"
                placeholder="ex: 550e8400-e29b-41d4-a716-446655440000"
                class="w-full px-3 py-2 rounded bg-black/30 border border-white/20 text-white text-sm placeholder-gray-500"
                value={campaignIdInput()}
                onInput={(e) => setCampaignIdInput(e.currentTarget.value)}
              />
              <button
                class="btn-game w-full flex items-center justify-center gap-2 py-2"
                onClick={handleConnectAndCreate}
                disabled={sessionState.isLoading}
              >
                <Show when={sessionState.isLoading} fallback={<span>Create session</span>}>
                  <Loader2 class="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </Show>
              </button>
            </div>
            <div class="border-t border-white/10 pt-3 space-y-2">
              <label class="block text-xs text-gray-500">Session ID (join)</label>
              <input
                type="text"
                placeholder="ex: session_abc123..."
                class="w-full px-3 py-2 rounded bg-black/30 border border-white/20 text-white text-sm placeholder-gray-500"
                value={sessionIdInput()}
                onInput={(e) => setSessionIdInput(e.currentTarget.value)}
              />
              <button
                class="btn-game w-full flex items-center justify-center gap-2 py-2"
                onClick={handleConnectAndJoin}
                disabled={sessionState.isLoading}
              >
                <Show when={sessionState.isLoading} fallback={<span>Join</span>}>
                  <Loader2 class="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </Show>
              </button>
            </div>
          </div>
        }
      >
        <div class="space-y-3">
          <p class="text-gray-400 text-sm">
            Session: <span class="text-game-gold font-mono text-xs">{sessionState.session!.sessionId.slice(0, 12)}…</span>
          </p>
          <p class="text-sm text-gray-300">
            Players ({sessionState.session!.playerCount}/{sessionState.session!.maxPlayers})
          </p>
          <ul class="space-y-1.5">
            {sessionState.session!.players.map((p) => (
              <li class="flex items-center justify-between gap-2 text-sm">
                <span class="text-gray-300 truncate">
                  {p.userName}
                  {p.role === PlayerRole.DungeonMaster && (
                    <span class="ml-1 text-game-gold text-xs">(DM)</span>
                  )}
                </span>
                <Show when={isDm() && p.role !== PlayerRole.DungeonMaster}>
                  <button
                    class="p-1 rounded text-red-400 hover:bg-red-500/20"
                    onClick={() => handleKick(p.userId)}
                    title="Kick"
                  >
                    <UserX class="w-3.5 h-3.5" />
                  </button>
                </Show>
              </li>
            ))}
          </ul>
          <button
            class="w-full flex items-center justify-center gap-2 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 text-sm"
            onClick={handleLeave}
          >
            <LogOut class="w-4 h-4" />
            Quitter la session
          </button>
        </div>
      </Show>
    </div>
  );
};
