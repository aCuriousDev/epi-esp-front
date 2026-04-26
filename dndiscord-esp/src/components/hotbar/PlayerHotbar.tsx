import { Component, Show, createSignal, createMemo } from "solid-js";
import { units } from "../../game/stores/UnitsStore";
import { gameState } from "../../game/stores/GameStateStore";
import { getCurrentUnit, endUnitTurn } from "../../game";
import { GamePhase, Team } from "../../types";
import {
  sessionState,
  getHubUserId,
  isDm,
  isInSession,
} from "../../stores/session.store";
import InventoryPanel from "../InventoryPanel";
import WalletPanel from "../WalletPanel";
import { PlayerPortrait } from "./PlayerPortrait";
import { PlayerSelfInspectModal } from "./PlayerSelfInspectModal";
import { HotbarSpells } from "./HotbarSpells";
import { HotbarConsumables } from "./HotbarConsumables";
import { HotbarUtilities } from "./HotbarUtilities";
import { HotbarModal } from "./HotbarModal";

/**
 * Persistent bottom-center hotbar for non-DM players during IN_GAME. Mirrors
 * the BG3 action-bar pattern: portrait + ability slots + quick-use
 * consumables + utility buttons (inventory / wallet / end-turn).
 *
 * Self-gated — renders nothing for the DM, outside a session, or before the
 * local player has a unit on the board.
 */
export const PlayerHotbar: Component = () => {
  const [inventoryOpen, setInventoryOpen] = createSignal(false);
  const [walletOpen, setWalletOpen] = createSignal(false);
  const [sheetOpen, setSheetOpen] = createSignal(false);

  const myUnit = createMemo(() => {
    const hubId = getHubUserId();
    if (!hubId) return null;
    for (const id in units) {
      const u = units[id];
      if (u?.ownerUserId === hubId) return u;
    }
    return null;
  });

  const myCharacterId = createMemo(() => {
    const hubId = getHubUserId();
    const session = sessionState.session;
    if (!hubId || !session) return null;
    const me = session.players.find((p) => p.userId === hubId);
    return me?.selectedCharacterId ?? null;
  });

  const canAct = createMemo(() => {
    if (gameState.phase !== GamePhase.PLAYER_TURN) return false;
    const current = getCurrentUnit();
    const u = myUnit();
    return !!current && !!u && current.id === u.id && current.team === Team.PLAYER;
  });

  // End-turn shows only on my own PLAYER_TURN.
  const canEndTurn = createMemo(() => canAct());

  // Top-level render gate: non-DM, in-session, own unit exists.
  const visible = createMemo(() => isInSession() && !isDm() && !!myUnit());

  return (
    <Show when={visible()}>
      <>
        <div
          class="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          data-testid="player-hotbar"
        >
          <div class="flex items-end gap-2 pointer-events-auto">
            <PlayerPortrait unit={myUnit()} onClick={() => setSheetOpen(true)} />
            <HotbarSpells unit={myUnit()} canAct={canAct()} />
            <HotbarConsumables characterId={myCharacterId()} />
            <HotbarUtilities
              onOpenInventory={() => setInventoryOpen(true)}
              onOpenWallet={() => setWalletOpen(true)}
              canEndTurn={canEndTurn()}
              onEndTurn={() => endUnitTurn()}
            />
          </div>
        </div>

        <HotbarModal
          open={inventoryOpen() && !!myCharacterId()}
          title="Inventaire"
          onClose={() => setInventoryOpen(false)}
        >
          <InventoryPanel characterId={myCharacterId()!} isMJ={false} />
        </HotbarModal>

        <HotbarModal
          open={walletOpen() && !!myCharacterId()}
          title="Portefeuille"
          onClose={() => setWalletOpen(false)}
          widthClass="max-w-lg"
        >
          <WalletPanel characterId={myCharacterId()!} isMJ={false} />
        </HotbarModal>

        <PlayerSelfInspectModal
          open={sheetOpen()}
          onClose={() => setSheetOpen(false)}
          unit={myUnit()}
          characterId={myCharacterId()}
        />
      </>
    </Show>
  );
};
