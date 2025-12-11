import { Component, Show, onMount, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { GameCanvas, isEngineReady, resetCamera, clearEngineState } from '../components/GameCanvas';
import { UnitInfoPanel } from '../components/UnitInfoPanel';
import { CombatLog } from '../components/CombatLog';
import { TurnOrderDisplay } from '../components/TurnOrderDisplay';
import { GameOverScreen } from '../components/GameOverScreen';
import { ModeSelectionScreen } from '../components/ModeSelectionScreen';
import { gameState, startGame, getCurrentMode, resetGameState, clearUnits, clearTiles } from '../game';
import { GamePhase, AppPhase, GameMode } from '../types';

const BoardGame: Component = () => {
  const navigate = useNavigate();
  const [appPhase, setAppPhase] = createSignal<AppPhase>(AppPhase.MODE_SELECTION);
  
  onMount(() => {
    console.log('[BoardGame] Component mounted, showing mode selection');
  });
  
  // Functions to manage app phase
  const startMode = (mode: GameMode) => {
    console.log('[BoardGame] ========== STARTING MODE:', mode, '==========');
    console.log('[BoardGame] Setting appPhase to IN_GAME');
    setAppPhase(AppPhase.IN_GAME);
    
    // Wait for engine to be ready before starting game
    const checkEngine = () => {
      if (isEngineReady()) {
        console.log('[BoardGame] Engine is ready, starting game in', mode, 'mode');
        // Add a small delay to ensure the engine and render loop are fully settled
        // This prevents the 3D models from being out of sync on first load
        setTimeout(() => {
          console.log('[BoardGame] Initializing game now...');
          startGame(mode);
          console.log('[BoardGame] Game initialization complete');
        }, 150);
      } else {
        console.log('[BoardGame] Engine not ready, checking again...');
        setTimeout(checkEngine, 100);
      }
    };
    checkEngine();
  };
  
  const returnToMenu = () => {
    console.log('[BoardGame] ========== RETURNING TO MENU ==========');
    console.log('[BoardGame] Clearing engine state...');
    
    // FIRST: Clear the 3D engine (removes all meshes)
    clearEngineState();
    
    console.log('[BoardGame] Clearing units, tiles, and game state...');
    // THEN: Clear all game state stores
    clearUnits();
    clearTiles();
    resetGameState();
    
    console.log('[BoardGame] All state cleared, navigating to home');
    // Navigate back to main menu
    navigate('/');
  };
  
  const restartGame = () => {
    const currentMode = getCurrentMode();
    console.log('[BoardGame] ========== RESTARTING GAME IN', currentMode, 'MODE ==========');
    
    // For restart, we DON'T dispose the engine - we just clear game objects and reinitialize
    // The GameCanvas effects will handle creating new meshes when the stores are repopulated
    console.log('[BoardGame] Clearing game state stores...');
    clearUnits();
    clearTiles();
    resetGameState();
    
    // Wait a bit for cleanup effects to process, then reinitialize
    setTimeout(() => {
      console.log('[BoardGame] Re-initializing game in', currentMode, 'mode...');
      startGame(currentMode);
      console.log('[BoardGame] Game restart complete');
    }, 100);
  };
  
  return (
    <Show
      when={appPhase() === AppPhase.IN_GAME}
      fallback={<ModeSelectionScreen onSelectMode={startMode} />}
    >
      <div class="w-full h-screen flex flex-col bg-game-darker overflow-hidden">
        {/* Header */}
        <header class="h-12 bg-game-dark/90 border-b border-game-gold/20 flex items-center justify-between px-4">
          <h1 class="font-fantasy text-game-gold text-xl">
            ⚔️ DnDiscord Combat POC
          </h1>
          <div class="flex items-center gap-4">
            <button
              class="btn-game text-sm py-1"
              onClick={() => restartGame()}
            >
              Restart
            </button>
            <button
              class="btn-game text-sm py-1 bg-gray-700 hover:bg-gray-600"
              onClick={() => returnToMenu()}
            >
              Return to Menu
            </button>
          </div>
        </header>
      
      {/* Main Game Area */}
      <div class="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Unit Info */}
        <aside class="w-80 min-w-[280px] max-w-[400px] p-4 flex flex-col gap-4 overflow-y-auto bg-game-darker/50">
          <Show when={getCurrentMode() === GameMode.COMBAT}>
            <TurnOrderDisplay />
          </Show>
          <UnitInfoPanel />
        </aside>
        
        {/* Center - Game Canvas */}
        <main class="flex-1 relative min-w-0">
          <GameCanvas />
          
          {/* Loading Overlay */}
          <Show when={!isEngineReady()}>
            <div class="absolute inset-0 bg-game-darker/95 flex items-center justify-center z-50">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-game-gold border-t-transparent mb-4"></div>
                <h2 class="font-fantasy text-2xl text-game-gold mb-2">Loading Assets</h2>
                <p class="text-gray-400 text-sm">Preparing 3D models and textures...</p>
              </div>
            </div>
          </Show>
          
          {/* Game Phase Indicator */}
          <div class="absolute top-4 left-1/2 -translate-x-1/2">
            <div class={`px-4 py-2 rounded-full text-sm font-semibold ${
              gameState.phase === GamePhase.FREE_ROAM
                ? 'bg-blue-600/80 text-white'
                : gameState.phase === GamePhase.PLAYER_TURN
                  ? 'bg-green-600/80 text-white'
                  : gameState.phase === GamePhase.ENEMY_TURN
                    ? 'bg-red-600/80 text-white'
                    : 'bg-gray-600/80 text-white'
            }`}>
              {getPhaseText(gameState.phase)}
            </div>
          </div>
          
          {/* Controls Help */}
          <div class="absolute bottom-4 left-4 panel-game text-xs max-w-xs">
            <h4 class="font-semibold text-game-gold mb-3">Controls</h4>
            <ul class="space-y-1.5 text-gray-400">
              <li class="flex items-start gap-2">
                <span class="flex-shrink-0">🖱️</span>
                <span><span class="text-gray-300 font-medium">Left Click</span> - Select unit / Move / Attack</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="flex-shrink-0">🖱️</span>
                <span><span class="text-gray-300 font-medium">Right Drag</span> - Rotate camera</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="flex-shrink-0">🖱️</span>
                <span><span class="text-gray-300 font-medium">Scroll</span> - Zoom in/out</span>
              </li>
            </ul>
          </div>
          
          {/* Reset View Button */}
          <div class="absolute bottom-4 right-4">
            <button
              class="btn-game text-sm py-2 px-4 flex items-center gap-2"
              onClick={() => resetCamera()}
              title="Reset camera to default view"
            >
              <span>🔄</span>
              <span>Reset View</span>
            </button>
          </div>
        </main>
        
        {/* Right Panel - Combat Log or Free Roam Info */}
        <aside class="w-96 min-w-[320px] max-w-[480px] p-4 flex flex-col gap-4 overflow-y-auto bg-game-darker/50">
          <Show 
            when={getCurrentMode() === GameMode.COMBAT}
            fallback={
              <div class="panel-game">
                <h3 class="font-fantasy text-game-gold text-lg mb-4">Free Roam Mode</h3>
                <div class="space-y-4 text-sm text-gray-300">
                  <p>
                    Explore the map freely without combat restrictions. 
                    Move your units anywhere to plan strategies and test formations.
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
          
          {/* Legend */}
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
          
          {/* Quick Stats - Only show in Combat mode */}
          <Show when={getCurrentMode() === GameMode.COMBAT}>
            <div class="panel-game">
              <h4 class="font-fantasy text-game-gold text-sm mb-3">Battle Stats</h4>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-blue-900/30 p-3 rounded">
                  <div class="text-gray-400 mb-1">Your Units</div>
                  <div class="text-2xl font-bold text-blue-400">
                    {Object.values(gameState.turnOrder ? gameState : { turnOrder: [] })
                      .flat()
                      .filter((id) => {
                        // Access units through the import
                        return true;
                      }).length > 0 ? '3' : '0'}
                  </div>
                </div>
                <div class="bg-red-900/30 p-3 rounded">
                  <div class="text-gray-400 mb-1">Enemies</div>
                  <div class="text-2xl font-bold text-red-400">
                    3
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </aside>
      </div>
      
        {/* Game Over Modal */}
        <GameOverScreen />
      </div>
    </Show>
  );
};

function getPhaseText(phase: GamePhase): string {
  switch (phase) {
    case GamePhase.SETUP: return '⏳ Setting up...';
    case GamePhase.PLAYER_TURN: return '🟢 Your Turn';
    case GamePhase.ENEMY_TURN: return '🔴 Enemy Turn';
    case GamePhase.ANIMATION: return '⌛ Animating...';
    case GamePhase.GAME_OVER: return '🏁 Game Over';
    case GamePhase.FREE_ROAM: return '🗺️ Free Roam Mode';
    default: return phase;
  }
}

export default BoardGame;
