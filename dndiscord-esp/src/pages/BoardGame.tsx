import { Component, Show, onMount, onCleanup, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ArrowLeft, RotateCcw } from "lucide-solid";
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
} from "../game";
import { GamePhase, AppPhase, GameMode } from "../types";
import { sessionState, clearSession } from "../stores/session.store";
import { leaveSession } from "../services/signalr/multiplayer.service";
import type { GameStartedPayload } from "../types/multiplayer";
import { saveMap, type SavedMapData } from "../services/mapStorage";
import { LogOut } from "lucide-solid";
import { PartyChatPanel } from "../components/PartyChatPanel";

const BoardGame: Component = () => {
  const navigate = useNavigate();
  const [appPhase, setAppPhase] = createSignal<AppPhase>(
    AppPhase.MODE_SELECTION,
  );
  const [selectedMode, setSelectedMode] = createSignal<GameMode | null>(null);
  const [selectedMapId, setSelectedMapId] = createSignal<string | null>(null);
  const [selectedDungeonId, setSelectedDungeonId] = createSignal<string | null>(
    null,
  );
  const [isMultiplayer, setIsMultiplayer] = createSignal(false);

  onMount(() => {
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
        setTimeout(checkEngine, 100);
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
        setTimeout(checkEngine, 100);
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

  const onMultiplayerGameStart = (payload: GameStartedPayload) => {
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

    setSelectedMapId(payload.mapId === "default" ? null : payload.mapId);
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
          startGame(
            GameMode.FREE_ROAM,
            payload.mapId === "default" ? null : payload.mapId,
            undefined,
            payload.unitAssignments,
          );
        }, 150);
      } else {
        setTimeout(checkEngine, 100);
      }
    };
    checkEngine();
  };

  const backToModeSelection = () => {
    setAppPhase(AppPhase.MODE_SELECTION);
    setSelectedMode(null);
    setSelectedMapId(null);
    setSelectedDungeonId(null);
    setIsMultiplayer(false);
    clearSession();
  };

  const returnToMenu = () => {
    console.log("[BoardGame] ========== RETURNING TO MENU ==========");
    console.log("[BoardGame] Clearing engine state...");

    // FIRST: Clear the 3D engine (removes all meshes)
    clearEngineState();

    console.log("[BoardGame] Clearing units, tiles, and game state...");
    // THEN: Clear all game state stores
    clearUnits();
    clearTiles();
    resetGameState();

    console.log("[BoardGame] All state cleared, navigating to home");
    // Navigate back to main menu
    navigate("/");
  };

  const restartGame = () => {
    const currentMode = getCurrentMode();
    const currentMapId = selectedMapId();
    console.log(
      "[BoardGame] ========== RESTARTING GAME IN",
      currentMode,
      "MODE WITH MAP:",
      currentMapId || "default",
      "==========",
    );

    // For restart, we DON'T dispose the engine - we just clear game objects and reinitialize
    // The GameCanvas effects will handle creating new meshes when the stores are repopulated
    console.log("[BoardGame] Clearing game state stores...");
    clearUnits();
    clearTiles();
    resetGameState();

    // Wait a bit for cleanup effects to process, then reinitialize
    setTimeout(() => {
      console.log(
        "[BoardGame] Re-initializing game in",
        currentMode,
        "mode with map:",
        currentMapId || "default",
      );
      startGame(currentMode, currentMapId);
      console.log("[BoardGame] Game restart complete");
    }, 100);
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
            }}
          >
            <LogOut class="w-4 h-4" />
            Quitter la session
          </button>
        </div>
      </Show>
      <Show
        when={
          getCurrentMode() === GameMode.COMBAT ||
          getCurrentMode() === GameMode.DUNGEON
        }
      >
        <TurnOrderDisplay />
      </Show>
      <UnitInfoPanel />
    </>
  );

  const renderRightPanelContent = () => (
    <>
      <Show when={sessionState.session}>
        <PartyChatPanel />
      </Show>
      <Show
        when={
          getCurrentMode() === GameMode.COMBAT ||
          getCurrentMode() === GameMode.DUNGEON
        }
        fallback={
          <div class="panel-game">
            <h3 class="font-fantasy text-game-gold text-lg mb-4">
              Free Roam Mode
            </h3>
            <div class="space-y-4 text-sm text-gray-300">
              <p>
                Explore the map freely without combat restrictions. Move your
                units anywhere to plan strategies and test formations.
              </p>

              <div class="space-y-3">
                <div>
                  <h4 class="text-game-gold font-semibold mb-2">Features:</h4>
                  <ul class="space-y-2 text-gray-400">
                    <li class="flex gap-2">
                      <span class="text-green-400">✓</span>
                      <span>No enemy units</span>
                    </li>
                    <li class="flex gap-2">
                      <span class="text-green-400">✓</span>
                      <span>Unlimited movement</span>
                    </li>
                    <li class="flex gap-2">
                      <span class="text-green-400">✓</span>
                      <span>No action point costs</span>
                    </li>
                    <li class="flex gap-2">
                      <span class="text-green-400">✓</span>
                      <span>No turn restrictions</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 class="text-game-gold font-semibold mb-2">How to Use:</h4>
                  <ul class="space-y-2 text-gray-400">
                    <li>1. Click on any of your units to select them</li>
                    <li>2. Click on any highlighted tile to move</li>
                    <li>3. Switch between units freely</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <CombatLog />
      </Show>

      <div class="panel-game">
        <h4 class="font-fantasy text-game-gold text-sm mb-3">Legend</h4>
        <div class="space-y-1.5 text-xs">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-blue-500/50 border border-blue-400 flex-shrink-0" />
            <span class="break-words">Movement Range</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-red-500/50 border border-red-400 flex-shrink-0" />
            <span class="break-words">Attack Range</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-green-500/50 border border-green-400 flex-shrink-0" />
            <span class="break-words">Path Preview</span>
          </div>
        </div>
      </div>

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
          <div class="flex items-center gap-3">
            <button
              onClick={() => returnToMenu()}
              class="flex items-center justify-center w-9 h-9 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Retour au menu"
            >
              <ArrowLeft class="w-4 h-4 text-white" />
            </button>
            <h1 class="font-display text-white text-lg sm:text-xl tracking-wide">
              DnDiscord
            </h1>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm transition-colors"
              onClick={() => restartGame()}
            >
              <RotateCcw class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Recommencer</span>
            </button>
          </div>
        </header>

        {/* Main Game Area */}
        <div class="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Left Panel - Unit Info */}
          <aside class="hidden lg:flex lg:w-72 xl:w-80 lg:min-w-[280px] lg:max-w-[400px] p-3 xl:p-4 flex-col gap-4 overflow-y-auto bg-game-darker/50">
            {renderLeftPanelContent()}
          </aside>

          {/* Center - Game Canvas */}
          <main class="flex-1 relative min-w-0">
            <GameCanvas />

            {/* Dialogue bubbles overlay (positioned above canvas) */}
            <DialogueOverlay />

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

            {/* Game Phase Indicator */}
            <div class="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 max-w-[calc(100%-1rem)] sm:max-w-[calc(100%-2rem)]">
              <Show when={gameState.dungeon}>
                <div class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold bg-purple-600/80 text-white whitespace-nowrap">
                  🏰 Salle {(gameState.dungeon?.currentRoomIndex ?? 0) + 1}/
                  {gameState.dungeon?.totalRooms}
                </div>
              </Show>
              <div
                class={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap ${
                  gameState.phase === GamePhase.COMBAT_PREPARATION
                    ? "bg-amber-600/80 text-white"
                    : gameState.phase === GamePhase.FREE_ROAM
                      ? "bg-blue-600/80 text-white"
                      : gameState.phase === GamePhase.PLAYER_TURN
                        ? "bg-green-600/80 text-white"
                        : gameState.phase === GamePhase.ENEMY_TURN
                          ? "bg-red-600/80 text-white"
                          : "bg-gray-600/80 text-white"
                }`}
              >
                {getPhaseText(gameState.phase)}
              </div>
              {/* Bouton Prêt - Phase de préparation */}
              <Show when={gameState.phase === GamePhase.COMBAT_PREPARATION}>
                <button
                  class="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold bg-game-gold text-game-darker hover:bg-amber-400 transition shadow-lg whitespace-nowrap"
                  onClick={() => startCombatFromPreparation()}
                >
                  Prêt
                </button>
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

            {/* Mobile Drawer Toggles */}
            <div class="lg:hidden absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <button
                class="pointer-events-auto px-3 py-2 rounded-lg border border-white/20 bg-game-dark/85 backdrop-blur text-xs text-white font-medium shadow-lg"
                onClick={toggleLeftDrawer}
              >
                {leftDrawerOpen() ? "Fermer infos" : "Infos"}
              </button>
              <button
                class="pointer-events-auto px-3 py-2 rounded-lg border border-white/20 bg-game-dark/85 backdrop-blur text-xs text-white font-medium shadow-lg"
                onClick={toggleRightDrawer}
              >
                {rightDrawerOpen() ? "Fermer journal" : "Journal"}
              </button>
            </div>

            {/* Controls Help */}
            <div class="absolute left-3 sm:left-4 bottom-20 sm:bottom-4 z-10 panel-game text-xs w-[min(16rem,calc(100vw-1.5rem))] lg:w-auto lg:max-w-xs">
              <h4 class="font-semibold text-game-gold mb-3">Controls</h4>
              <ul class="space-y-1.5 text-gray-400 lg:hidden">
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0">👆</span>
                  <span>
                    <span class="text-gray-300 font-medium">Tap</span> - Select
                    unit / Move / Attack
                  </span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0">✌️</span>
                  <span>
                    <span class="text-gray-300 font-medium">Drag</span> - Rotate
                    / pan camera
                  </span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0">🤏</span>
                  <span>
                    <span class="text-gray-300 font-medium">Pinch</span> - Zoom
                    in/out
                  </span>
                </li>
              </ul>
              <ul class="space-y-1.5 text-gray-400 hidden lg:block">
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0">🖱️</span>
                  <span>
                    <span class="text-gray-300 font-medium">Left Click</span> -
                    Select unit / Move / Attack
                  </span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0">🖱️</span>
                  <span>
                    <span class="text-gray-300 font-medium">Right Drag</span> -
                    Rotate camera
                  </span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="flex-shrink-0">🖱️</span>
                  <span>
                    <span class="text-gray-300 font-medium">Scroll</span> - Zoom
                    in/out
                  </span>
                </li>
              </ul>
            </div>

            {/* Reset View Button */}
            <div class="absolute bottom-4 right-3 sm:right-4 z-20 pr-safe-right pb-safe-bottom">
              <button
                class="btn-game text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-2"
                onClick={() => resetCamera()}
                title="Reset camera to default view"
              >
                <span>🔄</span>
                <span>Reset View</span>
              </button>
            </div>
          </main>

          {/* Right Panel - Combat Log or Free Roam Info */}
          <aside class="hidden lg:flex lg:w-80 xl:w-96 lg:min-w-[320px] lg:max-w-[480px] p-3 xl:p-4 flex-col gap-4 overflow-y-auto bg-game-darker/50">
            {renderRightPanelContent()}
          </aside>

          {/* Mobile Drawers */}
          <div class="lg:hidden absolute inset-0 z-40 pointer-events-none">
            <Show when={leftDrawerOpen() || rightDrawerOpen()}>
              <button
                class="absolute inset-0 bg-black/60 pointer-events-auto"
                onClick={closeDrawers}
                aria-label="Fermer les panneaux"
              />
            </Show>

            <div
              class={`absolute inset-y-0 left-0 w-[min(86vw,360px)] bg-game-darker/95 backdrop-blur border-r border-white/10 p-3 flex flex-col gap-3 overflow-y-auto transition-transform duration-300 pointer-events-auto ${
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
              class={`absolute inset-y-0 right-0 w-[min(88vw,400px)] bg-game-darker/95 backdrop-blur border-l border-white/10 p-3 flex flex-col gap-3 overflow-y-auto transition-transform duration-300 pointer-events-auto ${
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
      </div>
    </Show>
  );
};

function getPhaseText(phase: GamePhase): string {
  switch (phase) {
    case GamePhase.SETUP:
      return "⏳ Setting up...";
    case GamePhase.COMBAT_PREPARATION:
      return "⚔️ Phase de préparation";
    case GamePhase.PLAYER_TURN:
      return "🟢 Your Turn";
    case GamePhase.ENEMY_TURN:
      return "🔴 Enemy Turn";
    case GamePhase.ANIMATION:
      return "⌛ Animating...";
    case GamePhase.GAME_OVER:
      return "🏁 Game Over";
    case GamePhase.FREE_ROAM:
      return "🗺️ Free Roam Mode";
    default:
      return phase;
  }
}

export default BoardGame;
