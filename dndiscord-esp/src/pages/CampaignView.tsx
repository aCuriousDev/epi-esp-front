import { A, useParams, useNavigate } from "@solidjs/router";
import { 
  ArrowLeft, Crown, Users, Calendar, BookOpen, Settings, 
  Play, Pause, UserPlus, Trash2, Edit3, Clock, MapPin,
  MessageSquare, ChevronRight, Plus, Check, X
} from "lucide-solid";
import { createSignal, onMount, Show, For } from "solid-js";
import { 
  Campaign, CampaignStatus, CampaignPlayer, CampaignSession,
  getStatusColor, getStatusLabel 
} from "../types/campaign";
import { authStore } from "../stores/auth.store";
import { AuthService } from "../services/auth.service";

// Mock data
const mockCampaign: Campaign = {
  id: "1",
  title: "La Malédiction de Strahd",
  description: "Plongez dans les brumes de Barovie et affrontez le vampire le plus redouté des Royaumes. Cette campagne d'horreur gothique vous emmènera dans un monde de terreur, de mystère et de tragédie où chaque choix compte.",
  status: CampaignStatus.Active,
  visibility: "Private" as any,
  dungeonMasterId: "dm1",
  dungeonMasterName: "MaîtreDuJeu",
  dungeonMasterAvatar: "",
  maxPlayers: 5,
  currentPlayers: 4,
  totalSessions: 12,
  setting: "Ravenloft",
  startingLevel: 1,
  currentLevel: 6,
  nextSessionDate: "2025-12-15T19:00:00",
  tags: ["Horreur", "Gothique", "RP Intense"],
  createdAt: "2025-06-01",
  players: [
    { id: "p1", username: "Thorin", role: "player", characterName: "Bruenor le Nain", joinedAt: "2025-06-01" },
    { id: "p2", username: "Elara", role: "player", characterName: "Aria Sombrelame", joinedAt: "2025-06-01" },
    { id: "p3", username: "Gandalf42", role: "player", characterName: "Zephyr le Sage", joinedAt: "2025-06-05" },
    { id: "p4", username: "DragonSlayer", role: "player", characterName: "Kira la Rouge", joinedAt: "2025-06-10" },
  ],
  sessions: [
    { id: "s1", number: 12, title: "Les Tours d'Argent", date: "2025-12-08", completed: true, summary: "Les héros ont découvert les secrets de la tour..." },
    { id: "s2", number: 11, title: "La Crypte des Ombres", date: "2025-12-01", completed: true, summary: "Exploration de la crypte ancestrale..." },
    { id: "s3", number: 10, title: "Rencontre avec le Comte", date: "2025-11-24", completed: true },
  ],
};

export default function CampaignView() {
  const params = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = createSignal<Campaign | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal<"overview" | "players" | "sessions">("overview");
  const [showInviteModal, setShowInviteModal] = createSignal(false);

  const user = () => authStore.user();
  const isOwner = () => true; // In real app, check if user is DM

  onMount(async () => {
    // TODO: Fetch campaign from API using params.id
    setTimeout(() => {
      setCampaign(mockCampaign);
      setLoading(false);
    }, 300);
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

  const toggleStatus = () => {
    const c = campaign();
    if (!c) return;
    const newStatus = c.status === CampaignStatus.Active 
      ? CampaignStatus.Paused 
      : CampaignStatus.Active;
    setCampaign({ ...c, status: newStatus });
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
      <A href="/campaigns" class="settings-btn !left-4 !right-auto" aria-label="Retour">
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
                    <span class={`px-3 py-1.5 text-sm rounded-xl border ${getStatusColor(camp().status)}`}>
                      {getStatusLabel(camp().status)}
                    </span>
                  </div>

                  {/* Quick actions for owner */}
                  <Show when={isOwner()}>
                    <div class="absolute top-4 left-4 flex gap-2">
                      <button
                        onClick={toggleStatus}
                        class="p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 hover:bg-black/50 transition-colors"
                        title={camp().status === CampaignStatus.Active ? "Mettre en pause" : "Reprendre"}
                      >
                        <Show when={camp().status === CampaignStatus.Active} fallback={<Play class="w-4 h-4 text-green-400" />}>
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
                          <p class="text-xs text-amber-400 uppercase tracking-wider">Maître du Jeu</p>
                          <p class="text-white font-semibold">{camp().dungeonMasterName}</p>
                        </div>
                      </div>
                      <div class="text-sm text-slate-400">
                        <p>Niveau actuel: <span class="text-purple-400 font-semibold">{camp().currentLevel || camp().startingLevel}</span></p>
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
                          <p class="text-sm text-green-400 font-medium">Prochaine session</p>
                          <p class="text-white">{formatDateTime(camp().nextSessionDate!)}</p>
                        </div>
                      </div>
                      <button class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors flex items-center gap-2">
                        <Play class="w-4 h-4" />
                        Lancer la session
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
                      value={(camp().currentLevel || camp().startingLevel).toString()}
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
                      <h3 class="font-display text-lg text-white">Joueurs ({camp().currentPlayers})</h3>
                      <Show when={isOwner() && camp().currentPlayers < camp().maxPlayers}>
                        <button 
                          onClick={() => setShowInviteModal(true)}
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
                          <p class="text-white font-semibold">{camp().dungeonMasterName}</p>
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
                              <p class="text-white font-semibold">{player.username}</p>
                              <p class="text-slate-400 text-sm truncate">
                                {player.characterName || "Pas de personnage"}
                              </p>
                            </div>
                            <Show when={isOwner()}>
                              <button class="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                                <X class="w-4 h-4" />
                              </button>
                            </Show>
                          </div>
                        )}
                      </For>

                      {/* Empty slots */}
                      <For each={Array(camp().maxPlayers - camp().currentPlayers).fill(0)}>
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
                            <div class={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              session.completed 
                                ? "bg-green-500/20 text-green-400" 
                                : "bg-blue-500/20 text-blue-400"
                            }`}>
                              <Show when={session.completed} fallback={<Calendar class="w-5 h-5" />}>
                                <Check class="w-5 h-5" />
                              </Show>
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 mb-1">
                                <span class="text-purple-400 font-semibold">#{session.number}</span>
                                <h4 class="text-white font-semibold truncate">{session.title}</h4>
                              </div>
                              <p class="text-slate-400 text-sm">{formatDate(session.date)}</p>
                              <Show when={session.summary}>
                                <p class="text-slate-500 text-sm mt-2 line-clamp-2">{session.summary}</p>
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

              {/* Actions Footer */}
              <div class="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  class="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg flex items-center justify-center gap-2"
                  onClick={() => navigate("/board")}
                >
                  <Play class="w-5 h-5" />
                  Lancer une session
                </button>
                <Show when={isOwner()}>
                  <button
                    class="py-3 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit3 class="w-5 h-5" />
                    Modifier
                  </button>
                  <button
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

      <style jsx>{`
        .campaign-view-page {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%);
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
        <span class={`text-xs px-1.5 py-0.5 rounded-full ${
          props.active ? "bg-purple-500/50" : "bg-white/10"
        }`}>
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
      <div class={`w-10 h-10 rounded-lg ${colorClasses[props.color]} flex items-center justify-center mb-3`}>
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

