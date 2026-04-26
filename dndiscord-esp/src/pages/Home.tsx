import { Component, Show, createResource, createEffect, createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import AnimatedD20 from "../components/common/AnimatedD20";
import ResumeHero from "../components/home/ResumeHero";
import WelcomeBanner from "../components/home/WelcomeBanner";
import LiveSessionHero from "../components/home/LiveSessionHero";
import PlayGroup from "../components/home/PlayGroup";
import CreateGroup from "../components/home/CreateGroup";
import StatsStrip from "../components/home/StatsStrip";
import { CampaignService } from "../services/campaign.service";
import { CharacterService } from "../services/character.service";
import { readLastCampaignId, clearLastCampaignId } from "../hooks/useLastCampaign";
import {
  sessionState,
  getPersistedSession,
} from "../stores/session.store";
import {
  tryRecoverSession,
  ensureMultiplayerHandlersRegistered,
} from "../services/signalr/multiplayer.service";
import { signalRService } from "../services/signalr/SignalRService";
import { t } from "../i18n";

export const Home: Component = () => {
  const navigate = useNavigate();

  const [lastId, setLastId] = createSignal<string | null>(null);
  onMount(() => setLastId(readLastCampaignId()));

  const [campaign] = createResource(lastId, async (id) => {
    if (!id) return null;
    try {
      return await CampaignService.getCampaign(id);
    } catch {
      return null;
    }
  });

  // If we had an id but campaign is gone (deleted), clear stale ref and update signal.
  createEffect(() => {
    if (lastId() && !campaign.loading && campaign() === null) {
      clearLastCampaignId();
      setLastId(null);
    }
  });

  const [campaignsCount] = createResource(async () => {
    try {
      const res = await CampaignService.listCampaigns();
      return res.totalCount ?? 0;
    } catch {
      return 0;
    }
  });

  const [charactersCount] = createResource(async () => {
    try {
      const list = await CharacterService.getMyCharacters();
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  });

  // ── Live session detection ────────────────────────────────────────────────
  // sessionStorage outlives F5/back-nav within the same tab. If a persisted
  // session exists, optimistically show the rejoin hero and trigger silent
  // recovery to populate sessionState (so the hero can render real campaign
  // name + player count). If recovery fails, tryRecoverSession clears the
  // persisted entry — we then drop the optimistic flag and fall through to
  // ResumeHero / WelcomeBanner.
  const [hasPersistedSession, setHasPersistedSession] = createSignal(false);
  const [recovering, setRecovering] = createSignal(false);

  onMount(async () => {
    if (sessionState.session) {
      setHasPersistedSession(true);
      return;
    }
    if (!getPersistedSession()) return;
    setHasPersistedSession(true);
    setRecovering(true);
    try {
      const ok = await tryRecoverSession();
      if (!ok) setHasPersistedSession(false);
    } catch {
      setHasPersistedSession(false);
    } finally {
      setRecovering(false);
    }
  });

  const showLive = () => !!sessionState.session || hasPersistedSession();

  const handleResume = async () => {
    // If the session was cleared between mount and click, attempt recovery
    // once more before navigating so BoardGame doesn't bounce to mode select.
    if (!sessionState.session && getPersistedSession()) {
      setRecovering(true);
      try {
        if (!signalRService.isConnected) {
          await signalRService.connect();
          ensureMultiplayerHandlersRegistered();
        }
        await tryRecoverSession();
      } finally {
        setRecovering(false);
      }
    }
    // Always route through the sandbox multiplayer shell — its onMount
    // session-rehydration jumps straight to LobbyScreen for Lobby state or
    // IN_GAME for InProgress, regardless of campaign vs sandbox origin.
    navigate("/practice/multiplayer");
  };

  const totalItems = () => (campaignsCount() ?? 0) + (charactersCount() ?? 0);

  const counterLabel = () => {
    const n = totalItems();
    return n > 0 ? `${n} ITEMS` : undefined;
  };

  const hasData = () => totalItems() > 0;

  return (
    <div class="max-w-[1080px] mx-auto space-y-5">
      {/* Hero block */}
      <header class="flex flex-col items-center text-center gap-2 pt-2 mb-4">
        <div class="relative inline-flex items-center justify-center">
          <div
            class="absolute inset-0 rounded-full pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle, rgba(244,197,66,0.25) 0%, rgba(75,30,78,0.15) 45%, transparent 70%)",
              filter: "blur(20px)",
              transform: "scale(1.5)",
            }}
          />
          <span class="dnd-d20-float relative">
            <AnimatedD20 size={96} />
          </span>
        </div>
        <h1 class="title-shine font-display font-bold text-[36px] tracking-[0.06em] mb-1">
          DnDiscord
        </h1>
        <p class="font-old italic text-[15px] text-mid max-w-[520px] mx-auto leading-snug">
          {t("home.subtitle")}
        </p>
      </header>

      <Show
        when={showLive()}
        fallback={
          <Show when={campaign()} fallback={<WelcomeBanner />}>
            {(c) => <ResumeHero campaign={c()} />}
          </Show>
        }
      >
        <LiveSessionHero onResume={handleResume} recovering={recovering()} />
      </Show>

      <PlayGroup
        charactersCount={charactersCount()}
        campaignsCount={campaignsCount()}
        counter={counterLabel()}
      />

      <CreateGroup />

      <Show when={hasData()}>
        <div class="mt-2">
          <StatsStrip
            characters={charactersCount() ?? 0}
            campaigns={campaignsCount() ?? 0}
          />
        </div>
      </Show>
    </div>
  );
};

export default Home;
