/**
 * Map server-authoritative combat phase strings (from the SignalR payloads) to
 * the front's {@link GamePhase} enum. Pure function — no stores touched.
 *
 * Keep in sync with `Multiplayer.Define.CombatPhase` on the back.
 */

import { GamePhase } from "../../types";
import type { ServerCombatPhase } from "../../types/multiplayer";

export function mapServerPhase(phase: ServerCombatPhase | undefined | null): GamePhase | null {
  switch (phase) {
    case "FreeRoam":
      return GamePhase.FREE_ROAM;
    case "Preparation":
      return GamePhase.COMBAT_PREPARATION;
    case "PlayerTurn":
      return GamePhase.PLAYER_TURN;
    case "EnemyTurn":
      return GamePhase.ENEMY_TURN;
    case "Resolved":
      return GamePhase.GAME_OVER;
    default:
      return null;
  }
}
