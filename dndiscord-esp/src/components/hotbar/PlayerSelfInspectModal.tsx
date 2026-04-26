import {
  Component,
  Show,
  For,
  createSignal,
  createEffect,
  on,
} from "solid-js";
import {
  Heart,
  Shield,
  Swords,
  Zap,
  Footprints,
  TrendingUp,
  Sparkles,
  BookOpen,
  Gauge,
} from "lucide-solid";
import { HotbarModal } from "./HotbarModal";
import {
  CharacterService,
  type CharacterDto,
} from "../../services/character.service";
import { GetCharacterProfilPic } from "../../utils/characterProfilPic";
import type { Unit } from "../../types";

interface PlayerSelfInspectModalProps {
  open: boolean;
  onClose: () => void;
  /** In-game unit. Optional — when absent (e.g. opened from the lobby) the
   *  modal renders character-only data and skips live PV/PA bars. */
  unit?: Unit | null;
  characterId: string | null;
  /** Override the modal title (defaults to "Character sheet"). */
  title?: string;
  /** Fallback display name when no character/unit data is loaded yet. */
  fallbackName?: string;
}

/**
 * Read-only character sheet. Two render modes:
 *  - In-game (unit present): live PV/PA bars + combat grid sourced from the
 *    Unit, plus character-derived ability scores and traits.
 *  - Lobby (unit absent): static stats sourced from the CharacterDto only —
 *    max HP, AC, initiative, speed, abilities, traits.
 *
 * No actions: HP adjust, item grants, level-ups stay in DmPlayerInspectPanel.
 */
export const PlayerSelfInspectModal: Component<PlayerSelfInspectModalProps> = (
  props,
) => {
  const [character, setCharacter] = createSignal<CharacterDto | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(
    on(
      () => [props.open, props.characterId] as const,
      async ([open, charId]) => {
        if (!open || !charId) {
          setCharacter(null);
          setError(null);
          return;
        }
        setLoading(true);
        setError(null);
        try {
          const data = await CharacterService.getCharacter(charId);
          setCharacter(data);
        } catch (err) {
          console.error("[Self Inspect] Load character failed:", err);
          setError("Unable to load character sheet.");
          setCharacter(null);
        } finally {
          setLoading(false);
        }
      },
    ),
  );

  const hasUnit = () => !!props.unit;
  const hasContent = () => hasUnit() || !!character() || loading();

  return (
    <HotbarModal
      open={props.open}
      title={props.title ?? "Character sheet"}
      onClose={props.onClose}
      widthClass="max-w-2xl"
    >
      <Show when={hasContent()} fallback={<EmptyState />}>
        <div class="space-y-4">
          {/* Header — portrait + identity */}
          <div class="flex items-center gap-3">
            <Show
              when={character()}
              fallback={
                <div class="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-700/40 border-2 border-amber-400/60" />
              }
            >
              <img
                src={GetCharacterProfilPic.getCharacterProfilPic(
                  character()!.class,
                )}
                alt={`${character()!.name} portrait`}
                class="w-16 h-16 rounded-lg object-contain border-2 border-amber-400/60 bg-black/30"
              />
            </Show>
            <div class="flex-1 min-w-0">
              <div class="text-base font-semibold text-white truncate">
                {character()?.name ?? props.unit?.name ?? props.fallbackName ?? "—"}
              </div>
              <Show when={character()}>
                <div class="text-[11px] text-purple-300/70 mt-0.5">
                  Level {character()!.level} · {character()!.class} ·{" "}
                  {character()!.race}
                </div>
              </Show>
            </div>
          </div>

          <Show when={loading()}>
            <div class="flex justify-center py-3">
              <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={error()}>
            <p class="text-[11px] text-red-300/80 text-center py-2">
              {error()}
            </p>
          </Show>

          {/* Vitals — in-game variant: live PV + PA bars */}
          <Show when={props.unit}>
            {(u) => {
              const s = () => u().stats;
              const hpPct = () =>
                s().maxHealth > 0
                  ? Math.round((s().currentHealth / s().maxHealth) * 100)
                  : 0;
              const apPct = () =>
                s().maxActionPoints > 0
                  ? Math.round(
                      (s().currentActionPoints / s().maxActionPoints) * 100,
                    )
                  : 0;
              return (
                <>
                  <div class="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                    <div>
                      <div class="flex items-center justify-between text-[11px] mb-1">
                        <span class="flex items-center gap-1 text-red-300">
                          <Heart class="w-3.5 h-3.5" /> HP
                        </span>
                        <span class="font-mono text-white/85">
                          {s().currentHealth}/{s().maxHealth}
                        </span>
                      </div>
                      <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          class="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all"
                          style={{ width: `${hpPct()}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div class="flex items-center justify-between text-[11px] mb-1">
                        <span class="flex items-center gap-1 text-amber-300">
                          <Zap class="w-3.5 h-3.5" /> AP
                        </span>
                        <span class="font-mono text-white/85">
                          {s().currentActionPoints}/{s().maxActionPoints}
                        </span>
                      </div>
                      <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          class="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all"
                          style={{ width: `${apPct()}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-1.5">
                    <StatRow
                      icon={<Swords class="w-3.5 h-3.5 text-orange-300" />}
                      label="Attack"
                      value={s().attackDamage}
                    />
                    <StatRow
                      icon={<Shield class="w-3.5 h-3.5 text-sky-300" />}
                      label="Defense"
                      value={s().defense}
                    />
                    <StatRow
                      icon={<Footprints class="w-3.5 h-3.5 text-emerald-300" />}
                      label="Movement"
                      value={s().movementRange}
                    />
                    <StatRow
                      icon={<Swords class="w-3.5 h-3.5 text-purple-300" />}
                      label="Range"
                      value={s().attackRange}
                    />
                  </div>
                </>
              );
            }}
          </Show>

          {/* Lobby variant: static stats from CharacterDto */}
          <Show when={!hasUnit() && character()}>
            {(c) => (
              <div class="grid grid-cols-2 gap-1.5">
                <StatRow
                  icon={<Heart class="w-3.5 h-3.5 text-red-300" />}
                  label="Max HP"
                  value={c().maxHitPoints}
                />
                <StatRow
                  icon={<Shield class="w-3.5 h-3.5 text-sky-300" />}
                  label="Armor Class"
                  value={c().armorClass}
                />
                <StatRow
                  icon={<Zap class="w-3.5 h-3.5 text-amber-300" />}
                  label="Initiative"
                  value={c().initiative}
                />
                <StatRow
                  icon={<Gauge class="w-3.5 h-3.5 text-emerald-300" />}
                  label="Speed"
                  value={c().speed}
                />
              </div>
            )}
          </Show>

          {/* Abilities + traits — character-only sections */}
          <Show when={character()}>
            {(c) => (
              <>
                <div class="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-purple-200/80 flex items-center gap-1">
                      <TrendingUp class="w-3.5 h-3.5" /> Progression
                    </span>
                    <span class="text-white/85 font-mono">
                      XP {c().experiencePoints ?? 0}
                    </span>
                  </div>
                  <div class="grid grid-cols-6 gap-1">
                    <AbilityCell label="STR" value={c().abilities.strength} />
                    <AbilityCell label="DEX" value={c().abilities.dexterity} />
                    <AbilityCell label="CON" value={c().abilities.constitution} />
                    <AbilityCell label="INT" value={c().abilities.intelligence} />
                    <AbilityCell label="WIS" value={c().abilities.wisdom} />
                    <AbilityCell label="CHA" value={c().abilities.charisma} />
                  </div>
                </div>

                <Show when={c().raceTraits}>
                  <details
                    class="rounded-lg border border-white/10 bg-black/20 p-2"
                    open
                  >
                    <summary class="text-[11px] font-semibold text-emerald-200 cursor-pointer flex items-center gap-1.5">
                      <Sparkles class="w-3.5 h-3.5" /> Race traits ({c().race})
                    </summary>
                    <div class="mt-2 text-[10px] text-white/75 space-y-1">
                      <p>
                        Base speed:{" "}
                        <span class="font-mono text-white/90">
                          {c().raceTraits.baseSpeed}
                        </span>
                      </p>
                      <Show when={c().raceTraits.specialAbilities?.length}>
                        <ul class="list-disc list-inside space-y-0.5 text-emerald-100/80">
                          <For each={c().raceTraits.specialAbilities}>
                            {(ab) => <li>{ab}</li>}
                          </For>
                        </ul>
                      </Show>
                    </div>
                  </details>
                </Show>

                <Show when={c().classTraits}>
                  <details
                    class="rounded-lg border border-white/10 bg-black/20 p-2"
                    open
                  >
                    <summary class="text-[11px] font-semibold text-sky-200 cursor-pointer flex items-center gap-1.5">
                      <BookOpen class="w-3.5 h-3.5" /> Class traits ({c().class})
                    </summary>
                    <div class="mt-2 text-[10px] text-white/75 space-y-1">
                      <p>
                        Main ability:{" "}
                        <span class="font-mono text-white/90">
                          {c().classTraits.mainCharacteristic}
                        </span>
                      </p>
                      <p>
                        Hit die:{" "}
                        <span class="font-mono text-white/90">
                          {c().classTraits.hitDie}
                        </span>{" "}
                        · Spellcaster:{" "}
                        <span class="font-mono text-white/90">
                          {c().classTraits.isSpellcaster ? "yes" : "no"}
                        </span>
                      </p>
                      <Show when={c().classTraits.savingThrows?.length}>
                        <p>
                          Saving throws:{" "}
                          <span class="text-white/85">
                            {c().classTraits.savingThrows.join(", ")}
                          </span>
                        </p>
                      </Show>
                      <Show when={c().classTraits.proficiencies?.length}>
                        <p>
                          Proficiencies:{" "}
                          <span class="text-white/85">
                            {c().classTraits.proficiencies.join(", ")}
                          </span>
                        </p>
                      </Show>
                      <Show when={c().classTraits.specialFeatures?.length}>
                        <ul class="list-disc list-inside space-y-0.5 text-sky-100/80 mt-1">
                          <For each={c().classTraits.specialFeatures}>
                            {(f) => <li>{f}</li>}
                          </For>
                        </ul>
                      </Show>
                    </div>
                  </details>
                </Show>
              </>
            )}
          </Show>

          <p class="text-[9px] text-purple-300/40 text-center">
            <Show when={hasUnit()} fallback="Read-only character sheet.">
              Read-only. Inventory and wallet via the action bar buttons.
            </Show>
          </p>
        </div>
      </Show>
    </HotbarModal>
  );
};

function EmptyState() {
  return (
    <p class="text-[11px] text-purple-300/60 text-center py-6">
      No active character.
    </p>
  );
}

function StatRow(props: { icon: any; label: string; value: number }) {
  return (
    <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/5">
      {props.icon}
      <span class="text-[10px] text-white/55 flex-1">{props.label}</span>
      <span class="text-[11px] text-white/85 font-mono font-semibold">
        {props.value}
      </span>
    </div>
  );
}

function AbilityCell(props: { label: string; value: number }) {
  return (
    <div class="rounded-md border border-white/10 bg-black/20 px-1.5 py-1 text-center">
      <div class="text-[9px] text-purple-300/55">{props.label}</div>
      <div class="text-[11px] text-white/90 font-semibold">{props.value}</div>
    </div>
  );
}
