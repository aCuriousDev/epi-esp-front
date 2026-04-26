import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { signalRService } from "../services/signalr/SignalRService";
import {
  ensureMultiplayerHandlersRegistered,
  joinSession,
  subscribeActivity,
  unsubscribeActivity,
} from "../services/signalr/multiplayer.service";
import { getDiscordContextIds } from "../services/discord";
import { authStore } from "../stores/auth.store";

type SessionStartedPayload = {
  sessionId: string;
  campaignId?: string;
  startedByUserId?: string;
  startedByUserName?: string;
  guildId?: string;
  voiceChannelId?: string;
  timestamp?: string;
};

export default function SessionInviteListener() {
  const navigate = useNavigate();
  const [invite, setInvite] = createSignal<SessionStartedPayload | null>(null);
  const [joining, setJoining] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let cleanupFn: (() => void) | null = null;
  onCleanup(() => cleanupFn?.());

  onMount(async () => {
    // On ne force pas la connexion si l'utilisateur n'est pas auth
    if (!authStore.isAuthenticated()) return;

    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
        ensureMultiplayerHandlersRegistered();
      }

      let ctx = getDiscordContextIds();
      let guildId = ctx?.guildId || "";
      let voiceChannelId = ctx?.voiceChannelId || ctx?.channelId || "";

      if (!guildId || !voiceChannelId) {
        await new Promise<void>((resolve) => setTimeout(resolve, 2500));
        ctx = getDiscordContextIds();
        guildId = ctx?.guildId || "";
        voiceChannelId = ctx?.voiceChannelId || ctx?.channelId || "";
      }

      const handler = (data: Record<string, unknown>) => {
        const payload: SessionStartedPayload = {
          sessionId: String(data.sessionId ?? data.SessionId ?? ""),
          campaignId: String(data.campaignId ?? data.CampaignId ?? ""),
          startedByUserId: (data.startedByUserId ?? data.StartedByUserId) as
            | string
            | undefined,
          startedByUserName: (data.startedByUserName ??
            data.StartedByUserName) as string | undefined,
          guildId: (data.guildId ?? data.GuildId) as string | undefined,
          voiceChannelId: (data.voiceChannelId ?? data.VoiceChannelId) as
            | string
            | undefined,
          timestamp: (data.timestamp ?? data.Timestamp) as string | undefined,
        };

        if (!payload.sessionId) return;

        // Ne pas afficher la demande à celui qui a démarré la session
        const me = authStore.user()?.id;
        if (
          me &&
          payload.startedByUserId &&
          String(payload.startedByUserId) === String(me)
        ) {
          return;
        }

        setError(null);
        setInvite(payload);
      };

      signalRService.on("ActivitySessionStarted", handler);

      // Abonnement "activité" (si on est bien dans Discord)
      if (guildId && voiceChannelId) {
        await subscribeActivity(guildId, voiceChannelId);
      }

      cleanupFn = () => {
        try {
          signalRService.off("ActivitySessionStarted", handler);
        } catch {}

        if (signalRService.isConnected && guildId && voiceChannelId) {
          unsubscribeActivity(guildId, voiceChannelId).catch(() => undefined);
        }
      };
    } catch (e) {
      // Best-effort: pas bloquant pour le reste de l'app
      console.warn("SessionInviteListener init failed:", e);
    }
  });

  const accept = async () => {
    const i = invite();
    if (!i) return;
    setJoining(true);
    setError(null);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
        ensureMultiplayerHandlersRegistered();
      }

      const res = await joinSession(i.sessionId);
      if (!res.success) {
        setError(res.message ?? "Failed to join session.");
        return;
      }
      setInvite(null);
      navigate("/board");
    } catch (err: any) {
      setError(err?.message ?? "Failed to join session.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Show when={invite()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setInvite(null)}
      >
        <div
          class="bg-game-dark border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 class="text-xl font-display text-white mb-3">
            Game session started
          </h3>
          <p class="text-slate-300 mb-4">
            <span class="text-purple-300 font-semibold">
              {invite()?.startedByUserName || "A player"}
            </span>{" "}
            started a game session. Do you want to join?
          </p>

          <Show when={error()}>
            <p class="mb-3 text-red-400 text-sm">{error()}</p>
          </Show>

          <div class="flex gap-3">
            <button
              onClick={() => setInvite(null)}
              class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all"
              disabled={joining()}
            >
              Plus tard
            </button>
            <button
              onClick={accept}
              class="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all disabled:opacity-50"
              disabled={joining()}
            >
              {joining() ? "Rejoindre..." : "Rejoindre"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
