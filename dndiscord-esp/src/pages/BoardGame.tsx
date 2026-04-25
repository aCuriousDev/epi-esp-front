import { Component, Show, onMount, onCleanup, createSignal, createEffect } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { ArrowLeft, RotateCcw, Check, Hand, MousePointer, Move as MoveIcon, Flag, HelpCircle, X, Settings as SettingsIcon } from "lucide-solid";
import { InGameSettingsModal } from "../components/InGameSettingsModal";
import { getPhaseIcon } from "../components/common/icons";
import {
  GameCanvas,
  isEngineReady,
  resetCamera,
  clearEngineState,
} from "../components/GameCanvas";
import { UnitInfoPanel } from "../components/UnitInfoPanel";
import { CombatLog } from "../components/CombatLog";
import { TurnOrderDisplay } from "../components/TurnOrderDisplay";
import { GameOverScreen } from "../components/GameOverScreen";
import { ModeSelectionScreen } from "../components/ModeSelectionScreen";
import { MapSelectionForGame } from "../components/MapSelectionForGame";
import { DungeonSelectionForGame } from "../components/DungeonSelectionForGame";
import { RoomJoinScreen } from "../components/RoomJoinScreen";
import { LobbyScreen } from "../components/LobbyScreen";
import { DialogueOverlay } from "../components/dialogue/DialogueOverlay";
import { DmPanel } from "../components/dm/DmPanel";
import DmPlayerInspectPanel from "../components/dm/DmPlayerInspectPanel";
import { ItemReceivedToast } from "../components/dm/ItemReceivedToast";
import { EnemySpawnToast } from "../components/dm/EnemySpawnToast";
import DiceRequestListener from "../components/dice/DiceRequestListener";
import DiceRollPrompt from "../components/dice/DiceRollPrompt";
import DiceResultToast from "../components/dice/DiceResultToast";
import InventoryPanel from "../components/InventoryPanel";
import WalletPanel from "../components/WalletPanel";
import { PlayerHotbar } from "../components/hotbar/PlayerHotbar";
import { EnemyHotbar } from "../components/hotbar/EnemyHotbar";
import { UnitInfoCardTop } from "../components/hotbar/UnitInfoCardPosition";
import { clearAllDialogues } from "../stores/dialogue.store";
import {
  gameState,
  startGame,
  startCombatFromPreparation,
  getCurrentMode,
  getIsDungeonMode,
  getDungeonState,
  resetGameState,
  clearUnits,
  clearTiles,
  getCurrentUnit,
  endUnitTurn,
  selectUnit,
} from "../game";
import { getHubUserId } from "../stores/session.store";
import { GamePhase, AppPhase, GameMode } from "../types";
import { sessionState, clearSession, getPersistedSession } from "../stores/session.store";
import { isDm } from "../stores/session.store";
import { leaveSession, dmRestartGame as dmRestartGameHub, tryRecoverSession } from "../services/signalr/multiplayer.service";
import { isInSession } from "../stores/session.store";
import {
  getSessionMapConfig,
  clearSessionMapConfig,
  isSessionMapActive,
  setSessionExitCallback,
  clearSessionExitCallback,
  pendingSessionExit,
  clearPendingSessionExit,
  triggerSessionExit,
  type ExitType,
} from "../stores/session-map.store";
import type { GameStartedPayload } from "../types/multiplayer";
import { saveMap, type SavedMapData } from "../services/mapStorage";
import { LogOut } from "lucide-solid";
import { PartyChatPanel } from "../components/PartyChatPanel";
import RollHistoryPanel from "../components/dm/RollHistoryPanel";
import { SessionState } from "../types/multiplayer";
import { isHost as isSessionHost } from "../stores/session.store";
import { randomizePreparationPlacement } from "../game/actions/PreparationActions";

const BoardGame: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Tracks whether the component is still mounted.  Every checkEngine loop
  // reads this flag before scheduling the next tick so orphaned timeouts
  // that fire after an unmount are no-ops.
  let mounted = true;
  onCleanup(() => { mounted = false; });

  const [appPhase, setAppPhase] = createSignal<AppPhase>(
    AppPhase.MODE_SELECTION,
  );
  const [selectedMode, setSelectedMode] = createSignal<GameMode | null>(null);
  const [selectedMapId, setSelectedMapId] = createSignal<string | null>(null);
  const [selectedDungeonId, setSelectedDungeonId] = createSignal<string | null>(
    null,
  );
  const [isMultiplayer, setIsMultiplayer] = createSignal(false);
  const [fromSession, setFromSession]     = createSignal(false);

  onMount(async () => {
    const qs = new URLSearchParams(location.search);

    // ── Demo mode ───────────────────────────────────────────────────────────
    if (qs.get("demo") === "1") {
      setSelectedMode(GameMode.COMBAT);
      setSelectedMapId(null);
      setAppPhase(AppPhase.IN_GAME);

      let attempts = 0;
      const checkEngine = () => {
        if (++attempts > 50) return;
        if (isEngineReady()) {
          setTimeout(() => startGame(GameMode.COMBAT, null), 150);
        } else {
          if (mounted) setTimeout(checkEngine, 100);
        }
      };
      checkEngine();
      return;
    }

    // ── Session map mode (launched from CampaignSessionPage) ────────────────
    if (qs.get("fromSession") === "1") {
      const cfg = getSessionMapConfig();
      if (cfg) {
        console.log("[BoardGame] Session map mode — mapId:", cfg.mapId);
        // Guard 1 — leave any active SignalR session before entering the
        // story-tree FREE_ROAM flow. The two session concepts (campaign
        // story-tree vs combat hub) coexist at the lobby layer; inside the
        // board they must not overlap or the hub keeps broadcasting into a
        // scene it no longer owns.
        (async () => {
          // Snapshot unit assignments BEFORE leaveSession() — that call invokes
          // clearSession() which wipes gameStartedPayload and its unitAssignments.
          // Preserving them here lets the map spawn one character per lobby player
          // even though the SignalR session is torn down for the story-tree board.
          // Falls back to undefined (→ solo 3-char defaults) when no lobby was used.
          const unitAssignments =
            sessionState.gameStartedPayload?.unitAssignments?.length
              ? sessionState.gameStartedPayload.unitAssignments
              : undefined;

          if (sessionState.session) {
            try {
              await leaveSession();
            } catch (err) {
              console.warn("[BoardGame] leaveSession on fromSession entry failed", err);
              clearSession();
            }
          }
          setFromSession(true);
          setSelectedMode(GameMode.FREE_ROAM);
          setSelectedMapId(cfg.mapId);
          setAppPhase(AppPhase.IN_GAME);

          setSessionExitCallback((exitType) => backToSession(exitType));

          let attempts = 0;
          const checkEngine = () => {
            if (++attempts > 50) {
              console.error("[BoardGame] Engine failed to initialize (session map)");
              backToSession();
              return;
            }
            if (isEngineReady()) {
              // Pass multiplayer assignments when available so one character is
              // spawned per player who was in the lobby. undefined → solo defaults.
              setTimeout(() => startGame(GameMode.FREE_ROAM, cfg.mapId, null, unitAssignments), 150);
            } else {
              if (mounted) setTimeout(checkEngine, 100);
            }
          };
          checkEngine();
        })();
        return;
      }
    }

    // ── Session rehydration on F5 ───────────────────────────────────────────
    // After a hard reload of /board the in-memory `sessionState.session` is
    // wiped (it lives in a SolidJS store). The persisted session id still
    // sits in sessionStorage though. Without rehydrating here we'd fall
    // through to the "no session → mode selection" branch and unmount the
    // <DiceRequestListener> that lives under <Show when={IN_GAME}>, so any
    // RejoinSession + DiceRollRequested replay from the back would have no
    // listener to receive it. Mirror RoomJoinScreen.onMount's recovery flow.
    if (!sessionState.session && getPersistedSession()) {
      console.log("[BoardGame] No in-memory session; attempting recovery from sessionStorage");
      try {
        await tryRecoverSession();
      } catch (err) {
        console.warn("[BoardGame] tryRecoverSession threw", err);
      }
    }

    const s = sessionState.session;
    if (s) {
      setIsMultiplayer(true);
      if (s.state === SessionState.Lobby) {
        setAppPhase(AppPhase.LOBBY);
      } else if (s.state === SessionState.InProgress) {
        setAppPhase(AppPhase.IN_GAME);
      } else {
        setAppPhase(AppPhase.LOBBY);
      }
      console.log(
        "[BoardGame] Existing session detected, redirecting to lobby:",
        s.sessionId,
      );
      return;
    }

    console.log("[BoardGame] Component mounted, showing mode selection");
  });

  onCleanup(() => {
    clearAllDialogues();
  });

  const startMode = (mode: GameMode) => {
    console.log("[BoardGame] ========== MODE SELECTED:", mode, "==========");
    setSelectedMode(mode);
    if (mode === GameMode.DUNGEON) {
      setAppPhase(AppPhase.DUNGEON_SETUP);
    } else {
      setAppPhase(AppPhase.MAP_SELECTION);
    }
  };

  const selectMap = (mapId: string | null) => {
    console.log(
      "[BoardGame] ========== MAP SELECTED:",
      mapId || "default",
      "==========",
    );
    setSelectedMapId(mapId);
    setAppPhase(AppPhase.IN_GAME);

    let attempts = 0;
    const checkEngine = () => {
      if (++attempts > 50) {
        console.error("[BoardGame] Engine failed to initialize");
        backToModeSelection();
        return;
      }
      if (isEngineReady()) {
        setTimeout(() => {
          startGame(selectedMode()!, mapId);
        }, 150);
      } else {
        if (mounted) setTimeout(checkEngine, 100);
      }
    };
    checkEngine();
  };

  const selectDungeon = (dungeonId: string) => {
    console.log(
      "[BoardGame] ========== DUNGEON SELECTED:",
      dungeonId,
      "==========",
    );
    setSelectedDungeonId(dungeonId);
    setAppPhase(AppPhase.IN_GAME);

    let attempts = 0;
    const checkEngine = () => {
      if (++attempts > 50) {
        console.error("[BoardGame] Engine failed to initialize");
        backToModeSelection();
        return;
      }
      if (isEngineReady()) {
        setTimeout(() => {
          startGame(GameMode.DUNGEON, null, dungeonId);
        }, 150);
      } else {
        if (mounted) setTimeout(checkEngine, 100);
      }
    };
    checkEngine();
  };

  const goToMultiplayer = () => {
    setIsMultiplayer(true);
    setAppPhase(AppPhase.ROOM_JOIN);
  };

  const onRoomReady = () => {
    setAppPhase(AppPhase.LOBBY);
  };

  let lastInitPayload: GameStartedPayload | null = null;

  const onMultiplayerGameStart = (payload: GameStartedPayload) => {
    if (lastInitPayload === payload) return;
    lastInitPayload = payload;

    console.log(
      "[BoardGame] ========== MULTIPLAYER GAME STARTED ==========",
      payload,
    );

    // Save received map data to localStorage so loadMap() finds it
    if (payload.mapData) {
      try {
        const parsedMap: SavedMapData = JSON.parse(payload.mapData);
        saveMap(parsedMap);
        console.log(
          "[BoardGame] Saved remote map data to localStorage:",
          parsedMap.id,
        );
      } catch (e) {
        console.error("[BoardGame] Failed to parse received mapData:", e);
      }
    }

    // Restart case: we're already in-game (the user hit Recommencer / Play
    // Again, or the DM rebuilt the roster). Wipe stale stores before the
    // re-seed so enemies from the previous "life" don't survive, and reset
    // phase so the GameOverScreen (gated on phase=GAME_OVER) unmounts
    // immediately rather than waiting for initializeFreeRoam to reach
    // setGameState. Without this the defeat modal stuck around for users.
    if (appPhase() === AppPhase.IN_GAME) {
      clearUnits();
      clearTiles();
      resetGameState();
    }

    setSelectedMapId(payload.mapId === "default" ? null : payload.mapId);
    setAppPhase(AppPhase.IN_GAME);

    // Every multiplayer game starts in Free Roam. The DM decides when to flip the
    // session into COMBAT via DmPanel's "Démarrer combat" button, which broadcasts
    // CombatStarted to every client. The old `campaignId ? COMBAT : FREE_ROAM`
    // heuristic forced campaign sessions straight into prep phase, stranding
    // turn order in an empty state (the "AI doesn't play" symptom).
    const modeForSession = () => GameMode.FREE_ROAM;

    let attempts = 0;
    const checkEngine = () => {
      if (++attempts > 50) {
        console.error("[BoardGame] Engine failed to initialize");
        backToModeSelection();
        return;
      }
      if (isEngineReady()) {
        setTimeout(() => {
          startGame(
            modeForSession(),
            payload.mapId === "default" ? null : payload.mapId,
            undefined,
            payload.unitAssignments,
          );
        }, 150);
      } else {
        if (mounted) setTimeout(checkEngine, 100);
      }
    };
    checkEngine();
  };

  // Run the re-init for every GameStarted payload that lands while the app
  // is already in IN_GAME phase. Covers three cases: (1) DM Recommencer
  // after defeat/victory, (2) refresh/reconnect where OnConnectedAsync
  // replays GameStarted via the rejoin snapshot, and (3) any future path
  // that sets gameStartedPayload while BoardGame is mounted in-game. A
  // plain createEffect (no `on(..., { defer: true })`) guarantees the
  // effect fires even if the payload was already in the store at the time
  // BoardGame mounted — the old deferred variant skipped that case and
  // left rejoiners stuck on "Setting up…". The dedupe in
  // onMultiplayerGameStart prevents double-init when LobbyScreen also
  // called it directly for the initial transition.
  createEffect(() => {
    const payload = sessionState.gameStartedPayload;
    if (!payload) return;
    if (appPhase() !== AppPhase.IN_GAME) return;
    // Guard 2 — story-tree flow owns the board; suppress hub re-init so a
    // stale gameStartedPayload can't overwrite the session-map FREE_ROAM.
    if (isSessionMapActive()) return;
    onMultiplayerGameStart(payload);
  });

  const backToModeSelection = async () => {
    // Guard 3 — notify server before tearing down local state so the hub
    // doesn't keep the DM's group membership alive for this client.
    // clearSession() below runs regardless so a failed hub call can't leave
    // a stale session reference behind.
    if (sessionState.session) {
      try {
        await leaveSession();
      } catch (err) {
        console.warn("[BoardGame] leaveSession in backToModeSelection failed", err);
      }
    }
    setAppPhase(AppPhase.MODE_SELECTION);
    setSelectedMode(null);
    setSelectedMapId(null);
    setSelectedDungeonId(null);
    setIsMultiplayer(false);
    setFromSession(false);
    clearSession();
  };

  /** Return to the campaign session page after playing a session map. */
  const backToSession = (exitType: 'next' | 'end' = 'next') => {
    const cfg = getSessionMapConfig();
    clearPendingSessionExit();
    clearSessionExitCallback();
    clearSessionMapConfig();
    clearEngineState();
    if (cfg) {
      // resumeNodeId lets the session page restore the current position in the tree
      // instead of always restarting from the first node.
      navigate(
        `/campaigns/${cfg.campaignId}/session?mapExit=${exitType}&resumeNodeId=${encodeURIComponent(cfg.nodeId)}`,
      );
    } else {
      backToModeSelection();
    }
  };

  const returnToMenu = async () => {
    console.log("[BoardGame] ========== RETURNING TO MENU ==========");
    // Wait for the 3D reset to finish before touching stores so the tiles
    // effect doesn't race against an in-flight teardown.
    await clearEngineState();

    clearUnits();
    clearTiles();
    resetGameState();

    navigate("/");
  };

  const restartGame = async () => {
    const currentMode = getCurrentMode();
    const currentMapId = selectedMapId();

    // Multiplayer host restart: use the dedicated DmRestartGame hub method,
    // which rebuilds assignments and broadcasts GameStarted to every client.
    // Plain StartGame would throw "Game already started" because the session
    // is in InProgress state. The old local fallback silently regenerated the
    // single-player DEFAULT_ENEMIES trio on the host only and left players
    // stranded on their old state — that was the "weird defaults" bug.
    if (isInSession()) {
      if (!isSessionHost()) return;
      try {
        await dmRestartGameHub(currentMapId || "default");
      } catch (err) {
        console.error("[BoardGame] DmRestartGame failed — game not restarted:", err);
      }
      // Never fall through to the local path in multiplayer. Forking the host
      // to solo while peers stayed on the old state was BUG-K / BUG-N.
      return;
    }

    // Solo path only: explicit, awaited teardown then local re-init.
    await clearEngineState();

    clearUnits();
    clearTiles();
    resetGameState();

    await startGame(currentMode, currentMapId);
  };

  const closeDrawers = () => {
    setLeftDrawerOpen(false);
    setRightDrawerOpen(false);
  };

  const toggleLeftDrawer = () => {
    setLeftDrawerOpen((open) => {
      const next = !open;
      if (next) setRightDrawerOpen(false);
      return next;
    });
  };

  const toggleRightDrawer = () => {
    setRightDrawerOpen((open) => {
      const next = !open;
      if (next) setLeftDrawerOpen(false);
      return next;
    });
  };

  const [leftDrawerOpen, setLeftDrawerOpen] = createSignal(false);
  const [rightDrawerOpen, setRightDrawerOpen] = createSignal(false);

  // Auto-open the unit info drawer the first time a selection happens. Only
  // applies to the DM — non-DM players get a compact UnitInfoCard floating
  // at the top of the canvas plus the persistent bottom hotbar, so the
  // drawer would be redundant noise. We still force-open on a selection
  // transition for the DM; manual close stays closed until a new selection.
  let lastAutoOpenedFor: string | null = null;
  createEffect(() => {
    const sel = gameState.selectedUnit;
    if (sel && sel !== lastAutoOpenedFor && isDm()) {
      lastAutoOpenedFor = sel;
      setLeftDrawerOpen(true);
      setRightDrawerOpen(false);
    }
    if (!sel) {
      lastAutoOpenedFor = null;
    }
  });

  // Ownership check — in multiplayer, only the user who owns the current
  // unit (or single-player, where ownership is undefined) sees the End
  // Turn button and triggers auto-select on turn start.
  const isCurrentUnitMine = (): boolean => {
    const current = getCurrentUnit();
    if (!current || current.team !== "player") return false;
    const isOwned = !!current.ownerUserId;
    const me = getHubUserId();
    return !isOwned || current.ownerUserId === me;
  };

  // Auto-select the current player unit when a new PLAYER_TURN starts
  // IF the local user owns it. Respects the ownership gate so remote
  // players don't have another player's unit auto-selected. A manual
  // deselect stays deselected until the turn advances again.
  let lastAutoSelectedForIndex = -1;
  createEffect(() => {
    const phase = gameState.phase;
    const idx = gameState.currentUnitIndex;
    if (phase !== GamePhase.PLAYER_TURN) {
      lastAutoSelectedForIndex = -1;
      return;
    }
    if (idx === lastAutoSelectedForIndex) return;
    lastAutoSelectedForIndex = idx;
    const current = getCurrentUnit();
    if (current && isCurrentUnitMine() && gameState.selectedUnit !== current.id) {
      selectUnit(current.id);
    }
  });

  // Floating End Turn is only visible and clickable when it matters.
  // Ownership gated so remote players don't see "Fin du tour" on turns
  // that aren't theirs.
  const canEndPlayerTurn = () => {
    if (gameState.phase !== GamePhase.PLAYER_TURN) return false;
    const current = getCurrentUnit();
    return !!current && current.team === "player" && isCurrentUnitMine();
  };

  // DM override: skip the current enemy turn. Needed because the DM has no
  // unit of their own; without this surface, enemies that can't find a valid
  // action would stall the turn order indefinitely.
  const canDmEndEnemyTurn = () => {
    if (!isDm()) return false;
    if (gameState.phase !== GamePhase.ENEMY_TURN) return false;
    const current = getCurrentUnit();
    return !!current && current.team === "enemy";
  };

  // AP-spent derivation for the end-turn confirm prompt. If the player
  // hasn't moved OR acted yet, the End Turn button asks for a second
  // click to avoid accidental skip of a fresh turn.
  const currentUnitHasSpentAP = () => {
    const u = getCurrentUnit();
    if (!u) return false;
    return (
      !!u.hasMoved ||
      !!u.hasActed ||
      u.stats.currentActionPoints < u.stats.maxActionPoints
    );
  };
  // Controls-help panel: collapsed to a "?" icon by default to keep the
  // canvas uncluttered. Auto-expands for a few seconds when a combat /
  // dungeon run starts, then retracts so the user can reopen it on demand.
  const [helpOpen, setHelpOpen] = createSignal(false);
  let helpAutoRetractTimer: number | null = null;
  let lastHelpAutoShownForPhase: GamePhase | null = null;
  createEffect(() => {
    const phase = gameState.phase;
    const isCombatish =
      phase === GamePhase.PLAYER_TURN ||
      phase === GamePhase.ENEMY_TURN ||
      phase === GamePhase.COMBAT_PREPARATION;
    if (isCombatish && lastHelpAutoShownForPhase === null) {
      lastHelpAutoShownForPhase = phase;
      setHelpOpen(true);
      if (helpAutoRetractTimer !== null) clearTimeout(helpAutoRetractTimer);
      helpAutoRetractTimer = window.setTimeout(() => {
        setHelpOpen(false);
        helpAutoRetractTimer = null;
      }, 5000);
    }
    // Reset the one-shot so a fresh combat after a return-to-menu triggers
    // the help bubble again.
    if (!isCombatish) {
      lastHelpAutoShownForPhase = null;
    }
  });
  onCleanup(() => {
    if (helpAutoRetractTimer !== null) {
      clearTimeout(helpAutoRetractTimer);
      helpAutoRetractTimer = null;
    }
  });

  const [endTurnPending, setEndTurnPending] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  let endTurnPendingTimer: number | null = null;
  const handleEndTurnClick = () => {
    if (!canEndPlayerTurn()) return;
    if (currentUnitHasSpentAP() || endTurnPending()) {
      if (endTurnPendingTimer !== null) {
        clearTimeout(endTurnPendingTimer);
        endTurnPendingTimer = null;
      }
      setEndTurnPending(false);
      endUnitTurn();
      return;
    }
    setEndTurnPending(true);
    endTurnPendingTimer = window.setTimeout(() => {
      setEndTurnPending(false);
      endTurnPendingTimer = null;
    }, 2500);
  };

  /**
   * Character id of the current (non-DM) player for board-side inventory/wallet.
   * null when outside a session, when we're the DM, or when no character is yet selected.
   */
  const myBoardCharacterId = (): string | null => {
    const session = sessionState.session;
    const hubId = getHubUserId();
    if (!session || !hubId || isDm()) return null;
    const me = session.players.find((p) => p.userId === hubId);
    return me?.selectedCharacterId ?? null;
  };

  const renderLeftPanelContent = () => (
    <>
      <Show when={sessionState.session}>
        <div class="panel-game flex flex-col gap-2">
          <p class="text-gray-400 text-sm">
            Session:{" "}
            <span class="text-game-gold font-mono text-xs">
              {sessionState.session!.sessionId.slice(0, 12)}…
            </span>
          </p>
          <button
            class="w-full flex items-center justify-center gap-2 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/10 text-gray-300 text-sm"
            onClick={async () => {
              try {
                await leaveSession();
              } catch (_) {}
              returnToMenu();
            }}
          >
            <LogOut class="w-4 h-4" />
            Quitter la session
          </button>
        </div>
      </Show>
      {/* DM Panel — only visible to the Dungeon Master */}
      <Show when={sessionState.session && isDm()}>
        <DmPanel />
        <DmPlayerInspectPanel />
      </Show>
      {/* Board-side inventory + wallet for the current player (not DM), so they
          can browse items granted by the DM without leaving the board. */}
      <Show when={sessionState.session && !isDm() && myBoardCharacterId()}>
        {(charId) => (
          <>
            <WalletPanel characterId={charId()} isMJ={false} />
            <InventoryPanel characterId={charId()} isMJ={false} />
          </>
        )}
      </Show>
      {/* TurnOrderDisplay is now rendered as an always-visible top banner
          above the canvas, so it stays readable without opening a drawer. */}
      <UnitInfoPanel />
    </>
  );

  const renderRightPanelContent = () => (
    <>
      <Show when={sessionState.session}>
        <div data-tutorial="chat-panel">
          <PartyChatPanel />
        </div>
      </Show>
      <Show
        when={
          getCurrentMode() === GameMode.COMBAT ||
          getCurrentMode() === GameMode.DUNGEON
        }
      >
        <CombatLog />
      </Show>

      <Show when={sessionState.session && sessionState.session.campaignId}>
        <div class="panel-game">
          <h4 class="font-fantasy text-game-gold text-sm mb-3">Jets de dés</h4>
          <RollHistoryPanel />
        </div>
      </Show>

      <Show
        when={
          getCurrentMode() === GameMode.COMBAT ||
          getCurrentMode() === GameMode.DUNGEON
        }
      >
        <div class="panel-game">
          <h4 class="font-fantasy text-game-gold text-sm mb-3">Battle Stats</h4>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-blue-900/30 p-3 rounded">
              <div class="text-gray-400 mb-1">Your Units</div>
              <div class="text-2xl font-bold text-blue-400">
                {Object.values(
                  gameState.turnOrder ? gameState : { turnOrder: [] },
                )
                  .flat()
                  .filter(() => true).length > 0
                  ? "3"
                  : "0"}
              </div>
            </div>
            <div class="bg-red-900/30 p-3 rounded">
              <div class="text-gray-400 mb-1">Enemies</div>
              <div class="text-2xl font-bold text-red-400">3</div>
            </div>
          </div>
        </div>
      </Show>
    </>
  );

  return (
    <Show
      when={appPhase() === AppPhase.IN_GAME}
      fallback={
        <Show
          when={appPhase() === AppPhase.ROOM_JOIN}
          fallback={
            <Show
              when={appPhase() === AppPhase.LOBBY}
              fallback={
                <Show
                  when={appPhase() === AppPhase.MAP_SELECTION}
                  fallback={
                    <Show
                      when={appPhase() === AppPhase.DUNGEON_SETUP}
                      fallback={
                        <ModeSelectionScreen
                          onSelectMode={startMode}
                          onSelectMultiplayer={goToMultiplayer}
                        />
                      }
                    >
                      <DungeonSelectionForGame
                        onSelectDungeon={selectDungeon}
                        onBack={backToModeSelection}
                      />
                    </Show>
                  }
                >
                  <MapSelectionForGame
                    onSelectMap={selectMap}
                    onBack={backToModeSelection}
                  />
                </Show>
              }
            >
              <LobbyScreen
                onGameStart={onMultiplayerGameStart}
                onLeave={backToModeSelection}
              />
            </Show>
          }
        >
          <RoomJoinScreen
            onRoomReady={onRoomReady}
            onGameRecover={onMultiplayerGameStart}
            onBack={backToModeSelection}
          />
        </Show>
      }
    >
      <div class="w-full h-screen-dynamic flex flex-col bg-game-darker overflow-hidden pb-safe-bottom">
        {/* Header */}
        <header class="h-14 shrink-0 bg-gradient-to-r from-brandStart/90 to-brandEnd/90 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-3 sm:px-4 pt-safe-top">
          <div class="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => fromSession() ? backToSession() : returnToMenu()}
              class="flex items-center justify-center w-9 h-9 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label={fromSession() ? "Retour à la session" : "Retour au menu"}
            >
              <ArrowLeft class="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              class="flex items-center justify-center w-9 h-9 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Paramètres"
              title="Paramètres rapides"
            >
              <SettingsIcon class="w-4 h-4 text-white" />
            </button>
            <h1 class="font-display text-white text-lg sm:text-xl tracking-wide">
              DnDiscord
            </h1>
          </div>
          <div class="flex items-center gap-2">
            {/* Session back button (Sam's story-tree flow) — most prominent */}
            <Show when={fromSession()}>
              <button
                onClick={() => backToSession()}
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-sm transition-colors"
              >
                <ArrowLeft class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Retour à la session</span>
              </button>
            </Show>
            {/* Quitter — any MP participant (BUG-I). Drawer Quitter is DM-only. */}
            <Show when={isInSession()}>
              <button
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
                onClick={async () => {
                  try {
                    await leaveSession();
                  } catch (_) {}
                  returnToMenu();
                }}
                title="Quitter la session"
              >
                <LogOut class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Quitter</span>
              </button>
            </Show>
            {/* Restart: solo-only or DM-only (non-host can't blow up MP for everyone). */}
            <Show when={!isInSession() || isSessionHost()}>
              <button
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
                onClick={() => restartGame()}
              >
                <RotateCcw class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">Recommencer</span>
              </button>
            </Show>
          </div>
        </header>

        {/* Main Game Area — the 3D canvas owns the full width on every
            breakpoint. Info / log panels slide in as drawers on top of the
            canvas (mobile-style) rather than stealing permanent layout
            space, so the board stays the focus on laptops/desktops too. */}
        <div class="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Center - Game Canvas */}
          <main class="flex-1 relative min-w-0">
            <GameCanvas />

            {/* Dialogue bubbles overlay (positioned above canvas) */}
            <DialogueOverlay />

            {/* Item received notification toasts */}
            <ItemReceivedToast />

            {/* Enemy spawn notification toasts */}
            <EnemySpawnToast />

            {/* DM-triggered D20 roll request feature */}
            <DiceRequestListener />
            <DiceRollPrompt />
            <DiceResultToast />

            {/* ── Session-map exit request ─────────────────────────────────────────
                When a player steps on an EXIT tile, MovementActions sets
                pendingSessionExit instead of navigating immediately.
                – DM sees a full confirmation banner and decides when to trigger.
                – Other players see a small "waiting for DM" toast.
            ─────────────────────────────────────────────────────────────────── */}
            <Show when={isSessionMapActive() && pendingSessionExit() !== null}>
              <Show
                when={isSessionHost()}
                fallback={
                  /* ── Player toast ──────────────────────────────────────────── */
                  <div class="absolute bottom-28 left-1/2 -translate-x-1/2 z-50
                              flex items-center gap-3
                              px-5 py-3 rounded-2xl
                              bg-slate-900/90 border border-white/10
                              backdrop-blur-sm shadow-2xl
                              pointer-events-none select-none">
                    <div class="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    <span class="text-sm text-slate-300">
                      <span class="text-amber-400 font-semibold">{pendingSessionExit()?.unitName}</span>
                      {' '}a atteint la sortie — en attente du MJ…
                    </span>
                  </div>
                }
              >
                {/* ── DM confirmation banner ────────────────────────────────── */}
                <div class="absolute bottom-28 left-1/2 -translate-x-1/2 z-50
                            flex items-center gap-4
                            px-5 py-4 rounded-2xl
                            bg-slate-900/95 border border-white/15
                            backdrop-blur-sm shadow-2xl">

                  {/* Icon */}
                  <div class={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    pendingSessionExit()?.exitType === 'end'
                      ? 'bg-rose-500/20 border border-rose-500/40'
                      : 'bg-amber-500/20 border border-amber-500/40'
                  }`}>
                    <span class="text-xl">
                      {pendingSessionExit()?.exitType === 'end' ? '⛔' : '🚪'}
                    </span>
                  </div>

                  {/* Text */}
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <p class="text-sm font-semibold text-white leading-snug">
                      <span class={pendingSessionExit()?.exitType === 'end' ? 'text-rose-400' : 'text-amber-400'}>
                        {pendingSessionExit()?.unitName}
                      </span>
                      {' '}a atteint la sortie
                    </p>
                    <p class="text-xs text-slate-400">
                      {pendingSessionExit()?.exitType === 'end'
                        ? 'Cette sortie met fin au scénario.'
                        : 'Cette sortie continue vers le bloc suivant.'}
                    </p>
                  </div>

                  {/* Buttons */}
                  <div class="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => clearPendingSessionExit()}
                      class="px-3 py-2 rounded-xl text-xs font-medium
                             bg-white/5 border border-white/10 text-slate-400
                             hover:bg-white/10 hover:text-white transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        const req = pendingSessionExit();
                        if (!req) return;
                        clearPendingSessionExit();
                        triggerSessionExit(req.exitType);
                      }}
                      class={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        pendingSessionExit()?.exitType === 'end'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500'
                          : 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500'
                      }`}
                    >
                      {pendingSessionExit()?.exitType === 'end' ? '⛔ Terminer' : '🚪 Continuer'}
                    </button>
                  </div>
                </div>
              </Show>
            </Show>

            {/* Compact unit info card (top-center) + persistent player hotbar
                (bottom-center) — non-DM UX replacing the old auto-opening
                drawer. DM keeps the drawer via the effect above. The
                EnemyHotbar self-gates on isDm + ENEMY_TURN so the DM can
                actively play whichever enemy's turn is active when the
                auto-AI toggle is off. */}
            <UnitInfoCardTop />
            <PlayerHotbar />
            <EnemyHotbar />

            {/* Loading Overlay */}
            <Show when={!isEngineReady()}>
              <div class="absolute inset-0 bg-game-darker/95 flex items-center justify-center z-50">
                <div class="text-center">
                  <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-game-gold border-t-transparent mb-4"></div>
                  <h2 class="font-fantasy text-2xl text-game-gold mb-2">
                    Loading Assets
                  </h2>
                  <p class="text-gray-400 text-sm">
                    Preparing 3D models and textures...
                  </p>
                </div>
              </div>
            </Show>

            {/* Persistent turn-order banner — only in combat-ish modes,
                where the initiative line matters. Rendered above the phase
                pill so the player sees "whose turn" without opening a
                drawer. Width-capped so it doesn't cover the whole canvas. */}
            <Show
              when={
                (getCurrentMode() === GameMode.COMBAT ||
                  getCurrentMode() === GameMode.DUNGEON) &&
                gameState.turnOrder.length > 0
              }
            >
              <div class="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-10 w-[min(92vw,560px)]">
                <TurnOrderDisplay />
              </div>
            </Show>

            {/* Game Phase Indicator — shifted down when the turn banner is
                rendered above it (ternary keeps single-line modes at the
                original top position). */}
            <div
              class={`absolute left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 max-w-[calc(100%-1rem)] sm:max-w-[calc(100%-2rem)] ${
                (getCurrentMode() === GameMode.COMBAT ||
                  getCurrentMode() === GameMode.DUNGEON) &&
                gameState.turnOrder.length > 0
                  ? "top-[5.25rem] sm:top-24"
                  : "top-3 sm:top-4"
              }`}
            >
              <Show when={gameState.dungeon}>
                <div class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold bg-purple-600/80 text-white whitespace-nowrap flex items-center gap-1.5">
                  {getPhaseIcon("dungeon")}
                  Salle {(gameState.dungeon?.currentRoomIndex ?? 0) + 1}/
                  {gameState.dungeon?.totalRooms}
                </div>
              </Show>
              {/* Phase pill — hidden during PLAYER_TURN / ENEMY_TURN since
                  the turn-order banner's coloured ring already encodes
                  whose turn it is. Still shown for prep/free-roam/setup
                  phases where the global state matters. */}
              <Show
                when={
                  gameState.phase !== GamePhase.PLAYER_TURN &&
                  gameState.phase !== GamePhase.ENEMY_TURN
                }
              >
                <div
                  class={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 ${
                    gameState.phase === GamePhase.COMBAT_PREPARATION
                      ? "bg-amber-600/80 text-white"
                      : gameState.phase === GamePhase.FREE_ROAM
                        ? "bg-blue-600/80 text-white"
                        : "bg-gray-600/80 text-white"
                  }`}
                >
                  {getPhaseIcon(gameState.phase)}
                  {getPhaseText(gameState.phase)}
                </div>
              </Show>
              {/* Bouton Prêt - Phase de préparation. Hidden in multiplayer:
                  the hub's DmStartCombat transitions straight to PlayerTurn
                  (no preparation phase exists server-side). The button's
                  startCombatFromPreparation action is now a no-op in session,
                  but rendering it would still mislead players into thinking
                  they need to click something. */}
              <Show when={gameState.phase === GamePhase.COMBAT_PREPARATION && !isInSession()}>
                <button
                  data-tutorial="prep-ready"
                  class="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold bg-game-gold text-game-darker hover:bg-amber-400 transition shadow-lg whitespace-nowrap"
                  onClick={() => startCombatFromPreparation()}
                >
                  Prêt
                </button>
                <Show when={isSessionHost()}>
                  <button
                    class="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold bg-white/10 border border-white/20 text-white hover:bg-white/15 transition shadow-lg whitespace-nowrap"
                    onClick={() =>
                      randomizePreparationPlacement(gameState.mapId ?? null)
                    }
                    title="Place aléatoirement joueurs et ennemis sur les zones de spawn"
                  >
                    Placement aléatoire
                  </button>
                </Show>
              </Show>
            </div>

            {/* Panneau Phase de préparation */}
            <Show when={gameState.phase === GamePhase.COMBAT_PREPARATION}>
              <div class="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-10 panel-game w-[min(90%,40rem)] text-center">
                <p class="text-xs sm:text-sm text-gray-300">
                  Placez vos personnages sur les cases alliées (bleues), puis
                  cliquez sur <strong class="text-game-gold">Prêt</strong> pour
                  lancer le combat.
                </p>
              </div>
            </Show>

            {/* Drawer toggles — the "Infos" drawer is DM-only now; non-DM
                players get the persistent hotbar + Inventory/Wallet modals
                from HotbarUtilities instead, so the drawer toggle would be
                redundant UI crowding. Solo play (no session) keeps it. */}
            <div class="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <Show when={!isInSession() || isDm()}>
                <button
                  class="pointer-events-auto px-3 py-2 rounded-lg border border-white/20 bg-game-dark/85 backdrop-blur text-xs text-white font-medium shadow-lg focus-ring-gold"
                  onClick={toggleLeftDrawer}
                  aria-expanded={leftDrawerOpen()}
                  aria-controls="left-drawer"
                >
                  {leftDrawerOpen() ? "Fermer infos" : "Infos"}
                </button>
              </Show>
              <Show when={isInSession() && !isDm()}>
                {/* Placeholder keeps the flex-between spacing so the right
                    drawer toggle stays anchored. */}
                <span class="pointer-events-none" />
              </Show>
              <button
                class="pointer-events-auto px-3 py-2 rounded-lg border border-white/20 bg-game-dark/85 backdrop-blur text-xs text-white font-medium shadow-lg focus-ring-gold"
                onClick={toggleRightDrawer}
                aria-expanded={rightDrawerOpen()}
                aria-controls="right-drawer"
              >
                {rightDrawerOpen() ? "Fermer journal" : "Journal"}
              </button>
            </div>

            {/* Controls help cluster (bottom-left). Retracts to a "?"
                + Reset View duo when closed so the canvas stays clean;
                expands to a legend panel on click/hover. Auto-shows on
                combat start then retracts after 5 s. */}
            <div class="absolute left-3 sm:left-4 bottom-4 z-10 flex flex-col gap-2 items-start pl-safe-left pb-safe-bottom">
              <Show when={helpOpen()}>
                <div class="panel-game text-xs w-[min(16rem,calc(100vw-1.5rem))] lg:max-w-xs relative max-h-[80vh] overflow-y-auto">
                  <button
                    class="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => setHelpOpen(false)}
                    aria-label="Fermer l'aide"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                  <h4 class="font-semibold text-game-gold mb-3 pr-5">Controls</h4>
                  <ul class="space-y-1.5 text-gray-400 lg:hidden">
                    <li class="flex items-start gap-2">
                      <Hand class="w-4 h-4 flex-shrink-0 mt-0.5 text-game-gold" />
                      <span>
                        <span class="text-gray-300 font-medium">Tap</span> —
                        sélectionner / déplacer / attaquer
                      </span>
                    </li>
                    <li class="flex items-start gap-2">
                      <MoveIcon class="w-4 h-4 flex-shrink-0 mt-0.5 text-game-gold" />
                      <span>
                        <span class="text-gray-300 font-medium">Drag</span> —
                        orbiter / panner la caméra
                      </span>
                    </li>
                    <li class="flex items-start gap-2">
                      <MoveIcon class="w-4 h-4 flex-shrink-0 mt-0.5 text-game-gold" />
                      <span>
                        <span class="text-gray-300 font-medium">Pinch</span> —
                        zoom
                      </span>
                    </li>
                  </ul>
                  <ul class="space-y-1.5 text-gray-400 hidden lg:block">
                    <li class="flex items-start gap-2">
                      <MousePointer class="w-4 h-4 flex-shrink-0 mt-0.5 text-game-gold" />
                      <span>
                        <span class="text-gray-300 font-medium">Clic</span> —
                        sélectionner / déplacer / attaquer
                      </span>
                    </li>
                    <li class="flex items-start gap-2">
                      <MousePointer class="w-4 h-4 flex-shrink-0 mt-0.5 text-game-gold" />
                      <span>
                        <span class="text-gray-300 font-medium">Clic droit + drag</span> —
                        orbiter la caméra
                      </span>
                    </li>
                    <li class="flex items-start gap-2">
                      <MousePointer class="w-4 h-4 flex-shrink-0 mt-0.5 text-game-gold" />
                      <span>
                        <span class="text-gray-300 font-medium">Molette</span> —
                        zoom
                      </span>
                    </li>
                  </ul>

                  {/* Legend */}
                  <div class="mt-4">
                    <h4 class="text-game-gold font-semibold mb-2 text-sm">Legend</h4>
                    <div class="space-y-1.5 text-xs">
                      <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded bg-blue-500/50 border border-blue-400 flex-shrink-0" />
                        <span>Movement Range</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded bg-red-500/50 border border-red-400 flex-shrink-0" />
                        <span>Attack Range</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded bg-green-500/50 border border-green-400 flex-shrink-0" />
                        <span>Path Preview</span>
                      </div>
                    </div>
                  </div>

                  {/* Free Roam Mode info — only visible outside combat/dungeon */}
                  <Show when={getCurrentMode() !== GameMode.COMBAT && getCurrentMode() !== GameMode.DUNGEON}>
                    <div class="mt-4">
                      <h4 class="text-game-gold font-semibold mb-2 text-sm">Free Roam Mode</h4>
                      <p class="text-xs text-gray-400 mb-2">
                        Explore the map freely without combat restrictions. Move your units anywhere to plan strategies and test formations.
                      </p>
                      <ul class="space-y-1 text-xs text-gray-400">
                        <li class="flex gap-1.5">
                          <Check class="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>No enemy units</span>
                        </li>
                        <li class="flex gap-1.5">
                          <Check class="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>Unlimited movement</span>
                        </li>
                        <li class="flex gap-1.5">
                          <Check class="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>No action point costs</span>
                        </li>
                        <li class="flex gap-1.5">
                          <Check class="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>No turn restrictions</span>
                        </li>
                      </ul>
                      <p class="text-xs text-gray-500 mt-2">Click a unit, then click a highlighted tile to move.</p>
                    </div>
                  </Show>
                </div>
              </Show>

              <div class="flex items-center gap-2">
                <button
                  class="w-9 h-9 flex items-center justify-center rounded-full border border-white/20 bg-game-dark/85 backdrop-blur text-white shadow-lg hover:bg-game-dark transition-colors focus-ring-gold"
                  onClick={() => setHelpOpen((v) => !v)}
                  title={helpOpen() ? "Fermer l'aide" : "Aide & contrôles"}
                  aria-label={helpOpen() ? "Fermer l'aide" : "Ouvrir l'aide"}
                  aria-expanded={helpOpen()}
                >
                  <HelpCircle class="w-4 h-4" />
                </button>
                <button
                  class="btn-game text-xs sm:text-sm py-1.5 px-3 flex items-center gap-2"
                  onClick={() => resetCamera()}
                  title="Réinitialiser la caméra"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  <span>Reset View</span>
                </button>
              </div>
            </div>

            {/* Floating End Turn (bottom-right) — alone so it can't be
                mis-clicked with camera or help controls. Reset View
                lives in the help cluster bottom-left instead. */}
            <div class="absolute bottom-4 right-3 sm:right-4 z-20 pr-safe-right pb-safe-bottom flex flex-col gap-2 items-end">
              {/* DM-only: players have a Fin-du-tour button inside the hotbar;
                  this floating variant stays for the DM perspective where
                  they still need to see whose end-turn is pending (for the
                  visible-turn-order debug flow). */}
              <Show when={canEndPlayerTurn() && isDm()}>
                <Show when={endTurnPending()}>
                  <div class="px-3 py-1.5 rounded-lg bg-amber-600/90 text-white text-xs font-medium shadow-lg border border-white/10 animate-pulse">
                    Aucun AP dépensé — reclique pour confirmer
                  </div>
                </Show>
                <button
                  class={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors focus-ring-gold ${
                    endTurnPending()
                      ? "bg-amber-500 hover:bg-amber-400 text-game-darker"
                      : "bg-game-gold hover:bg-amber-400 text-game-darker"
                  }`}
                  onClick={handleEndTurnClick}
                  title="Terminer le tour"
                >
                  <Flag class="w-4 h-4" />
                  <span>{endTurnPending() ? "Confirmer" : "Fin du tour"}</span>
                </button>
              </Show>

              {/* DM-only fallback: skip a stuck enemy turn (e.g. no path, no
                  target). Without this the whole turn order stalls because
                  the DM has no player unit of their own. */}
              <Show when={canDmEndEnemyTurn()}>
                <button
                  class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors focus-ring-gold bg-red-600/90 hover:bg-red-500 text-white border border-red-400/40"
                  onClick={() => endUnitTurn()}
                  title="MJ : passer le tour de cet ennemi"
                >
                  <Flag class="w-4 h-4" />
                  <span>Passer tour ennemi</span>
                </button>
              </Show>
            </div>
          </main>

          {/* Drawers — same component on all sizes. Non-modal: no dim
              backdrop so the map stays fully interactive while a drawer
              is open. Users close via the toggle button or the drawer's
              own "Fermer" button. */}
          <div class="absolute inset-0 z-40 pointer-events-none">
            <div
              id="left-drawer"
              class={`absolute inset-y-0 left-0 w-[min(88vw,380px)] md:w-[400px] lg:w-[420px] bg-game-darker/95 backdrop-blur border-r border-white/10 p-3 flex flex-col gap-3 overflow-y-auto transition-transform duration-300 pointer-events-auto ${
                leftDrawerOpen() ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div class="flex items-center justify-between">
                <h3 class="font-fantasy text-game-gold text-sm">
                  Informations
                </h3>
                <button
                  class="text-xs px-2 py-1 rounded border border-white/20 text-gray-300"
                  onClick={closeDrawers}
                >
                  Fermer
                </button>
              </div>
              {renderLeftPanelContent()}
            </div>

            <div
              id="right-drawer"
              class={`absolute inset-y-0 right-0 w-[min(90vw,420px)] md:w-[440px] lg:w-[460px] bg-game-darker/95 backdrop-blur border-l border-white/10 p-3 flex flex-col gap-3 overflow-y-auto transition-transform duration-300 pointer-events-auto ${
                rightDrawerOpen() ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div class="flex items-center justify-between">
                <h3 class="font-fantasy text-game-gold text-sm">Journal</h3>
                <button
                  class="text-xs px-2 py-1 rounded border border-white/20 text-gray-300"
                  onClick={closeDrawers}
                >
                  Fermer
                </button>
              </div>
              {renderRightPanelContent()}
            </div>
          </div>
        </div>

        {/* Game Over Modal */}
        <GameOverScreen />

        {/* Quick settings overlay — opens over the canvas without
            unmounting the engine. Game state persists. */}
        <Show when={settingsOpen()}>
          <InGameSettingsModal onClose={() => setSettingsOpen(false)} />
        </Show>
      </div>
    </Show>
  );
};

function getPhaseText(phase: GamePhase): string {
  switch (phase) {
    case GamePhase.SETUP:
      return "Setting up...";
    case GamePhase.COMBAT_PREPARATION:
      return "Phase de pr\u00e9paration";
    case GamePhase.PLAYER_TURN:
      return "Your Turn";
    case GamePhase.ENEMY_TURN:
      return "Enemy Turn";
    case GamePhase.ANIMATION:
      return "Animating...";
    case GamePhase.GAME_OVER:
      return "Game Over";
    case GamePhase.FREE_ROAM:
      return "Free Roam Mode";
    default:
      return phase;
  }
}

export default BoardGame;
