/**
 * DmPanel — Dungeon Master toolkit: move tokens, spawn enemies, hidden dice.
 * Cleaner / lighter design. Move & spawn interact directly with the 3D map.
 * Item management is handled via DmPlayerInspectPanel when clicking player units.
 */

import {
  Component,
  Show,
  For,
  createSignal,
  createEffect,
  onCleanup,
} from "solid-js";
import {
  Crown,
  Dices,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Swords,
  X,
} from "lucide-solid";
import { isDm, getOtherPlayers, getCurrentSession } from "../../stores/session.store";
import {
  dmToolsState,
  dmDragUnit,
  setDmDragUnit,
  dmSpawnTemplate,
  setDmSpawnTemplate,
  setDmActiveMode,
  addSpawnedEnemy,
} from "../../stores/dmTools.store";
import {
  dmHiddenRoll,
  dmSpawnUnit,
  dmStartCombat,
  dmSwitchMap,
} from "../../services/signalr/multiplayer.service";
import { MapService, type CampaignMapRecord } from "../../services/map.service";
import { units, addUnit } from "../../game/stores/UnitsStore";
import { setTiles, updatePathfinder } from "../../game/stores/TilesStore";
import { addCombatLog, gameState } from "../../game/stores/GameStateStore";
import { posToKey } from "../../game/utils/GridUtils";
import { UnitType, Team, GamePhase } from "../../types";
import type { Unit, GridPosition } from "../../types";
import { ENEMY_ABILITIES, cloneAbilities } from "../../game/abilities/AbilityDefinitions";

// ─── Enemy Templates ───────────────────────────────────────────────

interface EnemyTemplate { id: string; name: string; icon: string; unitType: UnitType; stats: Unit["stats"]; }

const ENEMY_CATALOGUE: EnemyTemplate[] = [
  { id: "skeleton_warrior", name: "Squelette", icon: "💀", unitType: UnitType.ENEMY_SKELETON,
    stats: { maxHealth: 60, currentHealth: 60, maxActionPoints: 5, currentActionPoints: 5, movementRange: 3, attackRange: 1, attackDamage: 12, defense: 5, initiative: 10 } },
  { id: "skeleton_archer", name: "Squelette Arc", icon: "🏹", unitType: UnitType.ENEMY_SKELETON,
    stats: { maxHealth: 50, currentHealth: 50, maxActionPoints: 5, currentActionPoints: 5, movementRange: 2, attackRange: 4, attackDamage: 10, defense: 3, initiative: 14 } },
  { id: "skeleton_mage", name: "Nécromancien", icon: "🔮", unitType: UnitType.ENEMY_MAGE,
    stats: { maxHealth: 70, currentHealth: 70, maxActionPoints: 6, currentActionPoints: 6, movementRange: 2, attackRange: 5, attackDamage: 16, defense: 5, initiative: 12 } },
  { id: "skeleton_boss", name: "Boss Mort-vivant", icon: "👹", unitType: UnitType.ENEMY_SKELETON,
    stats: { maxHealth: 120, currentHealth: 120, maxActionPoints: 7, currentActionPoints: 7, movementRange: 4, attackRange: 2, attackDamage: 22, defense: 10, initiative: 16 } },
];

// ═══════════════════════════════════════════════════════════════════

export const DmPanel: Component = () => {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal<"move" | "roll" | "spawn" | "maps">("move");

  // Dice
  const [diceType, setDiceType] = createSignal(20);
  const [diceModifier, setDiceModifier] = createSignal(0);
  const [diceLabel, setDiceLabel] = createSignal("");
  const [isRolling, setIsRolling] = createSignal(false);

  // Maps
  const [campaignMaps, setCampaignMaps] = createSignal<CampaignMapRecord[]>([]);
  const [mapsLoading, setMapsLoading] = createSignal(false);
  const [mapsLoaded, setMapsLoaded] = createSignal(false);
  const [switchingMapId, setSwitchingMapId] = createSignal<string | null>(null);

  // Status messages
  const [statusMsg, setStatusMsg] = createSignal<string | null>(null);

  if (!isDm()) return null;

  const selectedUnit = () => {
    const id = dmDragUnit();
    return id ? units[id] : null;
  };
  const players = () => getOtherPlayers();

  // ── Keep dmActiveMode in sync with activeTab ──
  createEffect(() => {
    const tab = activeTab();
    if (tab === "move") setDmActiveMode("move");
    else if (tab === "spawn") setDmActiveMode("spawn");
    else setDmActiveMode(null);
  });

  // ── Spawn: listen for tile clicks ──
  createEffect(() => {
    const tplId = dmSpawnTemplate();
    if (!tplId) return;

    const handler = (e: Event) => {
      const pos = (e as CustomEvent<GridPosition>).detail;
      if (!pos) return;
      const tpl = ENEMY_CATALOGUE.find((t) => t.id === tplId);
      if (!tpl) return;

      // crypto.randomUUID() is CSP-safe and collision-free across concurrent
      // DMs; the previous module-local counter reused ids across browser
      // tabs which caused duplicate-spawn races.
      const uid = `dm_spawn_${tpl.id}_${crypto.randomUUID()}`;
      const unit: Unit = {
        id: uid, name: tpl.name, type: tpl.unitType, team: Team.ENEMY, position: pos,
        stats: { ...tpl.stats }, abilities: cloneAbilities(ENEMY_ABILITIES),
        statusEffects: [], isAlive: true, hasActed: false, hasMoved: false,
      };

      // Optimistic local add for the DM (gameSync skips the DM on the
      // DmUnitSpawned broadcast via isHost()). The `units[uid]` guard in
      // gameSync still protects against duplicate delivery on other clients.
      addUnit(unit);
      setTiles(posToKey(pos), "occupiedBy", uid);
      updatePathfinder();
      addCombatLog(`[MJ] ${tpl.name} invoqué (${pos.x},${pos.z})`, "system");
      addSpawnedEnemy({ name: tpl.name, x: pos.x, z: pos.z });

      const session = getCurrentSession();
      if (session) {
        dmSpawnUnit({
          unitId: uid, templateId: tpl.id, name: tpl.name, unitType: tpl.unitType,
          target: { x: pos.x, y: pos.z } as any, statsJson: JSON.stringify(tpl.stats),
        }).catch((err: any) => console.warn("[DM] spawn broadcast failed:", err));
      }

      flash(`${tpl.icon} ${tpl.name} invoqué`);
    };

    window.addEventListener("dm-tile-click", handler);
    onCleanup(() => window.removeEventListener("dm-tile-click", handler));
  });

  // ── Watch drag completion ──
  createEffect(() => {
    const id = dmDragUnit();
    // Selection changed — nothing special to show
    if (id) return; // unit selected, waiting for tile click
  });

  const flash = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2000);
  };

  // ── Handlers ──
  const handleHiddenRoll = async () => {
    setIsRolling(true);
    try {
      await dmHiddenRoll(diceType(), diceModifier(), diceLabel() || undefined);
    } catch (e: any) { console.error("Hidden roll failed:", e); }
    finally { setIsRolling(false); }
  };

  const toggleSpawnMode = (tplId: string) => {
    if (dmSpawnTemplate() === tplId) { setDmSpawnTemplate(null); }
    else { setDmSpawnTemplate(tplId); setDmDragUnit(null); }
  };

  const switchTab = (tab: "move" | "roll" | "spawn" | "maps") => {
    setActiveTab(tab);
    setDmDragUnit(null);
    setDmSpawnTemplate(null);
    setStatusMsg(null);
  };

  const loadMapsIfNeeded = async () => {
    const session = getCurrentSession();
    if (!session?.campaignId) return;
    if (mapsLoaded() || mapsLoading()) return;
    setMapsLoading(true);
    try {
      const maps = await MapService.list(session.campaignId);
      setCampaignMaps(maps);
      setMapsLoaded(true);
    } catch (e) {
      console.warn("[DmPanel] failed to load campaign maps", e);
      flash("Impossible de charger les cartes");
    } finally {
      setMapsLoading(false);
    }
  };

  const handleSwitchMap = async (mapId: string) => {
    if (switchingMapId()) return;
    setSwitchingMapId(mapId);
    try {
      await dmSwitchMap(mapId);
      flash("🗺️ Changement de carte en cours…");
    } catch (e) {
      console.warn("[DmPanel] dmSwitchMap failed", e);
      flash("Échec : impossible de changer de carte");
    } finally {
      setSwitchingMapId(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <Show when={isDm()}>
      <div class="dm-panel">
        {/* Header */}
        <button class="w-full flex items-center justify-between group cursor-pointer" onClick={() => setIsExpanded((v) => !v)}>
          <div class="flex items-center gap-2">
            <Crown class="w-4 h-4 text-purple-300" />
            <span class="text-xs font-semibold text-purple-200 tracking-wide">Maître du Jeu</span>
          </div>
          <Show when={isExpanded()} fallback={<ChevronDown class="w-3.5 h-3.5 text-purple-400/60" />}>
            <ChevronUp class="w-3.5 h-3.5 text-purple-400/60" />
          </Show>
        </button>

        <Show when={isExpanded()}>
          {/* Prominent combat trigger — only surfaced while the session is still
              in free roam. Once triggered the backend broadcasts CombatStarted and
              every client flips to COMBAT_PREPARATION; the button falls away. */}
          <Show when={gameState.phase === GamePhase.FREE_ROAM}>
            <button
              onClick={async () => {
                try {
                  await dmStartCombat();
                  flash("⚔️ Combat déclenché");
                } catch (err) {
                  console.warn("[DmPanel] dmStartCombat failed", err);
                  flash("Échec : impossible de lancer le combat");
                }
              }}
              class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-red-600/80 to-rose-600/80 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold border border-red-400/40 shadow-lg transition-colors cursor-pointer"
              title="Démarrer la phase de combat — tous les joueurs passent en préparation"
            >
              <Swords class="w-3.5 h-3.5" />
              Démarrer combat
            </button>
          </Show>

          {/* Tabs */}
          <div class="flex gap-0.5 mt-2">
            <DmTab active={activeTab() === "move"} onClick={() => switchTab("move")} label="Déplacer" />
            <DmTab active={activeTab() === "spawn"} onClick={() => switchTab("spawn")} label="Invoquer" />
            <DmTab active={activeTab() === "roll"} onClick={() => switchTab("roll")} label="Dés" />
            <Show when={getCurrentSession()?.campaignId}>
              <DmTab active={activeTab() === "maps"} onClick={() => { switchTab("maps"); void loadMapsIfNeeded(); }} label="Cartes" />
            </Show>
          </div>

          {/* Status flash */}
          <Show when={statusMsg()}>
            <p class="text-[10px] text-center text-emerald-300/80 mt-1.5">{statusMsg()}</p>
          </Show>

          {/* ── MOVE TAB ── */}
          <Show when={activeTab() === "move"}>
            <div class="mt-2 space-y-1.5">
              <Show when={selectedUnit()} fallback={
                <p class="text-[10px] text-purple-300/50 text-center py-2">
                  Cliquez sur un personnage sur la carte pour le sélectionner, puis cliquez sur une case pour le déplacer.
                </p>
              }>
                {(unit) => (
                  <div class="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-purple-500/15 border border-purple-500/25">
                    <span class={`w-2 h-2 rounded-full ${unit().team === Team.PLAYER ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span class="text-xs text-white/90 flex-1 truncate">{unit().name}</span>
                    <span class="text-[10px] text-purple-300/60 font-mono">{unit().position.x},{unit().position.z}</span>
                    <button class="text-purple-400/50 hover:text-white transition-colors" onClick={() => setDmDragUnit(null)}>
                      <X class="w-3 h-3" />
                    </button>
                  </div>
                )}
              </Show>
              <p class="text-[10px] text-purple-300/50 text-center">
                {selectedUnit() ? "Cliquez n'importe où sur la carte" : "Mode déplacement actif"}
              </p>
            </div>
          </Show>

          {/* ── SPAWN TAB ── */}
          <Show when={activeTab() === "spawn"}>
            <div class="mt-2 space-y-1">
              <div class="grid grid-cols-2 gap-1">
                <For each={ENEMY_CATALOGUE}>
                  {(tpl) => {
                    const isActive = () => dmSpawnTemplate() === tpl.id;
                    return (
                      <button
                        class={`dm-spawn-card ${isActive() ? "dm-spawn-card--active" : ""}`}
                        onClick={() => toggleSpawnMode(tpl.id)}
                      >
                        <span class="text-sm">{tpl.icon}</span>
                        <span class="text-[10px] text-white/80">{tpl.name}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
              <Show when={dmSpawnTemplate()}>
                <p class="text-[10px] text-purple-300/50 text-center">Cliquez sur la carte pour placer · re-cliquez le monstre pour annuler</p>
              </Show>
            </div>
          </Show>

          {/* ── DICE TAB ── */}
          <Show when={activeTab() === "roll"}>
            <div class="mt-2 space-y-1.5">
              <div class="flex gap-1.5">
                <select class="dm-input flex-1" value={diceType()} onChange={(e) => setDiceType(parseInt(e.currentTarget.value))}>
                  <For each={[4, 6, 8, 10, 12, 20, 100]}>{(d) => <option value={d}>d{d}</option>}</For>
                </select>
                <input type="number" class="dm-input w-14" placeholder="+/-" value={diceModifier()}
                  onInput={(e) => setDiceModifier(parseInt(e.currentTarget.value) || 0)} />
              </div>
              <input type="text" placeholder="Note..." class="dm-input w-full" value={diceLabel()} onInput={(e) => setDiceLabel(e.currentTarget.value)} />
              <button class="dm-btn w-full" disabled={isRolling()} onClick={handleHiddenRoll}>
                <Dices class="w-3 h-3" />
                {isRolling() ? "..." : `d${diceType()} secret`}
              </button>

              <Show when={dmToolsState.hiddenRolls.length > 0}>
                <div class="space-y-0.5 max-h-24 overflow-y-auto mt-1">
                  <For each={[...dmToolsState.hiddenRolls].reverse().slice(0, 5)}>
                    {(roll) => (
                      <div class="flex items-center gap-1 text-[10px] text-purple-300/60">
                        <span class="text-purple-300 font-mono">d{roll.diceType}</span>
                        <span class="text-white/80">{roll.result}</span>
                        {roll.modifier !== 0 && <span class="text-purple-400/70">{roll.modifier > 0 ? "+" : ""}{roll.modifier}</span>}
                        <span class="text-purple-200 font-semibold">={roll.total}</span>
                        <Show when={roll.label}><span class="text-purple-400/40 truncate ml-auto">{roll.label}</span></Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* ── MAPS TAB ── DM-only scene switcher pulling from persisted maps */}
          <Show when={activeTab() === "maps"}>
            <div class="mt-2 space-y-1.5">
              <Show when={mapsLoading()}>
                <p class="text-[10px] text-purple-300/50 text-center py-2">Chargement…</p>
              </Show>
              <Show when={!mapsLoading() && mapsLoaded() && campaignMaps().length === 0}>
                <p class="text-[10px] text-purple-300/50 text-center py-2">
                  Aucune carte enregistrée pour cette campagne. Ouvrez l'éditeur pour en créer et enregistrez-les côté serveur.
                </p>
              </Show>
              <Show when={campaignMaps().length > 0}>
                <div class="space-y-1">
                  <For each={campaignMaps()}>
                    {(m) => {
                      const isSwitching = () => switchingMapId() === m.id;
                      return (
                        <button
                          onClick={() => handleSwitchMap(m.id)}
                          disabled={!!switchingMapId()}
                          class="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span class="text-xs text-white/90 truncate">{m.name}</span>
                          <span class="text-[10px] text-purple-300/60">
                            {isSwitching() ? "…" : "Charger"}
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
              <button
                onClick={() => { setMapsLoaded(false); void loadMapsIfNeeded(); }}
                class="text-[10px] text-purple-300/60 hover:text-purple-200 underline underline-offset-2"
              >
                Rafraîchir la liste
              </button>
            </div>
          </Show>

        </Show>
      </div>
    </Show>
  );
};

// ─── Tab ───────────────────────────────────────────────────────────

const DmTab: Component<{ active: boolean; onClick: () => void; label: string }> = (props) => (
  <button
    class={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
      props.active
        ? "bg-purple-500/20 text-purple-200 border border-purple-500/30"
        : "text-purple-400/50 hover:text-purple-300 border border-transparent hover:bg-purple-500/10"
    }`}
    onClick={props.onClick}
  >
    {props.label}
  </button>
);
