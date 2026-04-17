/**
 * DmPanel — Minimal DM toolkit shown only to the Dungeon Master.
 * Features: force-move token, hidden dice roll, grant item to player.
 */

import {
  Component,
  Show,
  For,
  createSignal,
  batch,
} from "solid-js";
import { Crown, Dices, Move, Package, ChevronDown, ChevronUp, X } from "lucide-solid";
import { isDm, getOtherPlayers, sessionState } from "../../stores/session.store";
import { dmToolsState } from "../../stores/dmTools.store";
import { dmMoveToken, dmHiddenRoll, dmGrantItem } from "../../services/signalr/multiplayer.service";
import { units } from "../../game/stores/UnitsStore";
import { gameState } from "../../game/stores/GameStateStore";
import type { DmHiddenRollPayload } from "../../types/multiplayer";

// --- Item Catalogue (POC) ---
const ITEM_CATALOGUE = [
  { id: "potion_heal", name: "Potion de soin", description: "Restaure 2d4+2 HP" },
  { id: "potion_mana", name: "Potion de mana", description: "Restaure 10 points de mana" },
  { id: "scroll_fireball", name: "Parchemin de Boule de feu", description: "Lance Boule de feu (niveau 3)" },
  { id: "ring_protection", name: "Anneau de protection", description: "+1 CA" },
  { id: "sword_flame", name: "Épée enflammée", description: "+1d6 dégâts de feu" },
  { id: "shield_faith", name: "Bouclier de la foi", description: "+2 CA pendant 10 min" },
  { id: "cloak_invisibility", name: "Cape d'invisibilité", description: "Invisibilité pendant 1 heure" },
  { id: "bag_holding", name: "Sac sans fond", description: "Stockage dimensionnel" },
];

export const DmPanel: Component = () => {
  const [isExpanded, setIsExpanded] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal<"move" | "roll" | "item">("roll");

  // Move token state
  const [selectedUnitForMove, setSelectedUnitForMove] = createSignal<string | null>(null);
  const [moveX, setMoveX] = createSignal(0);
  const [moveZ, setMoveZ] = createSignal(0);
  const [moveStatus, setMoveStatus] = createSignal<string | null>(null);

  // Dice state
  const [diceType, setDiceType] = createSignal(20);
  const [diceModifier, setDiceModifier] = createSignal(0);
  const [diceLabel, setDiceLabel] = createSignal("");
  const [isRolling, setIsRolling] = createSignal(false);

  // Grant item state
  const [showGrantModal, setShowGrantModal] = createSignal(false);
  const [grantTarget, setGrantTarget] = createSignal<string | null>(null);
  const [grantItem, setGrantItem] = createSignal<string | null>(null);
  const [grantQuantity, setGrantQuantity] = createSignal(1);

  if (!isDm()) return null;

  const allUnits = () => Object.values(units).filter((u) => u.isAlive);

  // --- Move Token ---
  const handleMoveToken = async () => {
    const unitId = selectedUnitForMove();
    if (!unitId) return;
    setMoveStatus(null);
    try {
      await dmMoveToken({
        unitId,
        target: { x: moveX(), y: moveZ() },
      });
      setMoveStatus("✓ Token déplacé");
      setTimeout(() => setMoveStatus(null), 2000);
    } catch (e: any) {
      setMoveStatus(`✗ ${e.message}`);
    }
  };

  // --- Hidden Roll ---
  const handleHiddenRoll = async () => {
    setIsRolling(true);
    try {
      await dmHiddenRoll(diceType(), diceModifier(), diceLabel() || undefined);
    } catch (e: any) {
      console.error("Hidden roll failed:", e);
    } finally {
      setIsRolling(false);
    }
  };

  // --- Grant Item ---
  const handleGrantItem = async () => {
    const targetId = grantTarget();
    const itemId = grantItem();
    if (!targetId || !itemId) return;

    const item = ITEM_CATALOGUE.find((i) => i.id === itemId);
    if (!item) return;

    try {
      await dmGrantItem({
        targetUserId: targetId,
        itemId: item.id,
        itemName: item.name,
        quantity: grantQuantity(),
        description: item.description,
      });
      setShowGrantModal(false);
      setGrantTarget(null);
      setGrantItem(null);
      setGrantQuantity(1);
    } catch (e: any) {
      console.error("Grant item failed:", e);
    }
  };

  const players = () => getOtherPlayers();

  return (
    <Show when={isDm()}>
      <div class="panel-game border-purple-500/30 bg-gradient-to-b from-purple-950/40 to-purple-900/20">
        {/* Header */}
        <button
          class="w-full flex items-center justify-between gap-2 group"
          onClick={() => setIsExpanded((v) => !v)}
        >
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
              <Crown class="w-4 h-4 text-purple-300" />
            </div>
            <span class="font-fantasy text-purple-200 text-sm tracking-wide">
              Outils du MJ
            </span>
          </div>
          <Show when={isExpanded()} fallback={<ChevronDown class="w-4 h-4 text-purple-400" />}>
            <ChevronUp class="w-4 h-4 text-purple-400" />
          </Show>
        </button>

        <Show when={isExpanded()}>
          {/* Tab Buttons */}
          <div class="flex gap-1 mt-3">
            <TabButton
              active={activeTab() === "move"}
              onClick={() => setActiveTab("move")}
              icon={<Move class="w-3.5 h-3.5" />}
              label="Déplacer"
            />
            <TabButton
              active={activeTab() === "roll"}
              onClick={() => setActiveTab("roll")}
              icon={<Dices class="w-3.5 h-3.5" />}
              label="Dé caché"
            />
            <TabButton
              active={activeTab() === "item"}
              onClick={() => setActiveTab("item")}
              icon={<Package class="w-3.5 h-3.5" />}
              label="Objet"
            />
          </div>

          {/* Move Token Panel */}
          <Show when={activeTab() === "move"}>
            <div class="mt-3 space-y-2">
              <label class="text-xs text-gray-400">Unité à déplacer</label>
              <select
                class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                value={selectedUnitForMove() ?? ""}
                onChange={(e) => setSelectedUnitForMove(e.currentTarget.value || null)}
              >
                <option value="">— Choisir une unité —</option>
                <For each={allUnits()}>
                  {(unit) => (
                    <option value={unit.id}>
                      {unit.name} ({unit.position.x}, {unit.position.z})
                    </option>
                  )}
                </For>
              </select>

              <div class="flex gap-2">
                <div class="flex-1">
                  <label class="text-xs text-gray-500">X</label>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    class="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    value={moveX()}
                    onInput={(e) => setMoveX(parseInt(e.currentTarget.value) || 0)}
                  />
                </div>
                <div class="flex-1">
                  <label class="text-xs text-gray-500">Z</label>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    class="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    value={moveZ()}
                    onInput={(e) => setMoveZ(parseInt(e.currentTarget.value) || 0)}
                  />
                </div>
              </div>

              <button
                class="w-full py-1.5 rounded text-xs font-semibold bg-purple-600/60 hover:bg-purple-600/80 text-white border border-purple-500/30 transition disabled:opacity-40"
                disabled={!selectedUnitForMove()}
                onClick={handleMoveToken}
              >
                <Move class="w-3 h-3 inline mr-1" />
                Déplacer le token
              </button>

              <Show when={moveStatus()}>
                <p class="text-xs text-center text-purple-300">{moveStatus()}</p>
              </Show>
            </div>
          </Show>

          {/* Hidden Dice Panel */}
          <Show when={activeTab() === "roll"}>
            <div class="mt-3 space-y-2">
              <div class="flex gap-2">
                <div class="flex-1">
                  <label class="text-xs text-gray-400">Type de dé</label>
                  <select
                    class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                    value={diceType()}
                    onChange={(e) => setDiceType(parseInt(e.currentTarget.value))}
                  >
                    <For each={[4, 6, 8, 10, 12, 20, 100]}>
                      {(d) => <option value={d}>d{d}</option>}
                    </For>
                  </select>
                </div>
                <div class="flex-1">
                  <label class="text-xs text-gray-400">Modificateur</label>
                  <input
                    type="number"
                    class="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    value={diceModifier()}
                    onInput={(e) => setDiceModifier(parseInt(e.currentTarget.value) || 0)}
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="Note (optionnel)..."
                class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-gray-600"
                value={diceLabel()}
                onInput={(e) => setDiceLabel(e.currentTarget.value)}
              />

              <button
                class="w-full py-2 rounded text-xs font-bold bg-gradient-to-r from-purple-600/70 to-indigo-600/70 hover:from-purple-600 hover:to-indigo-600 text-white border border-purple-500/30 transition disabled:opacity-40"
                disabled={isRolling()}
                onClick={handleHiddenRoll}
              >
                <Dices class="w-3.5 h-3.5 inline mr-1" />
                {isRolling() ? "Lancer..." : `Lancer d${diceType()} (caché)`}
              </button>

              {/* Hidden Roll Log */}
              <Show when={dmToolsState.hiddenRolls.length > 0}>
                <div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  <p class="text-[10px] text-purple-400/70 uppercase tracking-wider font-semibold">
                    Historique (MJ seulement)
                  </p>
                  <For each={[...dmToolsState.hiddenRolls].reverse()}>
                    {(roll) => (
                      <div class="flex items-center gap-2 text-xs bg-black/30 rounded px-2 py-1 border border-purple-500/10">
                        <span class="font-mono text-purple-200 font-bold min-w-[3rem]">
                          d{roll.diceType}: {roll.result}
                          {roll.modifier !== 0 && (
                            <span class="text-gray-400">
                              {roll.modifier > 0 ? "+" : ""}
                              {roll.modifier}
                            </span>
                          )}
                        </span>
                        <span class="text-purple-300 font-bold">= {roll.total}</span>
                        <Show when={roll.label}>
                          <span class="text-gray-500 truncate">{roll.label}</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* Grant Item Panel */}
          <Show when={activeTab() === "item"}>
            <div class="mt-3 space-y-2">
              <label class="text-xs text-gray-400">Donner un objet à un joueur</label>

              <select
                class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                value={grantTarget() ?? ""}
                onChange={(e) => setGrantTarget(e.currentTarget.value || null)}
              >
                <option value="">— Choisir un joueur —</option>
                <For each={players()}>
                  {(p) => <option value={p.userId}>{p.userName}</option>}
                </For>
              </select>

              <select
                class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                value={grantItem() ?? ""}
                onChange={(e) => setGrantItem(e.currentTarget.value || null)}
              >
                <option value="">— Choisir un objet —</option>
                <For each={ITEM_CATALOGUE}>
                  {(item) => (
                    <option value={item.id}>
                      {item.name}
                    </option>
                  )}
                </For>
              </select>

              <Show when={grantItem()}>
                <div class="bg-black/30 rounded p-2 border border-purple-500/10">
                  <p class="text-xs text-purple-200 font-semibold">
                    {ITEM_CATALOGUE.find((i) => i.id === grantItem())?.name}
                  </p>
                  <p class="text-[10px] text-gray-400 mt-0.5">
                    {ITEM_CATALOGUE.find((i) => i.id === grantItem())?.description}
                  </p>
                </div>
              </Show>

              <div class="flex gap-2 items-end">
                <div class="flex-1">
                  <label class="text-xs text-gray-500">Quantité</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    class="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    value={grantQuantity()}
                    onInput={(e) => setGrantQuantity(Math.max(1, parseInt(e.currentTarget.value) || 1))}
                  />
                </div>
                <button
                  class="flex-1 py-1.5 rounded text-xs font-semibold bg-amber-600/60 hover:bg-amber-600/80 text-white border border-amber-500/30 transition disabled:opacity-40"
                  disabled={!grantTarget() || !grantItem()}
                  onClick={handleGrantItem}
                >
                  <Package class="w-3 h-3 inline mr-1" />
                  Donner
                </button>
              </div>

              {/* Recent Grants */}
              <Show when={dmToolsState.grantedItems.length > 0}>
                <div class="mt-2 space-y-1 max-h-24 overflow-y-auto">
                  <p class="text-[10px] text-amber-400/70 uppercase tracking-wider font-semibold">
                    Objets donnés
                  </p>
                  <For each={[...dmToolsState.grantedItems].reverse().slice(0, 5)}>
                    {(grant) => (
                      <div class="text-[10px] text-gray-400 bg-black/20 rounded px-2 py-0.5">
                        <span class="text-amber-300">{grant.itemName}</span>
                        {grant.quantity > 1 && <span> ×{grant.quantity}</span>}
                        {" → "}
                        <span class="text-white">{grant.targetUserName}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </Show>
  );
};

// --- Sub-components ---

const TabButton: Component<{
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}> = (props) => (
  <button
    class={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-semibold transition border ${
      props.active
        ? "bg-purple-600/40 border-purple-500/50 text-purple-100"
        : "bg-black/20 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-black/30"
    }`}
    onClick={props.onClick}
  >
    {props.icon}
    {props.label}
  </button>
);
