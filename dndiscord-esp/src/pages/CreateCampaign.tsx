import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, Crown, Users, Globe, Lock, Mail, Sparkles, BookOpen, Map, Wand2 } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { CampaignVisibility, getVisibilityLabel } from "../types/campaign";
import { CampaignService, CampaignStatus as APICampaignStatus } from "../services/campaign.service";

// Preset campaign settings
const SETTINGS_PRESETS = [
  { id: "forgotten_realms", name: "Royaumes Oubliés", icon: "🏰" },
  { id: "eberron", name: "Eberron", icon: "⚙️" },
  { id: "ravenloft", name: "Ravenloft", icon: "🦇" },
  { id: "greyhawk", name: "Faucongris", icon: "⚔️" },
  { id: "homebrew", name: "Homebrew", icon: "✨" },
  { id: "other", name: "Autre", icon: "📜" },
];

const CAMPAIGN_TAGS = [
  "Aventure", "Horreur", "Mystère", "Combat", "RP Intense", 
  "Exploration", "Intrigue", "Humour", "Sombre", "Épique",
  "Débutants bienvenus", "Joueurs expérimentés"
];

export default function CreateCampaign() {
  const navigate = useNavigate();
  
  // Form state
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [visibility, setVisibility] = createSignal<CampaignVisibility>(CampaignVisibility.Private);
  const [maxPlayers, setMaxPlayers] = createSignal(5);
  const [setting, setSetting] = createSignal("forgotten_realms");
  const [startingLevel, setStartingLevel] = createSignal(1);
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [step, setStep] = createSignal(1);
  const [error, setError] = createSignal<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title().trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await CampaignService.createCampaign({
        name: title().trim(),
        description: description().trim() || undefined,
        maxPlayers: maxPlayers(),
        isPublic: visibility() === CampaignVisibility.Public,
        status: APICampaignStatus.Draft,
      });

      // Redirect to the new campaign page
      navigate(`/campaigns/${response.id}`);
    } catch (err: any) {
      console.error("Failed to create campaign:", err);
      setError(err.response?.data?.message || "Impossible de créer la campagne. Veuillez réessayer.");
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step() === 1) return title().trim().length >= 3;
    if (step() === 2) return true;
    return true;
  };

  return (
    <div class="create-campaign-page min-h-screen w-full bg-brand-gradient">
      {/* Background effects */}
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div class="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s" />
      </div>

      {/* Vignette */}
      <div class="vignette absolute inset-0" />

      {/* Back button */}
      <A href="/campaigns" class="settings-btn !left-4 !right-auto" aria-label="Retour">
        <ArrowLeft class="settings-icon h-5 w-5" />
      </A>

      <main class="relative z-10 max-w-2xl mx-auto p-6 pt-20">
        {/* Header */}
        <div class="text-center mb-8">
          <div class="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Crown class="w-8 h-8 text-white" />
          </div>
          <h1 class="title-shine title-gradient font-display text-3xl sm:text-4xl tracking-wide bg-clip-text text-transparent">
            Nouvelle Campagne
          </h1>
          <p class="mt-2 text-slate-300/80">
            Créez votre propre aventure épique
          </p>
        </div>

        {/* Progress steps */}
        <div class="flex justify-center gap-2 mb-8">
          <For each={[1, 2, 3]}>
            {(s) => (
              <div 
                class={`w-3 h-3 rounded-full transition-all ${
                  s === step() 
                    ? "bg-purple-500 scale-125" 
                    : s < step() 
                      ? "bg-purple-500/50" 
                      : "bg-white/20"
                }`}
              />
            )}
          </For>
        </div>

        {/* Error message */}
        <Show when={error()}>
          <div class="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center">
            {error()}
          </div>
        </Show>

        {/* Form Card */}
        <form onSubmit={handleSubmit} class="campaign-form bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Step 1: Basic Info */}
          <Show when={step() === 1}>
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
                <p class="text-xs text-slate-500">{title().length}/100 caractères</p>
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
                <p class="text-xs text-slate-500">{description().length}/500 caractères</p>
              </div>

              {/* Visibility */}
              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-300">
                  Visibilité
                </label>
                <div class="grid grid-cols-3 gap-2">
                  <VisibilityOption
                    value={CampaignVisibility.Private}
                    selected={visibility() === CampaignVisibility.Private}
                    onClick={() => setVisibility(CampaignVisibility.Private)}
                    icon={<Lock class="w-5 h-5" />}
                    label="Privée"
                  />
                  <VisibilityOption
                    value={CampaignVisibility.InviteOnly}
                    selected={visibility() === CampaignVisibility.InviteOnly}
                    onClick={() => setVisibility(CampaignVisibility.InviteOnly)}
                    icon={<Mail class="w-5 h-5" />}
                    label="Invitation"
                  />
                  <VisibilityOption
                    value={CampaignVisibility.Public}
                    selected={visibility() === CampaignVisibility.Public}
                    onClick={() => setVisibility(CampaignVisibility.Public)}
                    icon={<Globe class="w-5 h-5" />}
                    label="Publique"
                  />
                </div>
              </div>
            </div>
          </Show>

          {/* Step 2: Settings */}
          <Show when={step() === 2}>
            <div class="p-6 space-y-6">
              <div class="text-center pb-4 border-b border-white/10">
                <h2 class="text-xl font-semibold text-white flex items-center justify-center gap-2">
                  <Map class="w-5 h-5 text-purple-400" />
                  Paramètres de jeu
                </h2>
              </div>

              {/* Setting */}
              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-300">
                  Univers
                </label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <For each={SETTINGS_PRESETS}>
                    {(preset) => (
                      <button
                        type="button"
                        onClick={() => setSetting(preset.id)}
                        class={`p-3 rounded-xl border text-left transition-all ${
                          setting() === preset.id
                            ? "bg-purple-500/20 border-purple-500/50 text-white"
                            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span class="text-xl mr-2">{preset.icon}</span>
                        <span class="text-sm">{preset.name}</span>
                      </button>
                    )}
                  </For>
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
                    max={8}
                    value={maxPlayers()}
                    onInput={(e) => setMaxPlayers(parseInt(e.currentTarget.value))}
                    class="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <span class="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xl font-bold text-white">
                    {maxPlayers()}
                  </span>
                </div>
              </div>

              {/* Starting Level */}
              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-300">
                  <Wand2 class="w-4 h-4 inline mr-2" />
                  Niveau de départ
                </label>
                <div class="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={startingLevel()}
                    onInput={(e) => setStartingLevel(parseInt(e.currentTarget.value))}
                    class="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <span class="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl font-bold text-amber-400">
                    {startingLevel()}
                  </span>
                </div>
              </div>
            </div>
          </Show>

          {/* Step 3: Tags & Review */}
          <Show when={step() === 3}>
            <div class="p-6 space-y-6">
              <div class="text-center pb-4 border-b border-white/10">
                <h2 class="text-xl font-semibold text-white flex items-center justify-center gap-2">
                  <Sparkles class="w-5 h-5 text-purple-400" />
                  Tags & Finalisation
                </h2>
              </div>

              {/* Tags */}
              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-300">
                  Tags (max 5)
                </label>
                <div class="flex flex-wrap gap-2">
                  <For each={CAMPAIGN_TAGS}>
                    {(tag) => (
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        class={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                          selectedTags().includes(tag)
                            ? "bg-purple-500/30 border-purple-500/50 text-white"
                            : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {tag}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Summary */}
              <div class="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                <h3 class="font-semibold text-white">Résumé</h3>
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span class="text-slate-400">Nom:</span>
                    <span class="text-white ml-2">{title() || "—"}</span>
                  </div>
                  <div>
                    <span class="text-slate-400">Visibilité:</span>
                    <span class="text-white ml-2">{getVisibilityLabel(visibility())}</span>
                  </div>
                  <div>
                    <span class="text-slate-400">Univers:</span>
                    <span class="text-white ml-2">
                      {SETTINGS_PRESETS.find(s => s.id === setting())?.name}
                    </span>
                  </div>
                  <div>
                    <span class="text-slate-400">Joueurs:</span>
                    <span class="text-white ml-2">{maxPlayers()} max</span>
                  </div>
                  <div>
                    <span class="text-slate-400">Niveau:</span>
                    <span class="text-white ml-2">{startingLevel()}</span>
                  </div>
                  <div>
                    <span class="text-slate-400">Tags:</span>
                    <span class="text-white ml-2">{selectedTags().length}</span>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Actions */}
          <div class="px-6 py-4 bg-white/5 border-t border-white/10 flex gap-3">
            <Show when={step() > 1}>
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                class="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                Retour
              </button>
            </Show>
            
            <Show when={step() < 3}>
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                class="flex-1 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                Continuer
              </button>
            </Show>

            <Show when={step() === 3}>
              <button
                type="submit"
                disabled={isSubmitting() || !canProceed()}
                class="flex-1 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all font-semibold flex items-center justify-center gap-2"
              >
                <Show when={isSubmitting()} fallback={
                  <>
                    <Crown class="w-5 h-5" />
                    Créer la campagne
                  </>
                }>
                  <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Création...
                </Show>
              </button>
            </Show>
          </div>
        </form>
      </main>

      <style jsx>{`
        .create-campaign-page {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%);
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
          background: #8B5CF6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(139, 92, 246, 0.4);
        }
      `}</style>
    </div>
  );
}

/**
 * Visibility option button
 */
function VisibilityOption(props: {
  value: CampaignVisibility;
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

