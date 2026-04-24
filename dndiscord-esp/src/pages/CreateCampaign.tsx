import { A, useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  Crown,
  Users,
  Globe,
  Lock,
  Mail,
  BookOpen,
} from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { CampaignVisibility } from "../types/campaign";
import {
  CampaignService,
  APICampaignStatus,
} from "../services/campaign.service";

/**
 * Single-step campaign creation — only fields the backend actually persists:
 * name, description, imageUrl, maxPlayers, isPublic, status. The old 3-step
 * wizard collected setting/startingLevel/tags that were silently dropped at the
 * API boundary and displayed back as hardcoded placeholders — pure scaffolding.
 */
export default function CreateCampaign() {
  const navigate = useNavigate();

  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [imageUrl, setImageUrl] = createSignal("");
  const [visibility, setVisibility] = createSignal<CampaignVisibility>(
    CampaignVisibility.Private,
  );
  const [maxPlayers, setMaxPlayers] = createSignal(5);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const canSubmit = () => title().trim().length >= 3 && !isSubmitting();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await CampaignService.createCampaign({
        name: title().trim(),
        description: description().trim() || undefined,
        imageUrl: imageUrl().trim() || undefined,
        maxPlayers: maxPlayers(),
        isPublic: visibility() === CampaignVisibility.Public,
        status: APICampaignStatus.Draft,
      });
      navigate(`/campaigns/${response.id}`);
    } catch (err: any) {
      console.error("Failed to create campaign:", err);
      setError(
        err.response?.data?.message
          ?? "Impossible de créer la campagne. Veuillez réessayer.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div class="create-campaign-page min-h-screen w-full bg-brand-gradient">
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          class="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"
          style="animation-delay: 1s"
        />
      </div>

      <div class="vignette absolute inset-0" />

      <A
        href="/campaigns"
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
            Nouvelle Campagne
          </h1>
          <p class="mt-2 text-slate-300/80">
            Créez votre aventure et invitez vos joueurs.
          </p>
        </div>

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
                Informations de base
              </h2>
            </div>

            {/* Title */}
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">
                Nom de la campagne *
              </label>
              <input
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                placeholder="Ex: La Malédiction de Strahd"
                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                maxLength={100}
              />
              <p class="text-xs text-slate-500">
                {title().length}/100 caractères
              </p>
            </div>

            {/* Description */}
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">
                Description
              </label>
              <textarea
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="Décrivez votre campagne, son ambiance, son histoire..."
                rows={4}
                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                maxLength={500}
              />
              <p class="text-xs text-slate-500">
                {description().length}/500 caractères
              </p>
            </div>

            {/* Image URL (optional) */}
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">
                Illustration (URL, optionnelle)
              </label>
              <input
                type="url"
                value={imageUrl()}
                onInput={(e) => setImageUrl(e.currentTarget.value)}
                placeholder="https://…"
                class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>

            {/* Visibility */}
            <div class="space-y-3">
              <label class="block text-sm font-medium text-slate-300">
                Visibilité
              </label>
              <div class="grid grid-cols-3 gap-2">
                <VisibilityOption
                  selected={visibility() === CampaignVisibility.Private}
                  onClick={() => setVisibility(CampaignVisibility.Private)}
                  icon={<Lock class="w-5 h-5" />}
                  label="Privée"
                />
                <VisibilityOption
                  selected={visibility() === CampaignVisibility.InviteOnly}
                  onClick={() => setVisibility(CampaignVisibility.InviteOnly)}
                  icon={<Mail class="w-5 h-5" />}
                  label="Invitation"
                />
                <VisibilityOption
                  selected={visibility() === CampaignVisibility.Public}
                  onClick={() => setVisibility(CampaignVisibility.Public)}
                  icon={<Globe class="w-5 h-5" />}
                  label="Publique"
                />
              </div>
            </div>

            {/* Max Players */}
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
                  onInput={(e) => setMaxPlayers(parseInt(e.currentTarget.value))}
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
              type="submit"
              disabled={!canSubmit()}
              class="flex-1 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-semibold flex items-center justify-center gap-2"
            >
              <Show
                when={isSubmitting()}
                fallback={
                  <>
                    <Crown class="w-5 h-5" />
                    Créer la campagne
                  </>
                }
              >
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Création...
              </Show>
            </button>
          </div>
        </form>
      </main>

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
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
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
    </div>
  );
}

function VisibilityOption(props: {
  selected: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
        props.selected
          ? "bg-purple-500/20 border-purple-500/50 text-white"
          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      <div class={props.selected ? "text-purple-400" : "text-slate-400"}>
        {props.icon}
      </div>
      <span class="text-sm">{props.label}</span>
    </button>
  );
}
