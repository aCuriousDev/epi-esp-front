import { A, useNavigate, useParams } from "@solidjs/router";
import {
  ArrowLeft,
  Crown,
  Users,
  Globe,
  Lock,
  Mail,
  BookOpen,
  Save,
} from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import {
  CampaignVisibility,
  getVisibilityLabel,
} from "../types/campaign";
import {
  CampaignService,
} from "../services/campaign.service";

function toVisibility(isPublic: boolean): CampaignVisibility {
  return isPublic ? CampaignVisibility.Public : CampaignVisibility.Private;
}

export default function EditCampaign() {
  const navigate = useNavigate();
  const params = useParams();

  const [loading, setLoading] = createSignal(true);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [visibility, setVisibility] = createSignal<CampaignVisibility>(
    CampaignVisibility.Private,
  );
  const [maxPlayers, setMaxPlayers] = createSignal(5);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      setLoading(true);
      setError(null);
      const c = await CampaignService.getCampaign(params.id);
      setTitle(c.name ?? "");
      setDescription(c.description ?? "");
      setVisibility(toVisibility(!!c.isPublic));
      setMaxPlayers(Math.min(6, Math.max(2, Number(c.maxPlayers ?? 5))));
    } catch (err: any) {
      console.error("Failed to load campaign for edit:", err);
      setError("Impossible de charger la campagne.");
    } finally {
      setLoading(false);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title().trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await CampaignService.updateCampaign(params.id, {
        name: title().trim(),
        description: description().trim() || undefined,
        maxPlayers: maxPlayers(),
        isPublic: visibility() === CampaignVisibility.Public,
      });
      navigate(`/campaigns/${params.id}`);
    } catch (err: any) {
      console.error("Failed to update campaign:", err);
      setError(
        err.response?.data?.message ||
          "Impossible de modifier la campagne. Veuillez réessayer.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div class="create-campaign-page min-h-screen w-full bg-brand-gradient">
      {/* Background effects */}
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          class="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"
          style="animation-delay: 1s"
        />
      </div>

      {/* Vignette */}
      <div class="vignette absolute inset-0" />

      {/* Back button */}
      <A
        href={`/campaigns/${params.id}`}
        class="settings-btn !left-4 !right-auto"
        aria-label="Retour"
      >
        <ArrowLeft class="settings-icon h-5 w-5" />
      </A>

      <main class="relative z-10 max-w-2xl mx-auto p-6 pt-20">
        <div class="text-center mb-8">
          <div class="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Crown class="w-8 h-8 text-white" />
          </div>
          <h1 class="title-shine title-gradient font-display text-3xl sm:text-4xl tracking-wide bg-clip-text text-transparent">
            Modifier la campagne
          </h1>
          <p class="mt-2 text-slate-300/80">
            Mettez à jour les informations principales
          </p>
        </div>

        <Show
          when={!loading()}
          fallback={
            <div class="text-center py-16">
              <div class="w-16 h-16 mx-auto mb-4 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <p class="text-slate-300">Chargement...</p>
            </div>
          }
        >
          <Show when={error()}>
            <div class="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center">
              {error()}
            </div>
          </Show>

          <form
            onSubmit={handleSubmit}
            class="campaign-form bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div class="p-6 space-y-6">
              <div class="text-center pb-4 border-b border-white/10">
                <h2 class="text-xl font-semibold text-white flex items-center justify-center gap-2">
                  <BookOpen class="w-5 h-5 text-purple-400" />
                  Informations
                </h2>
              </div>

              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">
                  Nom de la campagne *
                </label>
                <input
                  type="text"
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  placeholder="Nom de la campagne"
                  class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  maxLength={100}
                />
                <p class="text-xs text-slate-500">
                  {title().length}/100 caractères
                </p>
              </div>

              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">
                  Description
                </label>
                <textarea
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  placeholder="Description de la campagne"
                  rows={4}
                  class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                  maxLength={500}
                />
                <p class="text-xs text-slate-500">
                  {description().length}/500 caractères
                </p>
              </div>

              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-300">
                  Visibilité ({getVisibilityLabel(visibility())})
                </label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility(CampaignVisibility.Private)}
                    class={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      visibility() === CampaignVisibility.Private
                        ? "bg-purple-500/20 border-purple-500/50 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div
                      class={
                        visibility() === CampaignVisibility.Private
                          ? "text-purple-400"
                          : "text-slate-400"
                      }
                    >
                      <Lock class="w-5 h-5" />
                    </div>
                    <span class="text-sm">Privée</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility(CampaignVisibility.InviteOnly)}
                    class={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      visibility() === CampaignVisibility.InviteOnly
                        ? "bg-purple-500/20 border-purple-500/50 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div
                      class={
                        visibility() === CampaignVisibility.InviteOnly
                          ? "text-purple-400"
                          : "text-slate-400"
                      }
                    >
                      <Mail class="w-5 h-5" />
                    </div>
                    <span class="text-sm">Invitation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility(CampaignVisibility.Public)}
                    class={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      visibility() === CampaignVisibility.Public
                        ? "bg-purple-500/20 border-purple-500/50 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div
                      class={
                        visibility() === CampaignVisibility.Public
                          ? "text-purple-400"
                          : "text-slate-400"
                      }
                    >
                      <Globe class="w-5 h-5" />
                    </div>
                    <span class="text-sm">Publique</span>
                  </button>
                </div>
              </div>

              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-300">
                  <Users class="w-4 h-4 inline mr-2" />
                  Nombre de joueurs maximum
                </label>
                <div class="flex items-center gap-4">
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={maxPlayers()}
                    onInput={(e) =>
                      setMaxPlayers(parseInt(e.currentTarget.value))
                    }
                    class="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <span class="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xl font-bold text-white">
                    {maxPlayers()}
                  </span>
                </div>
              </div>
            </div>

            <div class="px-6 py-4 bg-white/5 border-t border-white/10 flex gap-3">
              <button
                type="button"
                onClick={() => navigate(`/campaigns/${params.id}`)}
                class="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                disabled={isSubmitting()}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting() || !title().trim()}
                class="flex-1 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-semibold flex items-center justify-center gap-2"
              >
                <Show
                  when={isSubmitting()}
                  fallback={
                    <>
                      <Save class="w-5 h-5" />
                      Enregistrer
                    </>
                  }
                >
                  <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sauvegarde...
                </Show>
              </button>
            </div>
          </form>
        </Show>

        <style jsx>{`
          .create-campaign-page {
            background: linear-gradient(
              135deg,
              var(--ink-700) 0%,
              var(--ink-800) 50%,
              var(--ink-900) 100%
            );
          }

          .campaign-form {
            animation: cardSlideUp 0.5s ease-out;
          }

          @keyframes cardSlideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            background: var(--plum-500);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(139, 92, 246, 0.4);
          }
        `}</style>
      </main>
    </div>
  );
}

