import { A, useParams, useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  Crown,
  Users,
  Calendar,
  BookOpen,
  Settings,
  Play,
  Pause,
  UserPlus,
  Trash2,
  Edit3,
  Clock,
  MapPin,
  MessageSquare,
  ChevronRight,
  Plus,
  Check,
  X,
  Loader2,
} from "lucide-solid";
import { createSignal, onCleanup, onMount, Show, For } from "solid-js";
import {
  Campaign,
  CampaignStatus,
  CampaignPlayer,
  CampaignSession,
  getStatusColor,
  getStatusLabel,
} from "../types/campaign";
import { authStore } from "../stores/auth.store";
import { AuthService } from "../services/auth.service";
import { safeConfirm } from "../services/ui/confirm";
import {
  CampaignService,
  CampaignDetailResponse,
  CampaignMemberResponse,
  APICampaignStatus,
  mapMemberRole,
  // CampaignStatus as APICampaignStatus,
} from "../services/campaign.service";
import {
  createSession,
  ensureMultiplayerHandlersRegistered,
  joinSession,
  subscribeCampaign,
  unsubscribeCampaign,
} from "../services/signalr/multiplayer.service";
import { signalRService } from "../services/signalr/SignalRService";

/**
 * Map API campaign status (integer) to frontend status (string)
 */
function mapCampaignStatus(apiStatus: number): CampaignStatus {
  switch (apiStatus) {
    case 0:
      return CampaignStatus.Planning; // Draft
    case 1:
      return CampaignStatus.Active;
    case 2:
      return CampaignStatus.Paused;
    case 3:
      return CampaignStatus.Completed;
    case 4:
      return CampaignStatus.Archived;
    default:
      return CampaignStatus.Planning;
  }
}


/**
 * Map frontend status to API status (integer)
 */
function mapToAPICampaignStatus(status: CampaignStatus): APICampaignStatus {
  switch (status) {
    case CampaignStatus.Planning:
      return APICampaignStatus.Draft;
    case CampaignStatus.Active:
      return APICampaignStatus.Active;
    case CampaignStatus.Paused:
      return APICampaignStatus.Paused;
    case CampaignStatus.Completed:
      return APICampaignStatus.Completed;
    case CampaignStatus.Archived:
      return APICampaignStatus.Archived;
    default:
      return APICampaignStatus.Draft;
  }
}

/**
 * Map API campaign response to frontend Campaign type
 */
function mapCampaignResponse(apiCampaign: CampaignDetailResponse): Campaign {
  return {
    id: apiCampaign.id,
    title: apiCampaign.name,
    description: apiCampaign.description,
    coverImageUrl: apiCampaign.imageUrl,
    campaignTreeDefinition: apiCampaign.campaignTreeDefinition,
    status: mapCampaignStatus(apiCampaign.status),
    visibility: apiCampaign.isPublic ? ("Public" as any) : ("Private" as any),
    dungeonMasterId: apiCampaign.dungeonMasterId,
    isDungeonMaster: apiCampaign.isDungeonMaster,
    dungeonMasterName: "Maître du Jeu", // API doesn't provide this
    dungeonMasterAvatar: "",
    maxPlayers: apiCampaign.maxPlayers,
    currentPlayers: apiCampaign.memberCount,
    players:
      apiCampaign.members?.map((m) => ({
        id: m.id,
        username: m.userId, // API doesn't provide username, using userId
        role: mapMemberRole(m.role),
        characterName: m.nickname,
        joinedAt: m.joinedAt,
      })) || [],
    sessions: [], // API doesn't provide sessions yet
    totalSessions: apiCampaign.snapshotCount || 0,
    setting: undefined,
    startingLevel: 1,
    currentLevel: 1,
    tags: [],
    createdAt: apiCampaign.createdAt,
    updatedAt: apiCampaign.updatedAt,
  };
}

export default function CampaignView() {
  const params = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = createSignal<Campaign | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<
    "overview" | "players" | "sessions"
  >("overview");
  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [inviteCode, setInviteCode] = createSignal<string | null>(null);
  const [launchingSession, setLaunchingSession] = createSignal(false);
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

  const user = () => authStore.user();
  /** Le créateur/MJ peut lancer une session ; on s’appuie sur l’API (isDungeonMaster) pour éviter les écarts d’identifiants. */
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

      // S'abonner aux notifications de la campagne (ex: "SessionStarted").
      // Permet de proposer "Rejoindre" sans code quand le MJ lance une session.
      if (!signalRService.isConnected) {
        await signalRService.connect();
        ensureMultiplayerHandlersRegistered();
      }

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
      setError("Impossible de charger la campagne.");
    } finally {
      setLoading(false);
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /** Créer une session GameHub pour cette campagne et aller au board (DM uniquement). */
  const handleLaunchSession = async () => {
    const c = campaign();
    if (!c || !isOwner()) return;
    setLaunchError(null);
    setLaunchingSession(true);
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
        ensureMultiplayerHandlersRegistered();
      }
      await createSession(c.id);
      navigate("/board");
    } catch (e: any) {
      setLaunchError(e?.message ?? "Impossible de créer la session.");
    } finally {
      setLaunchingSession(false);
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
        ensureMultiplayerHandlersRegistered();
      }
      const res = await joinSession(invite.sessionId);
      if (!res.success) {
        setInviteError(res.message ?? "Impossible de rejoindre la session.");
        return;
      }
      setSessionInvite(null);
      navigate("/board");
    } catch (e: any) {
      setInviteError(e?.message ?? "Impossible de rejoindre la session.");
    } finally {
      setJoiningInvite(false);
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
      setError("Impossible de modifier le statut de la campagne.");
    }
  };

  const handleUpdate = () => {
    // TODO: Implement edit campaign modal or navigate to edit page
    navigate(`/campaigns/${params.id}/edit`);
  };

  const handleDelete = async () => {
    const c = campaign();
    if (!c) return;

    if (
      !safeConfirm(
        `Êtes-vous sûr de vouloir supprimer "${c.title}" ? Cette action est irréversible.`,
      )
    ) {
      return;
    }

    try {
      await CampaignService.deleteCampaign(c.id);
      navigate("/campaigns");
    } catch (err) {
      console.error("Failed to delete campaign:", err);
      setError("Impossible de supprimer la campagne.");
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
      setError("Impossible de générer le code d'invitation.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const c = campaign();
    if (!c) return;

    if (
      !safeConfirm(
        "Êtes-vous sûr de vouloir retirer ce joueur de la campagne ?",
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
      setError("Impossible de retirer le membre.");
    }
  };

  return (
    <div class="campaign-view-page min-h-screen w-full bg-brand-gradient">
      {/* Background effects */}
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div class="absolute bottom-1/4 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Vignette */}
      <div class="vignette absolute inset-0" />

      {/* Back button */}
      <A
        href="/campaigns"
        class="settings-btn !left-4 !right-auto"
        aria-label="Retour"
      >
        <ArrowLeft class="settings-icon h-5 w-5" />
      </A>

      <Show
        when={!loading()}
        fallback={
          <div class="flex items-center justify-center min-h-screen">
            <div class="w-12 h-12 border-4 border-white/20 border-t-purple-500 rounded-full animate-spin" />
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
                  <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />

                  {/* Status badge */}
                  <div class="absolute top-4 right-4">
                    <span
                      class={`px-3 py-1.5 text-sm rounded-xl border ${getStatusColor(camp().status)}`}
                    >
                      {getStatusLabel(camp().status)}
                    </span>
                  </div>

                  {/* Quick actions for owner */}
                  <Show when={isOwner()}>
                    <div class="absolute top-4 left-4 flex gap-2">
                      <button
                        onClick={toggleStatus}
                        class="p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50 transition-colors"
                        title={
                          camp().status === CampaignStatus.Active
                            ? "Mettre en pause"
                            : "Reprendre"
                        }
                      >
                        <Show
                          when={camp().status === CampaignStatus.Active}
                          fallback={<Play class="w-4 h-4 text-green-400" />}
                        >
                          <Pause class="w-4 h-4 text-yellow-400" />
                        </Show>
                      </button>
                      <button
                        class="p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50 transition-colors"
                        title="Paramètres"
                      >
                        <Settings class="w-4 h-4 text-slate-300" />
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
                        <span class="flex items-center gap-1.5">
                          <MapPin class="w-4 h-4" />
                          {camp().setting || "Univers personnalisé"}
                        </span>
                        <span class="flex items-center gap-1.5">
                          <Users class="w-4 h-4" />
                          {camp().currentPlayers}/{camp().maxPlayers} joueurs
                        </span>
                        <span class="flex items-center gap-1.5">
                          <BookOpen class="w-4 h-4" />
                          {camp().totalSessions} sessions
                        </span>
                      </div>

                      <Show when={camp().description}>
                        <p class="text-slate-300/80 leading-relaxed">
                          {camp().description}
                        </p>
                      </Show>

                      {/* Tags */}
                      <Show when={camp().tags && camp().tags!.length > 0}>
                        <div class="flex flex-wrap gap-2 mt-4">
                          <For each={camp().tags}>
                            {(tag) => (
                              <span class="px-2.5 py-1 text-xs bg-white/10 text-slate-300 rounded-full">
                                {tag}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>

                    {/* DM Card */}
                    <div class="sm:w-64 p-4 bg-white/5 rounded-xl border border-white/10">
                      <div class="flex items-center gap-3 mb-3">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                          <Crown class="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p class="text-xs text-amber-400 uppercase tracking-wider">
                            Maître du Jeu
                          </p>
                          <p class="text-white font-semibold">
                            {camp().dungeonMasterName}
                          </p>
                        </div>
                      </div>
                      <div class="text-sm text-slate-400">
                        <p>
                          Niveau actuel:{" "}
                          <span class="text-purple-400 font-semibold">
                            {camp().currentLevel || camp().startingLevel}
                          </span>
                        </p>
                        <p>Démarré le {formatDate(camp().createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Next Session Banner */}
                  <Show when={camp().nextSessionDate}>
                    <div class="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                          <Calendar class="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p class="text-sm text-green-400 font-medium">
                            Prochaine session
                          </p>
                          <p class="text-white">
                            {formatDateTime(camp().nextSessionDate!)}
                          </p>
                        </div>
                      </div>
                      <button
                        class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                        onClick={handleLaunchSession}
                        disabled={launchingSession()}
                      >
                        <Show
                          when={launchingSession()}
                          fallback={<Play class="w-4 h-4" />}
                        >
                          <Loader2 class="w-4 h-4 animate-spin" />
                        </Show>
                        {launchingSession()
                          ? "Création..."
                          : "Lancer la session"}
                      </button>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Tabs */}
              <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
                <TabButton
                  active={activeTab() === "overview"}
                  onClick={() => setActiveTab("overview")}
                  icon={<BookOpen class="w-4 h-4" />}
                  label="Aperçu"
                />
                <TabButton
                  active={activeTab() === "players"}
                  onClick={() => setActiveTab("players")}
                  icon={<Users class="w-4 h-4" />}
                  label="Joueurs"
                  count={camp().currentPlayers}
                />
                <TabButton
                  active={activeTab() === "sessions"}
                  onClick={() => setActiveTab("sessions")}
                  icon={<Calendar class="w-4 h-4" />}
                  label="Sessions"
                  count={camp().totalSessions}
                />
              </div>

              {/* Tab Content */}
              <div class="space-y-6">
                {/* Overview Tab */}
                <Show when={activeTab() === "overview"}>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      icon={<Users class="w-5 h-5" />}
                      label="Joueurs"
                      value={`${camp().currentPlayers}/${camp().maxPlayers}`}
                      color="purple"
                    />
                    <StatCard
                      icon={<BookOpen class="w-5 h-5" />}
                      label="Sessions jouées"
                      value={camp().totalSessions.toString()}
                      color="blue"
                    />
                    <StatCard
                      icon={<Crown class="w-5 h-5" />}
                      label="Niveau actuel"
                      value={(
                        camp().currentLevel || camp().startingLevel
                      ).toString()}
                      color="amber"
                    />
                    <StatCard
                      icon={<Clock class="w-5 h-5" />}
                      label="Durée"
                      value={`${Math.ceil((Date.now() - new Date(camp().createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))} mois`}
                      color="green"
                    />
                  </div>

                  {/* Recent Activity */}
                  <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 class="font-display text-lg text-white mb-4 flex items-center gap-2">
                      <MessageSquare class="w-5 h-5 text-purple-400" />
                      Activité récente
                    </h3>
                    <div class="space-y-3">
                      <ActivityItem
                        icon="📜"
                        text="Session 12 terminée: Les Tours d'Argent"
                        time="Il y a 4 jours"
                      />
                      <ActivityItem
                        icon="⚔️"
                        text="Le groupe a atteint le niveau 6"
                        time="Il y a 1 semaine"
                      />
                      <ActivityItem
                        icon="👤"
                        text="DragonSlayer a rejoint la campagne"
                        time="Il y a 2 semaines"
                      />
                    </div>
                  </div>
                </Show>

                {/* Players Tab */}
                <Show when={activeTab() === "players"}>
                  <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                    <div class="p-4 border-b border-white/10 flex items-center justify-between">
                      <h3 class="font-display text-lg text-white">
                        Joueurs ({camp().currentPlayers})
                      </h3>
                      <Show
                        when={
                          isOwner() && camp().currentPlayers < camp().maxPlayers
                        }
                      >
                        <button
                          onClick={handleGenerateInvite}
                          class="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                        >
                          <UserPlus class="w-4 h-4" />
                          Inviter
                        </button>
                      </Show>
                    </div>

                    <div class="divide-y divide-white/5">
                      {/* DM */}
                      <div class="p-4 flex items-center gap-4 bg-amber-500/5">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                          <Crown class="w-6 h-6 text-white" />
                        </div>
                        <div class="flex-1">
                          <p class="text-white font-semibold">
                            {camp().dungeonMasterName}
                          </p>
                          <p class="text-amber-400 text-sm">Maître du Jeu</p>
                        </div>
                      </div>

                      {/* Players */}
                      <For each={camp().players}>
                        {(player) => (
                          <div class="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                            <div class="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <span class="text-lg">🎭</span>
                            </div>
                            <div class="flex-1 min-w-0">
                              <p class="text-white font-semibold">
                                {player.username}
                              </p>
                              <p class="text-slate-400 text-sm truncate">
                                {player.characterName || "Pas de personnage"}
                              </p>
                            </div>
                            <Show when={isOwner()}>
                              <button
                                onClick={() => handleRemoveMember(player.id)}
                                class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Retirer le joueur"
                              >
                                <X class="w-4 h-4" />
                              </button>
                            </Show>
                          </div>
                        )}
                      </For>

                      {/* Empty slots */}
                      <For
                        each={Array(
                          camp().maxPlayers - camp().currentPlayers,
                        ).fill(0)}
                      >
                        {() => (
                          <div class="p-4 flex items-center gap-4 opacity-50">
                            <div class="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                              <Plus class="w-5 h-5 text-slate-500" />
                            </div>
                            <div class="flex-1">
                              <p class="text-slate-500">Place disponible</p>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Sessions Tab */}
                <Show when={activeTab() === "sessions"}>
                  <div class="space-y-4">
                    <Show when={isOwner()}>
                      <button class="w-full p-4 bg-game-dark/60 backdrop-blur-xl border border-dashed border-purple-500/30 rounded-2xl hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-2 text-purple-400">
                        <Plus class="w-5 h-5" />
                        Planifier une nouvelle session
                      </button>
                    </Show>

                    <For each={camp().sessions}>
                      {(session) => (
                        <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors">
                          <div class="flex items-start gap-4">
                            <div
                              class={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                session.completed
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-blue-500/20 text-blue-400"
                              }`}
                            >
                              <Show
                                when={session.completed}
                                fallback={<Calendar class="w-5 h-5" />}
                              >
                                <Check class="w-5 h-5" />
                              </Show>
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 mb-1">
                                <span class="text-purple-400 font-semibold">
                                  #{session.number}
                                </span>
                                <h4 class="text-white font-semibold truncate">
                                  {session.title}
                                </h4>
                              </div>
                              <p class="text-slate-400 text-sm">
                                {formatDate(session.date)}
                              </p>
                              <Show when={session.summary}>
                                <p class="text-slate-500 text-sm mt-2 line-clamp-2">
                                  {session.summary}
                                </p>
                              </Show>
                            </div>
                            <ChevronRight class="w-5 h-5 text-slate-500" />
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              {/* Erreur création de session */}
              <Show when={launchError()}>
                <p class="mt-4 text-red-400 text-sm">{launchError()}</p>
              </Show>

              {/* Actions Footer */}
              <div class="mt-8 flex flex-col sm:flex-row gap-4">
                <Show when={isOwner()}>
                  <button
                    class="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    onClick={handleLaunchSession}
                    disabled={launchingSession()}
                  >
                    <Show
                      when={launchingSession()}
                      fallback={<Play class="w-5 h-5" />}
                    >
                      <Loader2 class="w-5 h-5 animate-spin" />
                    </Show>
                    {launchingSession()
                      ? "Création de la session..."
                      : "Lancer une session"}
                  </button>
                </Show>
                <Show when={!isOwner()}>
                  <button
                    class="flex-1 py-3 px-6 rounded-xl bg-game-dark/60 border border-white/10 text-slate-400 font-semibold flex items-center justify-center gap-2 cursor-default"
                    disabled
                    title="Seul le MJ peut créer une session"
                  >
                    <Play class="w-5 h-5" />
                    Lancer une session (MJ uniquement)
                  </button>
                </Show>
                <Show when={isOwner()}>
                  <button
                    onClick={handleUpdate}
                    class="py-3 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit3 class="w-5 h-5" />
                    Modifier
                  </button>
                  <button
                    onClick={handleDelete}
                    class="py-3 px-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 class="w-5 h-5" />
                    Supprimer
                  </button>
                </Show>
              </div>
            </main>
          )}
        </Show>
      </Show>

      {/* Invite Code Modal */}
      <Show when={showInviteModal()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            class="bg-game-dark border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-xl font-display text-white mb-4">
              Code d'invitation
            </h3>
            <p class="text-slate-400 mb-4">
              Partagez ce code avec vos joueurs pour les inviter à rejoindre la
              campagne.
            </p>
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
              <code class="text-purple-400 text-lg font-mono">
                {inviteCode()}
              </code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteCode() || "");
                alert("Code copié dans le presse-papiers !");
              }}
              class="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors"
            >
              Copier le code
            </button>
          </div>
        </div>
      </Show>

      {/* Error Toast */}
      <Show when={error()}>
        <div class="fixed bottom-4 right-4 z-50 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-lg">
          {error()}
          <button
            onClick={() => setError(null)}
            class="ml-4 text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      </Show>

      {/* Session invite modal (SessionStarted) */}
      <Show when={sessionInvite()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSessionInvite(null)}
        >
          <div
            class="bg-game-dark border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-xl font-display text-white mb-3">
              Session de jeu démarrée
            </h3>
            <p class="text-slate-300 mb-4">
              <span class="text-purple-300 font-semibold">
                {sessionInvite()?.startedByUserName || "Un joueur"}
              </span>{" "}
              a démarré une session de jeu. Souhaitez-vous la rejoindre ?
            </p>
            <Show when={inviteError()}>
              <p class="mb-3 text-red-400 text-sm">{inviteError()}</p>
            </Show>
            <div class="flex gap-3">
              <button
                onClick={() => setSessionInvite(null)}
                class="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all"
                disabled={joiningInvite()}
              >
                Plus tard
              </button>
              <button
                onClick={handleJoinInvite}
                class="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all disabled:opacity-50"
                disabled={joiningInvite()}
              >
                <Show when={joiningInvite()} fallback={"Rejoindre"}>
                  Rejoindre...
                </Show>
              </button>
            </div>
          </div>
        </div>
      </Show>

      <style jsx>{`
        .campaign-view-page {
          background: linear-gradient(
            135deg,
            #1a1a2e 0%,
            #16213e 50%,
            #0f0f1a 100%
          );
        }
      `}</style>
    </div>
  );
}

/**
 * Tab button component
 */
function TabButton(props: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={props.onClick}
      class={`flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all ${
        props.active
          ? "bg-purple-600/30 border-purple-500/50 text-white"
          : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
      }`}
    >
      {props.icon}
      <span>{props.label}</span>
      <Show when={props.count !== undefined}>
        <span
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
  icon: any;
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
    <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-xl p-4">
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

/**
 * Activity item component
 */
function ActivityItem(props: { icon: string; text: string; time: string }) {
  return (
    <div class="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
      <span class="text-lg">{props.icon}</span>
      <div class="flex-1 min-w-0">
        <p class="text-white text-sm">{props.text}</p>
        <p class="text-slate-500 text-xs mt-0.5">{props.time}</p>
      </div>
    </div>
  );
}
