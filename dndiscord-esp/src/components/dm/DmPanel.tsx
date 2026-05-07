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
  ChevronRight,
} from "lucide-solid";
import { isDm, getOtherPlayers, getCurrentSession } from "../../stores/session.store";
import DiceRequestPanel from "./DiceRequestPanel";
import {
  dmToolsState,
  dmDragUnit,
  setDmDragUnit,
  dmSpawnTemplate,
  setDmSpawnTemplate,
  setDmActiveMode,
  addSpawnedEnemy,
  setAiAutoPlay,
} from "../../stores/dmTools.store";
import {
  dmHiddenRoll,
  dmSpawnUnit,
  dmStartCombat,
  dmEndCombat,
  dmSwitchMap,
} from "../../services/signalr/multiplayer.service";
import { MapService, type CampaignMapRecord } from "../../services/map.service";
import { getAllMaps, loadMap } from "../../services/mapStorage";
import { units, addUnit } from "../../game/stores/UnitsStore";
import { setTiles, updatePathfinder } from "../../game/stores/TilesStore";
import { addCombatLog, gameState } from "../../game/stores/GameStateStore";
import { posToKey } from "../../game/utils/GridUtils";
import { UnitType, Team, GamePhase } from "../../types";
import type { Unit, GridPosition } from "../../types";
import {
  cloneAbilities,
  SKELETON_WARRIOR_ABILITIES,
  SKELETON_MAGE_ABILITIES,
  SKELETON_ROGUE_ABILITIES,
  SKELETON_MINION_ABILITIES,
} from "../../game/abilities/AbilityDefinitions";
import type { Ability } from "../../types";

// ─── Enemy Templates ───────────────────────────────────────────────

interface EnemyTemplate {
  id: string;
  name: string;
  icon: string;
  unitType: UnitType;
  stats: Unit["stats"];
  abilities: Ability[];
}

const ENEMY_CATALOGUE: EnemyTemplate[] = [
  { id: "skeleton_warrior", name: "Skeleton", icon: "💀", unitType: UnitType.ENEMY_SKELETON,
    abilities: SKELETON_WARRIOR_ABILITIES,
    stats: { maxHealth: 60, currentHealth: 60, maxActionPoints: 5, currentActionPoints: 5, movementRange: 3, attackRange: 1, attackDamage: 12, defense: 5, initiative: 10 } },
  { id: "skeleton_rogue", name: "Skeleton Archer", icon: "🏹", unitType: UnitType.ENEMY_SKELETON_ROGUE,
    abilities: SKELETON_ROGUE_ABILITIES,
    stats: { maxHealth: 50, currentHealth: 50, maxActionPoints: 5, currentActionPoints: 5, movementRange: 2, attackRange: 4, attackDamage: 10, defense: 3, initiative: 14 } },
  { id: "skeleton_mage", name: "Necromancer", icon: "🔮", unitType: UnitType.ENEMY_MAGE,
    abilities: SKELETON_MAGE_ABILITIES,
    stats: { maxHealth: 70, currentHealth: 70, maxActionPoints: 6, currentActionPoints: 6, movementRange: 2, attackRange: 5, attackDamage: 16, defense: 5, initiative: 12 } },
  { id: "skeleton_minion", name: "Minion", icon: "🦴", unitType: UnitType.ENEMY_SKELETON_MINION,
    abilities: SKELETON_MINION_ABILITIES,
    stats: { maxHealth: 30, currentHealth: 30, maxActionPoints: 4, currentActionPoints: 4, movementRange: 3, attackRange: 1, attackDamage: 6, defense: 2, initiative: 8 } },
];

// ═══════════════════════════════════════════════════════════════════

interface DmPanelProps {
  /** Appelé quand le MJ veut passer au prochain nœud du scénario depuis le board.
   *  Défini uniquement en mode fromSession=1. */
  onNextNode?: () => void;
}

export const DmPanel: Component<DmPanelProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(true);
  // Default to "select": clicking a unit in this mode opens the inspect
  // panel via GameCanvas.handleUnitClick (BUG-D) without staging a drag or
  // enabling tile-click-to-move. Decouples selection from the move tool —
  // earlier "move" default meant every click risked a teleport. The DM now
  // switches to "Déplacer" explicitly when they want drag-to-move.
  const [activeTab, setActiveTab] = createSignal<"select" | "move" | "roll" | "dice-request" | "spawn" | "maps">("select");

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

      // crypto.randomUUID() n'est disponible qu'en contexte sécurisé (HTTPS).
      // Fallback pour HTTP (dev local, Discord Activity) : timestamp + random.
      const uuid = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      const uid = `dm_spawn_${tpl.id}_${uuid}`;
      const unit: Unit = {
        id: uid, name: tpl.name, type: tpl.unitType, team: Team.ENEMY, position: pos,
        stats: { ...tpl.stats }, abilities: cloneAbilities(tpl.abilities),
        statusEffects: [], isAlive: true, hasActed: false, hasMoved: false,
      };

      // Optimistic local add for the DM (gameSync skips the DM on the
      // DmUnitSpawned broadcast via isHost()). The `units[uid]` guard in
      // gameSync still protects against duplicate delivery on other clients.
      addUnit(unit);
      setTiles(posToKey(pos), "occupiedBy", uid);
      updatePathfinder();
      addCombatLog(`[DM] ${tpl.name} spawned (${pos.x},${pos.z})`, "system");
      addSpawnedEnemy({ name: tpl.name, x: pos.x, z: pos.z });

      const session = getCurrentSession();
      if (session) {
        dmSpawnUnit({
          unitId: uid, templateId: tpl.id, name: tpl.name, unitType: tpl.unitType,
          target: { x: pos.x, y: pos.z } as any, statsJson: JSON.stringify(tpl.stats),
        }).catch((err: any) => console.warn("[DM] spawn broadcast failed:", err));
      }

      flash(`${tpl.icon} ${tpl.name} spawned`);
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

  const switchTab = (tab: "select" | "move" | "roll" | "dice-request" | "spawn" | "maps") => {
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
      flash("Failed to load maps");
    } finally {
      setMapsLoading(false);
    }
  };

  const handleSwitchMap = async (mapId: string) => {
    if (switchingMapId()) return;
    setSwitchingMapId(mapId);
    try {
      await dmSwitchMap(mapId);
      flash("🗺️ Switching map…");
    } catch (e) {
      console.warn("[DmPanel] dmSwitchMap failed", e);
      flash("Failed to switch map");
    } finally {
      setSwitchingMapId(null);
    }
  };

  /** Upload every localStorage-editor map to the current campaign so the DM
   * can start picking from them without a separate import UI. Skips maps whose
   * name already exists on the server to avoid duplicates on repeated clicks. */
  const handleImportLocalMaps = async () => {
    const session = getCurrentSession();
    if (!session?.campaignId) return;
    const localList = getAllMaps();
    if (localList.length === 0) {
      flash("No local maps to import");
      return;
    }

    setMapsLoading(true);
    try {
      const existingNames = new Set(campaignMaps().map((m) => m.name.toLowerCase()));
      let imported = 0;
      for (const meta of localList) {
        if (existingNames.has(meta.name.toLowerCase())) continue;
        const data = loadMap(meta.id);
        if (!data) continue;
        await MapService.create(session.campaignId, {
          name: meta.name,
          data: JSON.stringify(data),
        });
        imported++;
      }
      // Refresh
      const refreshed = await MapService.list(session.campaignId);
      setCampaignMaps(refreshed);
      setMapsLoaded(true);
      flash(imported > 0 ? `${imported} map(s) imported` : "Nothing to import (already present)");
    } catch (e) {
      console.warn("[DmPanel] importLocalMaps failed", e);
      flash("Import failed");
    } finally {
      setMapsLoading(false);
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
            <span class="text-xs font-semibold text-purple-200 tracking-wide">Dungeon Master</span>
          </div>
          <Show when={isExpanded()} fallback={<ChevronDown class="w-3.5 h-3.5 text-purple-400/60" />}>
            <ChevronUp class="w-3.5 h-3.5 text-purple-400/60" />
          </Show>
        </button>

        <Show when={isExpanded()}>
          {/* Combat trigger / kill-switch — mirror pair.
              Start is shown in free roam; End (BUG-O) is shown once combat
              is running. Both invoke the hub; every client receives the
              corresponding broadcast and transitions together. */}
          <Show when={gameState.phase === GamePhase.FREE_ROAM}>
            <button
              onClick={async () => {
                try {
                  await dmStartCombat();
                  flash("⚔️ Combat started");
                } catch (err) {
                  console.warn("[DmPanel] dmStartCombat failed", err);
                  flash("Failed to start combat");
                }
              }}
              class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-red-600/80 to-rose-600/80 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold border border-red-400/40 shadow-lg transition-colors cursor-pointer"
              title="Start combat phase — all clients switch immediately"
            >
              <Swords class="w-3.5 h-3.5" />
              Start combat
            </button>
          </Show>

          <Show when={gameState.phase !== GamePhase.FREE_ROAM && gameState.phase !== GamePhase.GAME_OVER}>
            <button
              onClick={async () => {
                try {
                  await dmEndCombat();
                  flash("🕊️ Combat interrupted");
                } catch (err) {
                  console.warn("[DmPanel] dmEndCombat failed", err);
                  flash("Failed to stop combat");
                }
              }}
              class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 shadow-lg transition-colors cursor-pointer"
              title="Stop combat — session returns to free exploration"
            >
              Stop combat
            </button>
          </Show>

          {/* AI auto-play toggle — reachable at all times in session so the DM
              can configure it BEFORE starting combat (user request). When off
              the DM drives enemies manually via EnemyHotbar during ENEMY_TURN. */}
          <label class="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-purple-500/20 bg-purple-500/5 text-[11px] text-purple-100 cursor-pointer">
            <span class="flex items-center gap-1.5">
              <span class="font-semibold">AI auto</span>
              <span class="text-[9px] text-purple-300/60">
                {dmToolsState.aiAutoPlay ? "on" : "manual"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={dmToolsState.aiAutoPlay}
              onChange={(e) => setAiAutoPlay(e.currentTarget.checked)}
              class="w-3.5 h-3.5 accent-purple-500 cursor-pointer"
            />
          </label>

          {/* Tabs — Sélection is the default neutral mode: clicking a unit
              selects/inspects without drag-staging; clicking a tile is a
              no-op. Déplacer explicitly enables the click-to-teleport UX. */}
          <div class="flex gap-0.5 mt-2">
            <DmTab active={activeTab() === "select"} onClick={() => switchTab("select")} label="Select" />
            <DmTab active={activeTab() === "move"} onClick={() => switchTab("move")} label="Move" />
            <DmTab active={activeTab() === "spawn"} onClick={() => switchTab("spawn")} label="Spawn" />
            <DmTab active={activeTab() === "roll"} onClick={() => switchTab("roll")} label="Dice" />
            <DmTab active={activeTab() === "dice-request"} onClick={() => switchTab("dice-request")} label="D20 roll" />
            <Show when={getCurrentSession()?.campaignId}>
              <DmTab active={activeTab() === "maps"} onClick={() => { switchTab("maps"); void loadMapsIfNeeded(); }} label="Maps" />
            </Show>
          </div>

          {/* ── SELECT TAB ── */}
          <Show when={activeTab() === "select"}>
            <p class="text-[10px] text-purple-300/50 text-center py-3">
              Click a token to inspect it without moving it. Switch to
              <span class="text-purple-200/80"> Move</span> to teleport.
            </p>

            {/* Prochain nœud de scénario — visible uniquement en mode session */}
            <Show when={props.onNextNode}>
              <button
                onClick={props.onNextNode}
                class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600/80 to-purple-600/80 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold border border-indigo-400/40 shadow-lg transition-colors cursor-pointer"
                title="Return to session and advance to the next scenario block"
              >
                <ChevronRight class="w-3.5 h-3.5" />
                Next scenario node
              </button>
            </Show>
          </Show>

          {/* Status flash */}
          <Show when={statusMsg()}>
            <p class="text-[10px] text-center text-emerald-300/80 mt-1.5">{statusMsg()}</p>
          </Show>

          {/* ── MOVE TAB ── */}
          <Show when={activeTab() === "move"}>
            <div class="mt-2 space-y-1.5">
              <Show when={selectedUnit()} fallback={
                <p class="text-[10px] text-purple-300/50 text-center py-2">
                  Click a character on the map to select it, then click a tile to move it.
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
                {selectedUnit() ? "Click anywhere on the map" : "Move mode active"}
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
                <p class="text-[10px] text-purple-300/50 text-center">Click on the map to place · click the monster again to cancel</p>
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

          {/* ── REQUEST TAB ── DM asks players to roll a public D20 */}
          <Show when={activeTab() === "dice-request"}>
            <DiceRequestPanel />
          </Show>

          {/* ── MAPS TAB ── DM-only scene switcher pulling from persisted maps */}
          <Show when={activeTab() === "maps"}>
            <div class="mt-2 space-y-1.5">
              <Show when={mapsLoading()}>
                <p class="text-[10px] text-purple-300/50 text-center py-2">Loading…</p>
              </Show>
              <Show when={!mapsLoading() && mapsLoaded() && campaignMaps().length === 0}>
                <p class="text-[10px] text-purple-300/50 text-center py-2">
                  No maps saved for this campaign. Open the editor to create some and save them server-side.
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
                            {isSwitching() ? "…" : "Load"}
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
              <div class="flex items-center gap-3 pt-1">
                <button
                  onClick={() => { setMapsLoaded(false); void loadMapsIfNeeded(); }}
                  class="text-[10px] text-purple-300/60 hover:text-purple-200 underline underline-offset-2"
                >
                  Refresh
                </button>
                <button
                  onClick={handleImportLocalMaps}
                  disabled={mapsLoading()}
                  class="text-[10px] text-amber-300/70 hover:text-amber-200 underline underline-offset-2 disabled:opacity-50"
                  title="Push locally saved editor maps to this campaign"
                >
                  Import my local maps
                </button>
              </div>
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
