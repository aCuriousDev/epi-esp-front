import { A, useParams, useNavigate } from "@solidjs/router";
import { ArrowLeft, Heart, Shield, Zap, Footprints, Edit3, Trash2 } from "lucide-solid";
import { createSignal, onMount, Show, For } from "solid-js";
import {
  Character,
  CharacterClass,
  CharacterRace,
  AbilityScores,
  formatModifier,
  getAbilityModifier,
} from "../types/character";

// Import class portraits
import barbarianImg from "../assets/classes/barbarian.png";
import bardImg from "../assets/classes/bard.png";
import clericImg from "../assets/classes/cleric.png";
import druidImg from "../assets/classes/druid.png";
import fighterImg from "../assets/classes/fighter.png";
import monkImg from "../assets/classes/monk.png";
import paladinImg from "../assets/classes/paladin.png";
import rangerImg from "../assets/classes/ranger.png";
import rogueImg from "../assets/classes/rogue.png";
import sorcererImg from "../assets/classes/sorcerer.png";
import warlockImg from "../assets/classes/warlock.png";
import wizardImg from "../assets/classes/wizard.png";

const classPortraits: Record<CharacterClass, string> = {
  [CharacterClass.Barbare]: barbarianImg,
  [CharacterClass.Barde]: bardImg,
  [CharacterClass.Clerc]: clericImg,
  [CharacterClass.Druide]: druidImg,
  [CharacterClass.Guerrier]: fighterImg,
  [CharacterClass.Moine]: monkImg,
  [CharacterClass.Paladin]: paladinImg,
  [CharacterClass.Rodeur]: rangerImg,
  [CharacterClass.Voleur]: rogueImg,
  [CharacterClass.Ensorceleur]: sorcererImg,
  [CharacterClass.Sorcier]: warlockImg,
  [CharacterClass.Magicien]: wizardImg,
};

// Mock data for demonstration - will be replaced with API call
const mockCharacter: Character = {
  id: "1",
  name: "Aria Sombrelame",
  level: 5,
  characterClass: CharacterClass.Voleur,
  race: CharacterRace.Elfe,
  abilities: {
    strength: 10,
    dexterity: 18,
    constitution: 14,
    intelligence: 12,
    wisdom: 13,
    charisma: 15,
  },
  maxHitPoints: 38,
  currentHitPoints: 32,
  armorClass: 15,
  speed: 30,
  initiative: 4,
  campaign: { title: "La quête d'Asteria" },
  createdAt: "2025-01-15",
};

export default function CharacterView() {
  const params = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = createSignal<Character | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    // TODO: Fetch character from API using params.id
    // For now, use mock data
    setTimeout(() => {
      setCharacter(mockCharacter);
      setLoading(false);
    }, 300);
  });

  const getPortrait = () => {
    const char = character();
    if (!char) return fighterImg;
    return char.portraitUrl || classPortraits[char.characterClass] || fighterImg;
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

  const abilities = () => {
    const char = character();
    if (!char) return [];
    return [
      { name: "Force", abbr: "FOR", value: char.abilities.strength },
      { name: "Dextérité", abbr: "DEX", value: char.abilities.dexterity },
      { name: "Constitution", abbr: "CON", value: char.abilities.constitution },
      { name: "Intelligence", abbr: "INT", value: char.abilities.intelligence },
      { name: "Sagesse", abbr: "SAG", value: char.abilities.wisdom },
      { name: "Charisme", abbr: "CHA", value: char.abilities.charisma },
    ];
  };

  return (
    <div class="relative min-h-screen w-full overflow-y-auto bg-brand-gradient">
      <div class="vignette absolute inset-0 pointer-events-none" />

      {/* Back button */}
      <A href="/characters" class="settings-btn !left-4 !right-auto" aria-label="Retour">
        <ArrowLeft class="settings-icon h-5 w-5" />
      </A>

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
            <main class="relative z-10 max-w-4xl mx-auto p-6 pt-20 pb-12">
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
                      <div class="w-32 h-32 rounded-2xl overflow-hidden border-4 border-game-dark/60 shadow-xl bg-game-darker">
                        <img
                          src={getPortrait()}
                          alt={char().name}
                          class="w-full h-full object-cover"
                        />
                      </div>
                      {/* Level badge */}
                      <div class="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center border-2 border-game-dark shadow-lg">
                        <span class="text-sm font-bold text-white">{char().level}</span>
                      </div>
                    </div>

                    {/* Name and Class */}
                    <div class="flex-1 pt-4 sm:pt-8">
                      <h1 class="font-display text-3xl sm:text-4xl text-white">
                        {char().name}
                      </h1>
                      <p class="text-slate-300 mt-1">
                        <span class="text-purple-400">{char().race}</span>
                        {" • "}
                        <span class="text-amber-400">{char().characterClass}</span>
                        {" • "}
                        <span class="text-slate-400">Niveau {char().level}</span>
                      </p>
                      <Show when={char().campaign}>
                        <p class="text-slate-400 text-sm mt-2">
                          📜 {char().campaign!.title}
                        </p>
                      </Show>
                    </div>

                    {/* Action buttons */}
                    <div class="flex gap-2 pt-4 sm:pt-8">
                      <button
                        class="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        title="Modifier"
                      >
                        <Edit3 class="w-5 h-5 text-slate-300" />
                      </button>
                      <button
                        class="p-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 class="w-5 h-5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats Bar */}
                <div class="px-6 py-6 mt-4">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* HP */}
                    <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div class="flex items-center gap-2 text-red-400 mb-2">
                        <Heart class="w-4 h-4" />
                        <span class="text-xs uppercase tracking-wider">Points de vie</span>
                      </div>
                      <div class="text-2xl font-bold text-white">
                        {char().currentHitPoints}
                        <span class="text-slate-500 text-lg">/{char().maxHitPoints}</span>
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
                        <span class="text-xs uppercase tracking-wider">Classe d'armure</span>
                      </div>
                      <div class="text-2xl font-bold text-white">{char().armorClass}</div>
                    </div>

                    {/* Initiative */}
                    <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div class="flex items-center gap-2 text-yellow-400 mb-2">
                        <Zap class="w-4 h-4" />
                        <span class="text-xs uppercase tracking-wider">Initiative</span>
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
                        <span class="text-xs uppercase tracking-wider">Vitesse</span>
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
                <h2 class="font-display text-xl text-white mb-4">Caractéristiques</h2>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  <For each={abilities()}>
                    {(ability) => (
                      <div class="bg-white/5 rounded-xl p-3 border border-white/5 text-center hover:bg-white/10 transition-colors">
                        <div class="text-xs text-slate-400 uppercase tracking-wider mb-1">
                          {ability.abbr}
                        </div>
                        <div class="text-2xl font-bold text-white">{ability.value}</div>
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

              {/* Quick Info Cards */}
              <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class Features Placeholder */}
                <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h2 class="font-display text-lg text-white mb-3">Traits de classe</h2>
                  <div class="space-y-2 text-sm text-slate-300">
                    <div class="flex items-start gap-2">
                      <span class="text-purple-400">•</span>
                      <span>Attaque sournoise (3d6)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-purple-400">•</span>
                      <span>Ruse (Désengagement, Repli, Se cacher)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-purple-400">•</span>
                      <span>Esquive instinctive</span>
                    </div>
                  </div>
                </div>

                {/* Race Features Placeholder */}
                <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <h2 class="font-display text-lg text-white mb-3">Traits raciaux</h2>
                  <div class="space-y-2 text-sm text-slate-300">
                    <div class="flex items-start gap-2">
                      <span class="text-amber-400">•</span>
                      <span>Vision dans le noir (18 m)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-amber-400">•</span>
                      <span>Sens aiguisés (Perception)</span>
                    </div>
                    <div class="flex items-start gap-2">
                      <span class="text-amber-400">•</span>
                      <span>Ascendance féerique (résistance charme)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div class="mt-6 flex flex-col sm:flex-row gap-4">
                <button
                  class="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg hover:shadow-purple-500/25"
                  onClick={() => navigate("/board")}
                >
                  ⚔️ Lancer en combat
                </button>
                <button
                  class="flex-1 py-3 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all"
                  onClick={() => navigate("/characters")}
                >
                  ← Retour aux personnages
                </button>
              </div>
            </main>
          )}
        </Show>
      </Show>
    </div>
  );
}

