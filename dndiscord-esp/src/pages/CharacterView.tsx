import { useParams, useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  Heart,
  Shield,
  Zap,
  Footprints,
  Edit3,
  Trash2,
  Plus,
  Minus,
  TrendingUp,
  Swords,
  ScrollText,
  X,
} from "lucide-solid";
import { Icon } from "@iconify-icon/solid";
import "../services/iconSetup";
import { createSignal, onMount, Show, For } from "solid-js";
import {
  Character,
  CharacterClass,
  CharacterRace,
  AbilityScores,
  formatModifier,
  getAbilityModifier,
} from "../types/character";
import { CharacterService, CharacterDto } from "../services/character.service";
import { characterClassDisplay, characterRaceDisplay } from "../i18n/characterDisplay";
import { GetCharacterProfilPic } from "../utils/characterProfilPic";
import { safeConfirm } from "../services/ui/confirm";
import InventoryPanel from "../components/InventoryPanel";
import WalletPanel from "../components/WalletPanel";
import { isHost, isInActiveSession } from "../stores/session.store";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

/**
 * Map API character response to frontend Character type
 */
function mapCharacterResponse(dto: CharacterDto): Character {
  return {
    id: dto.id,
    name: dto.name,
    level: dto.level,
    characterClass: dto.class as CharacterClass,
    race: dto.race as unknown as CharacterRace,
    abilities: dto.abilities,
    maxHitPoints: dto.maxHitPoints,
    currentHitPoints: dto.currentHitPoints,
    armorClass: 10 + getAbilityModifier(dto.abilities.dexterity), // Basic calculation
    speed: 30, // Default
    initiative: getAbilityModifier(dto.abilities.dexterity),
    createdAt: new Date().toISOString(),
  };
}

export default function CharacterView() {
  const params = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = createSignal<Character | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<"traits" | "inventory">("traits");

  onMount(async () => {
    try {
      setLoading(true);
      const dto = await CharacterService.getCharacter(params.id);
      const mappedCharacter = mapCharacterResponse(dto);
      setCharacter(mappedCharacter);
    } catch (err: any) {
      console.error("Failed to load character:", err);
      setError(t("characterView.loadError"));
    } finally {
      setLoading(false);
    }
  });

  const handleHitPointsChange = async (delta: number) => {
    const char = character();
    if (!char) return;

    const newHP = Math.max(
      0,
      Math.min(char.maxHitPoints, char.currentHitPoints + delta),
    );

    try {
      const dto = await CharacterService.updateHitPoints(char.id, newHP);
      const updatedChar = mapCharacterResponse(dto);
      setCharacter(updatedChar);
    } catch (err) {
      console.error("Failed to update hit points:", err);
      setError("Failed to update hit points.");
    }
  };

  const handleLevelUp = async () => {
    const char = character();
    if (!char) return;

    if (!safeConfirm(`Level ${char.name} up to level ${char.level + 1}?`)) {
      return;
    }

    try {
      const dto = await CharacterService.levelUp(char.id);
      const updatedChar = mapCharacterResponse(dto);
      setCharacter(updatedChar);
    } catch (err) {
      console.error("Failed to level up:", err);
      setError(t("characterView.levelUpError"));
    }
  };

  const getPortrait = () => {
    const char = character();
    if (!char) return GetCharacterProfilPic.getCharacterProfilPicOrDefault();
    return (
      char.portraitUrl ||
      GetCharacterProfilPic.getCharacterProfilPic(char.characterClass)
    );
  };

  const hpPercentage = () => {
    const char = character();
    if (!char) return 100;
    return (char.currentHitPoints / char.maxHitPoints) * 100;
  };

  const hpColor = () => {
    const pct = hpPercentage();
    if (pct > 60) return "bg-green-500";
    if (pct > 30) return "bg-yellow-500";
    return "bg-red-500";
  };

  // CharacterView lives outside any game room, so DM-only controls (Level Up,
  // give XP/gold/items, edit HP) must require both DM role AND a live hub
  // session — otherwise a past DM's persisted session leaks these controls
  // into the out-of-game roster screen.
  const isDmInActiveSession = () => isHost() && isInActiveSession();

  const abilities = () => {
    const char = character();
    if (!char) return [];
    return [
      { name: t("characterView.ability.strength"), abbr: "STR", value: char.abilities.strength },
      { name: t("characterView.ability.dexterity"), abbr: "DEX", value: char.abilities.dexterity },
      { name: t("characterView.ability.constitution"), abbr: "CON", value: char.abilities.constitution },
      { name: t("characterView.ability.intelligence"), abbr: "INT", value: char.abilities.intelligence },
      { name: t("characterView.ability.wisdom"), abbr: "WIS", value: char.abilities.wisdom },
      { name: t("characterView.ability.charisma"), abbr: "CHA", value: char.abilities.charisma },
    ];
  };

  return (
    <div class="relative min-h-screen w-full overflow-y-auto">
      <PageMeta title={t("page.characters.title")} />

      <Show
        when={!loading()}
        fallback={
          <div class="flex items-center justify-center min-h-screen">
            <div class="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        }
      >
        <Show when={character()}>
          {(char) => (
            <main class="relative z-10 max-w-4xl mx-auto p-6 pt-6 pb-12">
              {/* Character Header Card */}
              <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {/* Banner with class color gradient */}
                <div class="h-24 bg-gradient-to-r from-purple-600/40 via-indigo-600/40 to-violet-600/40 relative">
                  <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
                </div>

                {/* Portrait and Basic Info */}
                <div class="relative px-6 -mt-16">
                  <div class="flex flex-col sm:flex-row gap-6 items-start">
                    {/* Portrait */}
                    <div class="relative flex-shrink-0">
                      <div class="w-45 h-45 rounded-2xl overflow-hidden shadow-l">
                        <img
                          src={getPortrait()}
                          alt={char().name}
                          class="w-45 h-32 object-contain mx-auto"
                        />
                      </div>
                      {/* Level badge */}
                      <div class="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center border-2 border-game-dark shadow-lg">
                        <span class="text-sm font-bold text-white">
                          {char().level}
                        </span>
                      </div>
                    </div>

                    {/* Name and Class */}
                    <div class="flex-1 pt-4 sm:pt-8">
                      <h1 class="font-display text-3xl sm:text-4xl text-white">
                        {char().name}
                      </h1>
                      <p class="text-slate-300 mt-1">
                        <span class="text-purple-400">{characterRaceDisplay[char().race] ?? char().race}</span>
                        {" • "}
                        <span class="text-amber-400">
                          {characterClassDisplay[char().characterClass] ?? char().characterClass}
                        </span>
                        {" • "}
                        <span class="text-slate-400">
                          {t("characterView.level")} {char().level}
                        </span>
                      </p>
                      <Show when={char().campaign}>
                        <p class="text-slate-400 text-sm mt-2 flex items-center gap-1.5">
                          <ScrollText class="w-4 h-4 flex-shrink-0" />
                          {char().campaign!.title}
                        </p>
                      </Show>
                    </div>

                    {/* Action buttons (MJ only, in-game) */}
                    <Show when={isDmInActiveSession()}>
                      <div class="flex gap-2 pt-4 sm:pt-8">
                        <button
                          onClick={handleLevelUp}
                          class="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 border border-amber-400/20 hover:from-amber-400 hover:to-yellow-500 transition-colors flex items-center gap-2"
                          title={t("characterView.levelUp")}
                        >
                          <TrendingUp class="w-4 h-4 text-white" />
                          <span class="text-white text-sm font-semibold">
                            Level Up
                          </span>
                        </button>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Stats Bar */}
                <div class="px-6 py-6 mt-4">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* HP */}
                    <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div class="flex items-center justify-between text-red-400 mb-2">
                        <div class="flex items-center gap-2">
                          <Heart class="w-4 h-4" />
                          <span class="text-xs uppercase tracking-wider">
                            {t("characterView.hitPoints")}
                          </span>
                        </div>
                        <Show when={isDmInActiveSession()}>
                          <div class="flex gap-1">
                            <button
                              onClick={() => handleHitPointsChange(-1)}
                              class="w-6 h-6 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 flex items-center justify-center transition-colors"
                              title={t("characterView.removeHp")}
                            >
                              <Minus class="w-3 h-3 text-red-400" />
                            </button>
                            <button
                              onClick={() => handleHitPointsChange(1)}
                              class="w-6 h-6 rounded bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 flex items-center justify-center transition-colors"
                              title={t("characterView.addHp")}
                            >
                              <Plus class="w-3 h-3 text-green-400" />
                            </button>
                          </div>
                        </Show>
                      </div>
                      <div class="text-2xl font-bold text-white">
                        {char().currentHitPoints}
                        <span class="text-slate-500 text-lg">
                          /{char().maxHitPoints}
                        </span>
                      </div>
                      <div class="mt-2 h-2 bg-game-darker rounded-full overflow-hidden">
                        <div
                          class={`h-full ${hpColor()} transition-all duration-300`}
                          style={{ width: `${hpPercentage()}%` }}
                        />
                      </div>
                    </div>

                    {/* Armor Class */}
                    <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div class="flex items-center gap-2 text-blue-400 mb-2">
                        <Shield class="w-4 h-4" />
                        <span class="text-xs uppercase tracking-wider">
                          {t("characterView.armorClass")}
                        </span>
                      </div>
                      <div class="text-2xl font-bold text-white">
                        {char().armorClass}
                      </div>
                    </div>

                    {/* Initiative */}
                    <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div class="flex items-center gap-2 text-yellow-400 mb-2">
                        <Zap class="w-4 h-4" />
                        <span class="text-xs uppercase tracking-wider">
                          Initiative
                        </span>
                      </div>
                      <div class="text-2xl font-bold text-white">
                        {char().initiative >= 0 ? "+" : ""}
                        {char().initiative}
                      </div>
                    </div>

                    {/* Speed */}
                    <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div class="flex items-center gap-2 text-green-400 mb-2">
                        <Footprints class="w-4 h-4" />
                        <span class="text-xs uppercase tracking-wider">
                          {t("characterView.speed")}
                        </span>
                      </div>
                      <div class="text-2xl font-bold text-white">
                        {char().speed}
                        <span class="text-slate-500 text-sm ml-1">ft</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ability Scores Section */}
              <div class="mt-6 bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                <h2 class="font-display text-xl text-white mb-4">
                  {t("characterView.abilities")}
                </h2>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  <For each={abilities()}>
                    {(ability) => (
                      <div class="bg-white/5 rounded-xl p-3 border border-white/5 text-center hover:bg-white/10 transition-colors">
                        <div class="text-xs text-slate-400 uppercase tracking-wider mb-1">
                          {ability.abbr}
                        </div>
                        <div class="text-2xl font-bold text-white">
                          {ability.value}
                        </div>
                        <div
                          class={`text-sm font-medium ${
                            getAbilityModifier(ability.value) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatModifier(ability.value)}
                        </div>
                        <div class="text-xs text-slate-500 mt-1 hidden sm:block">
                          {ability.name}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Tab switcher */}
              <div class="mt-6 flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab("traits")}
                  class={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab() === "traits"
                      ? "bg-gradient-to-r from-purple-600/80 to-indigo-600/80 text-white shadow-lg shadow-purple-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon icon="game-icons:crossed-swords" width="1.2em" height="1.2em" />
                  {t("characterView.tabs.traits")}
                </button>
                <button
                  onClick={() => setActiveTab("inventory")}
                  class={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab() === "inventory"
                      ? "bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white shadow-lg shadow-amber-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon icon="game-icons:knapsack" width="1.2em" height="1.2em" />
                  {t("characterView.tabs.inventory")}
                </button>
              </div>

              <Show when={activeTab() === "inventory"}>
                <div class="mt-4 space-y-4">
                  <WalletPanel characterId={char().id} isMJ={isDmInActiveSession()} />
                  <InventoryPanel characterId={char().id} isMJ={isDmInActiveSession()} />
                </div>
              </Show>

              <Show when={activeTab() === "traits"}>
              {/* Quick Info Cards */}
              <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class Features Placeholder */}
                <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h2 class="font-display text-lg text-white mb-3">
                    {t("characterView.classTraits")}
                  </h2>
                  <div class="space-y-2 text-sm text-slate-300">
                    <div class="flex items-start gap-2">
                      <span class="text-purple-400">•</span>
                      <span>Attaque sournoise (3d6)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-purple-400">•</span>
                      <span>Cunning Action (Disengage, Dash, Hide)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-purple-400">•</span>
                      <span>Esquive instinctive</span>
                    </div>
                  </div>
                </div>

                {/* Race Features Placeholder */}
                <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h2 class="font-display text-lg text-white mb-3">
                    {t("characterView.racialTraits")}
                  </h2>
                  <div class="space-y-2 text-sm text-slate-300">
                    <div class="flex items-start gap-2">
                      <span class="text-amber-400">•</span>
                      <span>Vision dans le noir (18 m)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-amber-400">•</span>
                      <span>Keen Senses (Perception)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-amber-400">•</span>
                      <span>Fey Ancestry (charm resistance)</span>
                    </div>
                  </div>
                </div>
              </div>
              </Show>

              {/* Actions */}
              <div class="mt-6 flex flex-col sm:flex-row gap-4">
                <button
                  class="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg hover:shadow-purple-500/25"
                  onClick={() => navigate("/practice")}
                >
                  <Swords class="w-4 h-4 inline-block mr-1.5" />
                  {t("characterView.launchCombat")}
                </button>
                <button
                  class="flex-1 py-3 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all"
                  onClick={() => navigate("/characters")}
                >
                  <ArrowLeft class="w-4 h-4 inline-block mr-1.5" />
                  {t("characterView.backToCharacters")}
                </button>
              </div>
            </main>
          )}
        </Show>
      </Show>

      {/* Error Toast */}
      <Show when={error()}>
        <div class="fixed bottom-4 right-4 z-50 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-lg">
          {error()}
          <button
            onClick={() => setError(null)}
            class="ml-4 text-white/80 hover:text-white"
            aria-label={t("common.close")}
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </Show>
    </div>
  );
}
