import { useParams, useNavigate } from "@solidjs/router";
import {
  Crown,
  Users,
  Calendar,
  BookOpen,
  Play,
  Pause,
  UserPlus,
  Trash2,
  Edit3,
  Clock,
  Plus,
  X,
  Swords,
  Drama,
  Loader2,
  Map as MapIcon,
  Zap,
  LogOut,
  Check,
  Copy,
} from "lucide-solid";
import { createSignal, onCleanup, onMount, Show, For, type JSX } from "solid-js";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";
import {
  Campaign,
  CampaignStatus,
  getStatusColor,
  getStatusLabel,
} from "../types/campaign";
import { authStore } from "../stores/auth.store";
import { safeConfirm } from "../services/ui/confirm";
import {
  CampaignService,
  mapCampaignResponse,
  displayDungeonMasterName,
  hasScenario,
  mapToAPICampaignStatus,
} from "../services/campaign.service";
import {
  createSession,
  ensureMultiplayerHandlersRegistered,
  joinSession,
  joinCampaignSession,
  subscribeCampaign,
  unsubscribeCampaign,
} from "../services/signalr/multiplayer.service";
import { signalRService } from "../services/signalr/SignalRService";
import { GameSessionStatus, type GameSessionResponse } from "../services/campaign.service";


export default function CampaignView() {
  const params = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = createSignal<Campaign | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<"overview" | "players">("overview");
  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [inviteCode, setInviteCode] = createSignal<string | null>(null);
  // Signals indépendants — chaque bouton ne bloque que lui-même
  const [launchingSession, setLaunchingSession] = createSignal(false); // lancement scénario
  const [quickLaunching,   setQuickLaunching]   = createSignal(false); // lancement rapide
  const [launchError, setLaunchError] = createSignal<string | null>(null);
  const [sessionInvite, setSessionInvite] = createSignal<{
    sessionId: string;
    campaignId: string;
    startedByUserId?: string;
    startedByUserName?: string;
    timestamp?: string;
  } | null>(null);
  const [joiningInvite, setJoiningInvite] = createSignal(false);
  const [inviteError, setInviteError] = createSignal<string | null>(null);

  // Active session already running when the page loads
  const [activeSession, setActiveSession] = createSignal<GameSessionResponse | null>(null);
  const [joiningActive, setJoiningActive] = createSignal(false);
  const [joinActiveError, setJoinActiveError] = createSignal<string | null>(null);

  // Leave campaign (non-owner)
  const [leavingCampaign, setLeavingCampaign] = createSignal(false);
  const [leaveError, setLeaveError] = createSignal<string | null>(null);

  // Success toast (e.g. clipboard copy)
  const [successToast, setSuccessToast] = createSignal<string | null>(null);
  let successToastTimer: ReturnType<typeof setTimeout> | undefined;
  const showSuccessToast = (msg: string) => {
    clearTimeout(successToastTimer);
    setSuccessToast(msg);
    successToastTimer = setTimeout(() => setSuccessToast(null), 2500);
  };

  const user = () => authStore.user();
  /** Le créateur/MJ peut lancer une session ; on s'appuie sur l'API (isDungeonMaster) pour éviter les écarts d'identifiants. */
  const isOwner = () => {
    const c = campaign();
    if (!c) return false;
    if (c.isDungeonMaster === true) return true;
    const u = user();
    return !!u && c.dungeonMasterId === u.id;
  };

  onMount(async () => {
    try {
      setLoading(true);
      const response = await CampaignService.getCampaign(params.id);
      const mappedCampaign = mapCampaignResponse(response);
      setCampaign(mappedCampaign);

      // Check if a session is already running for this campaign.
      // N.B. we only show the "resume" banner if the session has actual
      // progress (currentNodeId set OR at least one history entry).
      // A session with status=Active but no progress is a ghost session
      // created by an earlier CampaignSessionPage visit that was never
      // played — showing the banner for it would be misleading.
      try {
        const sessionsRes = await CampaignService.listSessions(params.id);
        const running = sessionsRes.items.find(
          (s) =>
            s.status === GameSessionStatus.Active &&
            (!!s.currentNodeId || s.entries.length > 0)
        );
        if (running) setActiveSession(running);
      } catch {
        // Non-critical — page still works without it.
      }

      // S'abonner aux notifications de la campagne (ex: "SessionStarted").
      // Permet de proposer "Rejoindre" sans code quand le MJ lance une session.
      if (!signalRService.isConnected) {
        await signalRService.connect();
      }
      ensureMultiplayerHandlersRegistered();

      const handler = (data: Record<string, unknown>) => {
        const payload = {
          sessionId: String(data.sessionId ?? data.SessionId ?? ""),
          campaignId: String(data.campaignId ?? data.CampaignId ?? ""),
          startedByUserId: (data.startedByUserId ?? data.StartedByUserId) as
            | string
            | undefined,
          startedByUserName: (data.startedByUserName ??
            data.StartedByUserName) as string | undefined,
          timestamp: (data.timestamp ?? data.Timestamp) as string | undefined,
        };

        if (!payload.sessionId) return;

        // Update / create the active-session banner regardless of who started it.
        setActiveSession((prev) => prev ?? {
          id: payload.sessionId,
          campaignId: payload.campaignId,
          status: GameSessionStatus.Active,
          startedBy: payload.startedByUserId ?? "",
          startedAt: payload.timestamp ?? new Date().toISOString(),
          entries: [],
        } as GameSessionResponse);

        // Ne pas afficher la modale au joueur qui a démarré la session.
        const me = authStore.user()?.id;
        if (
          me &&
          payload.startedByUserId &&
          String(payload.startedByUserId) === String(me)
        ) {
          return;
        }

        setInviteError(null);
        setSessionInvite(payload);
      };

      signalRService.on("SessionStarted", handler);
      await subscribeCampaign(mappedCampaign.id);

      onCleanup(() => {
        try {
          signalRService.off("SessionStarted", handler);
        } catch {}
        // Best-effort: si la connexion est encore active, on se désabonne du groupe.
        if (signalRService.isConnected) {
          unsubscribeCampaign(mappedCampaign.id).catch(() => undefined);
        }
      });
    } catch (err: any) {
      console.error("Failed to load campaign:", err);
      setError("Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** Relative time helper — no external dep, pure JS Intl. */
  const formatRelativeTime = (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t("campaignView.relativeTime.today");
    if (diffDays === 1) return t("campaignView.relativeTime.yesterday");
    if (diffDays < 30) return t("campaignView.relativeTime.daysAgo", { n: diffDays });
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return t("campaignView.relativeTime.monthAgo");
    return t("campaignView.relativeTime.monthsAgo", { n: diffMonths });
  };

  /** Lancement rapide — session SignalR pure, SANS session DB ni historique.
   *
   *  createSession (SignalR hub) ≠ CampaignService.createSession (HTTP).
   *  L'appel SignalR crée uniquement la session en mémoire et broadcast
   *  SessionStarted au groupe campagne (les joueurs sont invités automatiquement),
   *  sans écrire de CampaignGameSession en base.
   *  La session DB n'est créée que dans CampaignSessionPage — que le lancement
   *  rapide ne visite jamais → aucun historique généré. */
  const handleLaunchSession = async () => {
    const c = campaign();
    if (!c || !isOwner() || quickLaunching()) return;
    setLaunchError(null);
    setQuickLaunching(true);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
      }
      ensureMultiplayerHandlersRegistered();
      // createSession (SignalR) : in-memory + broadcast SessionStarted — pas de DB
      await createSession(c.id);
      navigate(`/practice/multiplayer`);
    } catch (e: any) {
      setLaunchError(e?.message ?? "Failed to create session.");
    } finally {
      setQuickLaunching(false);
    }
  };

  const handleJoinInvite = async () => {
    const invite = sessionInvite();
    if (!invite) return;
    setInviteError(null);
    setJoiningInvite(true);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
      }
      ensureMultiplayerHandlersRegistered();
      const res = await joinSession(invite.sessionId);
      if (!res.success) {
        setInviteError(res.message ?? "Failed to join session.");
        return;
      }
      setSessionInvite(null);
      // Route based on whether the campaign has an authored story-tree:
      //   - With scenario → CampaignLobbyPage → /session (story tree) → maps.
      //   - Without scenario (POC Quick Launch flow) → /practice/multiplayer
      //     so the joiner lands in the same sandbox LobbyScreen as the DM.
      if (invite.campaignId && hasScenario(campaign()?.campaignTreeDefinition)) {
        navigate(`/campaigns/${invite.campaignId}/lobby`);
      } else {
        navigate(invite.campaignId ? `/practice/multiplayer` : "/practice");
      }
    } catch (e: any) {
      setInviteError(e?.message ?? "Failed to join session.");
    } finally {
      setJoiningInvite(false);
    }
  };

  /** Rejoindre la session active détectée au chargement de la page. */
  const handleJoinActiveSession = async () => {
    const c = campaign();
    if (!c) return;
    setJoinActiveError(null);
    setJoiningActive(true);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
      }
      ensureMultiplayerHandlersRegistered();
      // Utilise joinCampaignSession (cherche par campaignId dans le SessionManager)
      // plutôt que joinSession(db_uuid) qui cherche par l'ID SignalR in-memory.
      const res = await joinCampaignSession(c.id);
      if (!res.success) {
        // Plus de session SignalR active (terminée entre-temps) → masquer le bandeau.
        if (res.message?.toLowerCase().includes('aucune session')) {
          setActiveSession(null);
        } else {
          setJoinActiveError(res.message ?? "Impossible de rejoindre la session.");
        }
        return;
      }
      if (hasScenario(c.campaignTreeDefinition)) {
        navigate(`/campaigns/${c.id}/lobby`);
      } else {
        navigate("/board");
      }
    } catch (e: any) {
      setJoinActiveError(e?.message ?? "Impossible de rejoindre la session.");
    } finally {
      setJoiningActive(false);
    }
  };

  const toggleStatus = async () => {
    const c = campaign();
    if (!c) return;

    const newStatus =
      c.status === CampaignStatus.Active
        ? CampaignStatus.Paused
        : CampaignStatus.Active;

    try {
      const apiStatus = mapToAPICampaignStatus(newStatus);
      await CampaignService.updateCampaign(c.id, { status: apiStatus });
      setCampaign({ ...c, status: newStatus });
    } catch (err) {
      console.error("Failed to update campaign status:", err);
      setError("Failed to update campaign status.");
    }
  };

  const handleUpdate = () => {
    navigate(`/campaigns/${params.id}/edit`);
  };

  const handleCampaignManager = () => {
    navigate(`/campaigns/${params.id}/manager`);
  };

  const handleLaunchCampaignSession = async () => {
    const c = campaign();
    if (!c || !isOwner() || launchingSession()) return; // signal indépendant du quick launch
    setLaunchError(null);
    setLaunchingSession(true);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
      }
      ensureMultiplayerHandlersRegistered();
      await createSession(c.id);
      navigate(`/campaigns/${params.id}/lobby`);
    } catch (e: any) {
      setLaunchError(e?.message ?? 'Failed to create session.');
    } finally {
      setLaunchingSession(false);
    }
  };

  const handleViewSessions = () => {
    navigate(`/campaigns/${params.id}/sessions`);
  };

  const handleDelete = async () => {
    const c = campaign();
    if (!c) return;

    if (
      !safeConfirm(
        `Are you sure you want to delete "${c.title}"? This action is irreversible.`,
      )
    ) {
      return;
    }

    try {
      await CampaignService.deleteCampaign(c.id);
      navigate("/campaigns");
    } catch (err) {
      console.error("Failed to delete campaign:", err);
      setError("Failed to delete campaign.");
    }
  };

  const handleLeaveCampaign = async () => {
    const c = campaign();
    if (!c) return;

    if (
      !safeConfirm(
        `Are you sure you want to leave "${c.title}"? You will need to be re-invited to rejoin.`,
      )
    ) {
      return;
    }

    setLeaveError(null);
    setLeavingCampaign(true);
    try {
      await CampaignService.leaveCampaign(c.id);
      navigate("/campaigns");
    } catch (err: any) {
      console.error("Failed to leave campaign:", err);
      setLeaveError(err?.response?.data?.message ?? "Impossible de quitter la campagne.");
    } finally {
      setLeavingCampaign(false);
    }
  };

  const handleGenerateInvite = async () => {
    const c = campaign();
    if (!c) return;

    try {
      const response = await CampaignService.generateInviteCode(c.id, {
        expiresInHours: 24,
      });
      setInviteCode(response.inviteCode);
      setShowInviteModal(true);
    } catch (err) {
      console.error("Failed to generate invite code:", err);
      setError("Failed to generate invitation code.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const c = campaign();
    if (!c) return;

    if (
      !safeConfirm(
        "Are you sure you want to remove this player from the campaign?",
      )
    ) {
      return;
    }

    try {
      await CampaignService.removeMember(c.id, memberId);
      // Refresh campaign data
      const response = await CampaignService.getCampaign(c.id);
      const mappedCampaign = mapCampaignResponse(response);
      setCampaign(mappedCampaign);
    } catch (err) {
      console.error("Failed to remove member:", err);
      setError("Failed to remove member.");
    }
  };

  /** Tab keyboard navigation — arrow keys cycle between Overview and Players. */
  const handleTabKeyDown = (e: KeyboardEvent, tab: "overview" | "players") => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveTab(tab === "overview" ? "players" : "overview");
    }
  };

  return (
    <div class="campaign-view-page min-h-screen w-full">
      <PageMeta title={t("page.campaigns.title")} />

      <Show
        when={!loading()}
        fallback={
          <div class="flex items-center justify-center min-h-screen" role="status" aria-label={t("common.loading")}>
            <div class="w-12 h-12 border-4 border-white/20 border-t-purple-500 rounded-full animate-spin" aria-hidden="true" />
          </div>
        }
      >
        <Show when={campaign()}>
          {(camp) => (
            <main class="relative z-10 max-w-5xl mx-auto p-6 pt-20 pb-12">
              {/* Campaign Header Card */}
              <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-6">
                {/* Banner */}
                <div class="h-32 bg-gradient-to-r from-purple-600/40 via-indigo-600/30 to-violet-600/40 relative">
                  <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" aria-hidden="true" />

                  {/* Status badge */}
                  <div class="absolute top-4 right-4">
                    <span
                      class={`px-3 py-1.5 text-sm rounded-xl border ${getStatusColor(camp().status)}`}
                      aria-label={`Status: ${getStatusLabel(camp().status)}`}
                    >
                      {getStatusLabel(camp().status)}
                    </span>
                  </div>

                  {/* Quick actions for owner */}
                  <Show when={isOwner()}>
                    <div class="absolute top-4 left-4 flex gap-2">
                      <button
                        onClick={toggleStatus}
                        aria-label={camp().status === CampaignStatus.Active ? t("campaignView.pause") : t("campaignView.resume")}
                        class="p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                      >
                        <Show
                          when={camp().status === CampaignStatus.Active}
                          fallback={<Play class="w-4 h-4 text-green-400" aria-hidden="true" />}
                        >
                          <Pause class="w-4 h-4 text-yellow-400" aria-hidden="true" />
                        </Show>
                      </button>
                    </div>
                  </Show>
                </div>

                {/* Main info */}
                <div class="p-6">
                  <div class="flex flex-col sm:flex-row gap-6">
                    <div class="flex-1">
                      <h1 class="font-display text-3xl sm:text-4xl text-white mb-2">
                        {camp().title}
                      </h1>
                      <div class="flex flex-wrap items-center gap-3 text-slate-400 mb-4">
                        <span class="flex items-center gap-1.5" aria-label={`${camp().currentPlayers} / ${camp().maxPlayers} ${t("campaignView.players")}`}>
                          <Users class="w-4 h-4" aria-hidden="true" />
                          {camp().currentPlayers}/{camp().maxPlayers} {t("campaignView.players")}
                        </span>
                      </div>

                      <Show when={camp().description}>
                        <div class="border-l-2 border-purple-500/30 pl-3">
                          <p class="text-xs text-slate-400 uppercase tracking-wider mb-1">Description</p>
                          <p class="text-slate-300/90 leading-relaxed italic">
                            {camp().description}
                          </p>
                        </div>
                      </Show>
                    </div>

                    {/* DM Card */}
                    <div class="sm:w-64 p-4 bg-white/5 rounded-xl border border-white/10">
                      <div class="flex items-center gap-3 mb-3">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center" aria-hidden="true">
                          <Crown class="w-6 h-6 text-white" aria-hidden="true" />
                        </div>
                        <div>
                          <p class="text-xs text-amber-400 uppercase tracking-wider font-semibold">
                            {t("campaignView.dungeonMaster")}
                          </p>
                          <p class="text-white font-semibold">
                            {displayDungeonMasterName(camp(), authStore.user()?.username)}
                          </p>
                        </div>
                      </div>
                      <div class="text-sm text-slate-400 space-y-0.5">
                        <p>{t("campaignView.createdOn")} {formatDate(camp().createdAt)}</p>
                        <p class="text-slate-500 text-xs">{formatRelativeTime(camp().createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Next Session Banner */}
                  <Show when={camp().nextSessionDate}>
                    <div class="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center" aria-hidden="true">
                          <Calendar class="w-5 h-5 text-green-400" aria-hidden="true" />
                        </div>
                        <div>
                          <p class="text-sm text-green-400 font-medium">
                            {t("campaignView.nextSession")}
                          </p>
                          <p class="text-white">
                            {formatDateTime(camp().nextSessionDate!)}
                          </p>
                        </div>
                      </div>
                      <button
                        class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        onClick={handleLaunchSession}
                        disabled={launchingSession()}
                      >
                        <Show
                          when={launchingSession()}
                          fallback={<Play class="w-4 h-4" aria-hidden="true" />}
                        >
                          <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
                        </Show>
                        {launchingSession() ? t("campaignView.launchingSession") : t("campaignView.launchSession")}
                      </button>
                    </div>
                  </Show>
                </div>
              </div>

              {/* ── Active session banner ───────────────────────────────── */}
              <Show when={activeSession()}>
                {(session) => (
                  <div class="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 overflow-hidden shadow-lg shadow-emerald-500/10">
                    {/* Pulsing top bar */}
                    <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse" aria-hidden="true" />

                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
                      {/* Icon + text */}
                      <div class="flex items-center gap-4 flex-1 min-w-0">
                        <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Zap class="w-6 h-6 text-emerald-400" aria-hidden="true" />
                        </div>
                        <div class="min-w-0">
                          <p class="text-emerald-300 font-semibold text-sm uppercase tracking-wider mb-0.5">
                            Session in progress
                          </p>
                          <p class="text-white font-display text-lg leading-tight">
                            A session is currently active
                          </p>
                          <p class="text-slate-400 text-sm mt-0.5">
                            Started {formatRelativeTime(session().startedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Join / Rejoin button */}
                      <div class="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={handleJoinActiveSession}
                          disabled={joiningActive()}
                          aria-label="Join the ongoing session"
                          class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        >
                          <Show
                            when={!joiningActive()}
                            fallback={<Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />}
                          >
                            <Play class="w-4 h-4" aria-hidden="true" />
                          </Show>
                          {joiningActive() ? "Connecting…" : (isOwner() ? "Resume session" : "Join session")}
                        </button>
                        <Show when={joinActiveError()}>
                          <p class="text-red-400 text-xs" role="alert">{joinActiveError()}</p>
                        </Show>
                      </div>
                    </div>
                  </div>
                )}
              </Show>

              {/* Tabs */}
              <div
                role="tablist"
                aria-label={t("campaignView.tabs.label")}
                class="flex gap-2 mb-6 overflow-x-auto pb-2"
              >
                <TabButton
                  id="tab-overview"
                  panelId="panel-overview"
                  active={activeTab() === "overview"}
                  onClick={() => setActiveTab("overview")}
                  onKeyDown={(e) => handleTabKeyDown(e, "overview")}
                  icon={<BookOpen class="w-4 h-4" aria-hidden="true" />}
                  label={t("campaignView.tabs.overview")}
                />
                <TabButton
                  id="tab-players"
                  panelId="panel-players"
                  active={activeTab() === "players"}
                  onClick={() => setActiveTab("players")}
                  onKeyDown={(e) => handleTabKeyDown(e, "players")}
                  icon={<Users class="w-4 h-4" aria-hidden="true" />}
                  label={t("campaignView.tabs.players")}
                  count={camp().currentPlayers}
                />
                {/* Sessions tab removed — the backend doesn't persist session
                    history yet. Follow-up: reintroduce when CampaignSessionService
                    state is surfaced via a read endpoint. */}
              </div>

              {/* Tab Content */}
              <div class="space-y-6">
                {/* Overview Tab */}
                <Show when={activeTab() === "overview"}>
                  <div
                    id="panel-overview"
                    role="tabpanel"
                    aria-labelledby="tab-overview"
                    class="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    <StatCard
                      icon={<Users class="w-5 h-5" aria-hidden="true" />}
                      label={t("campaignView.tabs.players")}
                      value={`${camp().currentPlayers}/${camp().maxPlayers}`}
                      color="purple"
                    />
                    <StatCard
                      icon={<Clock class="w-5 h-5" aria-hidden="true" />}
                      label={t("campaignView.duration")}
                      value={`${Math.ceil((Date.now() - new Date(camp().createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))} ${t("campaignView.months")}`}
                      color="green"
                    />
                  </div>
                </Show>

                {/* Players Tab */}
                <Show when={activeTab() === "players"}>
                  <div
                    id="panel-players"
                    role="tabpanel"
                    aria-labelledby="tab-players"
                    class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
                  >
                    <div class="p-4 border-b border-white/10 flex items-center justify-between">
                      <h2 class="font-display text-lg text-white">
                        {t("campaignView.tabs.players")} ({camp().currentPlayers})
                      </h2>
                      <Show when={isOwner() && camp().currentPlayers < camp().maxPlayers}>
                        <button
                          onClick={handleGenerateInvite}
                          aria-label={t("campaignView.invitePlayer")}
                          class="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        >
                          <UserPlus class="w-4 h-4" aria-hidden="true" />
                          {t("campaignView.invite")}
                        </button>
                      </Show>
                    </div>

                    <div class="divide-y divide-white/5">
                      {/* DM */}
                      <div class="p-4 flex items-center gap-4 bg-amber-500/5">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center" aria-hidden="true">
                          <Crown class="w-6 h-6 text-white" aria-hidden="true" />
                        </div>
                        <div class="flex-1">
                          <p class="text-white font-semibold">
                            {displayDungeonMasterName(camp(), authStore.user()?.username)}
                          </p>
                          <p class="text-amber-400 text-sm">{t("campaignView.dungeonMaster")}</p>
                        </div>
                      </div>

                      {/* Players */}
                      <For each={camp().players}>
                        {(player) => (
                          <div class="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                            <div class="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center" aria-hidden="true">
                              <Drama class="w-6 h-6 text-purple-300" aria-hidden="true" />
                            </div>
                            <div class="flex-1 min-w-0">
                              <p class="text-white font-semibold">
                                {player.username}
                              </p>
                              <p class="text-slate-400 text-sm truncate">
                                {player.characterName || t("campaignView.noCharacter")}
                              </p>
                            </div>
                            <Show when={isOwner()}>
                              <button
                                onClick={() => handleRemoveMember(player.id)}
                                aria-label={t("campaignView.removeMember", { name: player.username })}
                                class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                              >
                                <X class="w-4 h-4" aria-hidden="true" />
                              </button>
                            </Show>
                          </div>
                        )}
                      </For>

                      {/* Empty state when no players at all (excluding DM) */}
                      <Show when={!camp().players || camp().players!.length === 0}>
                        <div class="py-10 px-4 text-center">
                          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 flex items-center justify-center">
                            <Users class="w-7 h-7 text-slate-500" aria-hidden="true" />
                          </div>
                          <p class="text-slate-300 font-medium mb-1">{t("campaignView.noPlayersYet")}</p>
                          <p class="text-slate-500 text-sm">{t("campaignView.noPlayersHint")}</p>
                        </div>
                      </Show>

                      {/* Empty slots */}
                      <Show when={camp().players && camp().players!.length > 0}>
                        <For each={Array(camp().maxPlayers - camp().currentPlayers).fill(0)}>
                          {() => (
                            <div class="p-4 flex items-center gap-4 opacity-50" aria-hidden="true">
                              <div class="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                                <Plus class="w-5 h-5 text-slate-500" />
                              </div>
                              <div class="flex-1">
                                <p class="text-slate-500">{t("campaignView.openSlot")}</p>
                              </div>
                            </div>
                          )}
                        </For>
                      </Show>
                    </div>
                  </div>
                </Show>

                {/* Sessions Tab removed with its TabButton — follow-up work. */}
              </div>

              {/* Erreur création de session */}
              <Show when={launchError()}>
                <p class="mt-4 text-red-400 text-sm" role="alert">{launchError()}</p>
              </Show>

              {/* ── Actions footer ──────────────────────────────────────────── */}
              <Show when={isOwner()}>
                {/* Row 1: Primary (Lancement rapide) + Secondary (Lancer la session) */}
                <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* PRIMARY — Lancement rapide (createRoom, sans historique) */}
                  <button
                    class="py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 motion-safe:hover:-translate-y-0.5"
                    onClick={handleLaunchSession}
                    disabled={quickLaunching()}
                    aria-label={t("campaignView.quickLaunch.ariaLabel")}
                  >
                    <Show
                      when={quickLaunching()}
                      fallback={<Swords class="w-5 h-5" aria-hidden="true" />}
                    >
                      <Loader2 class="w-5 h-5 animate-spin" aria-hidden="true" />
                    </Show>
                    {quickLaunching() ? t("campaignView.launchingSession") : t("campaignView.quickLaunch")}
                  </button>

                  {/* SECONDARY — Lancement avec scénario (createSession, avec historique) */}
                  <button
                    onClick={handleLaunchCampaignSession}
                    disabled={launchingSession()}
                    class="py-3 px-6 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    aria-label={t("campaignView.launchSession.ariaLabel")}
                  >
                    <Show when={launchingSession()} fallback={<Play class="w-5 h-5" aria-hidden="true" />}>
                      <Loader2 class="w-5 h-5 animate-spin" aria-hidden="true" />
                    </Show>
                    <Show when={launchingSession()} fallback={t("campaignView.launchSession")}>
                      {t("campaignView.launchingSession")}
                    </Show>
                  </button>
                </div>

                {/* Row 2: Tertiary utility actions */}
                <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleUpdate}
                    aria-label={t("campaignView.editCampaign")}
                    class="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  >
                    <Edit3 class="w-4 h-4" aria-hidden="true" />
                    {t("common.edit")}
                  </button>

                  <button
                    onClick={handleCampaignManager}
                    title={t("campaignView.campaignManager.title")}
                    aria-label={t("campaignView.campaignManager.ariaLabel")}
                    class="relative py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  >
                    <MapIcon class="w-4 h-4" aria-hidden="true" />
                    Campaign Manager
                    <span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 leading-none">
                      WIP
                    </span>
                  </button>

                  <button
                    onClick={handleViewSessions}
                    aria-label={t("campaignView.viewSessions.ariaLabel")}
                    class="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  >
                    <BookOpen class="w-4 h-4" aria-hidden="true" />
                    {t("campaignView.viewSessions")}
                  </button>
                </div>

                {/* Row 3: Destructive — visually isolated danger zone */}
                <div class="mt-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-medium text-red-300">{t("campaignView.dangerZone")}</p>
                    <p class="text-xs text-red-400/70 mt-0.5">{t("campaignView.deleteIrreversible")}</p>
                  </div>
                  <button
                    onClick={handleDelete}
                    aria-label={t("campaignView.deleteCampaign.ariaLabel")}
                    class="py-2 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  >
                    <Trash2 class="w-4 h-4" aria-hidden="true" />
                    {t("common.delete")}
                  </button>
                </div>
              </Show>

              {/* Non-owner: leave campaign */}
              <Show when={!isOwner()}>
                <div class="mt-8 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-medium text-red-300">{t("campaignView.leaveCampaign")}</p>
                    <p class="text-xs text-red-400/70 mt-0.5">
                      {t("campaignView.leaveCampaign.hint")}
                    </p>
                  </div>
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={handleLeaveCampaign}
                      disabled={leavingCampaign()}
                      aria-label={t("campaignView.leaveCampaign.ariaLabel")}
                      class="py-2 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    >
                      <Show
                        when={!leavingCampaign()}
                        fallback={<Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />}
                      >
                        <LogOut class="w-4 h-4" aria-hidden="true" />
                      </Show>
                      {leavingCampaign() ? t("campaignView.leaving") : t("campaignView.leave")}
                    </button>
                    <Show when={leaveError()}>
                      <p class="text-red-400 text-xs" role="alert">{leaveError()}</p>
                    </Show>
                  </div>
                </div>
              </Show>
            </main>
          )}
        </Show>
      </Show>

      {/* Invite Code Modal */}
      <Show when={showInviteModal()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowInviteModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
        >
          <div
            class="bg-game-dark border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="invite-modal-title" class="text-xl font-display text-white mb-4">
              {t("campaignView.inviteModal.title")}
            </h2>
            <p class="text-slate-400 mb-4">
              {t("campaignView.inviteModal.body")}
            </p>
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
              <code class="text-purple-400 text-lg font-mono">
                {inviteCode()}
              </code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteCode() || "");
                showSuccessToast(t("campaignView.inviteModal.copied"));
                setShowInviteModal(false);
              }}
              class="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <Copy class="w-4 h-4" aria-hidden="true" />
              Copier le code
            </button>
          </div>
        </div>
      </Show>

      {/* Success Toast */}
      <Show when={successToast()}>
        <div
          class="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border border-emerald-500/30 bg-emerald-500/15 backdrop-blur-sm text-emerald-200 animate-in slide-in-from-bottom-4 duration-300"
          role="status"
          aria-live="polite"
        >
          <div class="w-7 h-7 rounded-full bg-emerald-500/25 flex items-center justify-center shrink-0">
            <Check class="w-4 h-4 text-emerald-400" aria-hidden="true" />
          </div>
          <span class="text-sm font-medium">{successToast()}</span>
          <button
            onClick={() => setSuccessToast(null)}
            aria-label="Fermer"
            class="ml-1 text-emerald-400/70 hover:text-emerald-300 transition-colors focus-visible:outline-none rounded"
          >
            <X class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </Show>

      {/* Error Toast */}
      <Show when={error()}>
        <div
          class="fixed bottom-4 right-4 z-50 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3"
          role="alert"
          aria-live="assertive"
        >
          <span>{error()}</span>
          <button
            onClick={() => setError(null)}
            aria-label={t("common.close")}
            class="text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
          >
            <X class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </Show>

      {/* Session invite modal (SessionStarted) */}
      <Show when={sessionInvite()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSessionInvite(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-invite-title"
        >
          <div
            class="bg-game-dark border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="session-invite-title" class="text-xl font-display text-white mb-3">
              {t("campaignView.sessionInvite.title")}
            </h2>
            <p class="text-slate-300 mb-4">
              <span class="text-purple-300 font-semibold">
                {sessionInvite()?.startedByUserName || t("campaignView.sessionInvite.aPlayer")}
              </span>{" "}
              {t("campaignView.sessionInvite.body")}
            </p>
            <Show when={inviteError()}>
              <p class="mb-3 text-red-400 text-sm" role="alert">{inviteError()}</p>
            </Show>
            <div class="flex gap-3">
              <button
                onClick={() => setSessionInvite(null)}
                class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                disabled={joiningInvite()}
              >
                {t("campaignView.sessionInvite.later")}
              </button>
              <button
                onClick={handleJoinInvite}
                class="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                disabled={joiningInvite()}
              >
                <Show when={joiningInvite()} fallback={t("campaignView.sessionInvite.join")}>
                  {t("campaignView.sessionInvite.joining")}
                </Show>
              </button>
            </div>
          </div>
        </div>
      </Show>

    </div>
  );
}

/**
 * Tab button component
 */
function TabButton(props: {
  id: string;
  panelId: string;
  active: boolean;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  icon: JSX.Element;
  label: string;
  count?: number;
}) {
  return (
    <button
      id={props.id}
      role="tab"
      aria-selected={props.active}
      aria-controls={props.panelId}
      onClick={props.onClick}
      onKeyDown={props.onKeyDown}
      class={`flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
        props.active
          ? "bg-purple-600/30 border-purple-500/50 text-white"
          : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
      }`}
    >
      {props.icon}
      <span>{props.label}</span>
      <Show when={props.count !== undefined}>
        <span
          aria-hidden="true"
          class={`text-xs px-1.5 py-0.5 rounded-full ${
            props.active ? "bg-purple-500/50" : "bg-white/10"
          }`}
        >
          {props.count}
        </span>
      </Show>
    </button>
  );
}

/**
 * Stat card component
 */
function StatCard(props: {
  icon: JSX.Element;
  label: string;
  value: string;
  color: "purple" | "blue" | "amber" | "green";
}) {
  const colorClasses = {
    purple: "bg-purple-500/20 text-purple-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    green: "bg-green-500/20 text-green-400",
  };

  return (
    <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-xl p-5">
      <div
        class={`w-10 h-10 rounded-lg ${colorClasses[props.color]} flex items-center justify-center mb-3`}
      >
        {props.icon}
      </div>
      <p class="text-2xl font-bold text-white">{props.value}</p>
      <p class="text-sm text-slate-400">{props.label}</p>
    </div>
  );
}
