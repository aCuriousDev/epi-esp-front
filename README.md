# Frontend for DNDiscord project

SolidJS/TypeScript frontend running as a Discord Activity (iframe). Uses BabylonJS for 3D rendering.

## Setup

```sh
cd dndiscord-esp
npm install
```

## Dev

```sh
npm run dev              # Vite dev server on localhost:3000
npm run dev:tunnel       # Cloudflare tunnel for Discord Activity testing
```

By default the frontend expects the backend on `http://localhost:5054`. If you run the backend on a different port, set `VITE_API_URL` (e.g. `VITE_API_URL=http://localhost:5261 npm run dev`).

## Build

```sh
npm run build            # typecheck + vite build
npm run typecheck        # tsc only
npm run test             # vitest (pure TS logic)
```

## 3D engine architecture

Everything 3D lives under `dndiscord-esp/src/engine/`.

- `BabylonEngine.ts` — orchestrator. Owns the engine, scene, modules, renderers. Subscribes to the graphics store and mirrors changes into the pipeline in one frame.
- `ModelLoader.ts` — glTF loading via `LoadAssetContainerAsync` + `instantiateModelsToScene`. Templates live off-scene in `AssetContainer`s; instances own their materials and can be disposed without corrupting the template.
- `SceneResetManager.ts` — single owner of per-map lifecycle. Call `resetForNewMap()` before loading a new map; it pauses ambient VFX, disposes tracked instances/lights/particles, and renders one clean frame. Call `finishLoad()` after the new map is on screen to resume ambient.
- `setup/SceneSetup.ts` — camera + base lights; `setShadowResolution(res)` rebuilds the shadow generator live; `setShadowsEnabled(on)` toggles `scene.shadowsEnabled`.
- `setup/PostProcessingSetup.ts` — `DefaultRenderingPipeline` wrapper. `applyEffects(effects)` flips each effect on/off; combat-mode tuning overlays bloom/vignette values when active.
- `managers/LightManager.ts` — materializes `SavedMapData.lights[]` into mesh + `PointLight` + particle + flicker observer. Everything registered with `SceneResetManager`.
- `vfx/VFXManager.ts` — ambient particles, spell/impact VFX. `pauseAmbient`/`resumeAmbient`/`setAmbientDensity` hooks are called by the engine when graphics settings change.
- `debug/DebugController.ts` — F9 Inspector + `setWireframe`, `setBoundingBoxes`, `setCollisionCells`, `showInspector`.
- `debug/FpsOverlay.ts` — DOM overlay (fixed-position div, no Babylon GUI) showing FPS, frame time, active mesh count.
- `quality/QualityPresets.ts` — low/medium/high/ultra data tables for shadow res, hardware scaling, particle density and effect toggles.

### Scene-reset lifecycle

Restart and map swap go through a single deterministic path. Never rely on "detect stores cleared" side-effects or name-prefix mesh filtering:

```
BoardGame.restartGame()
  → await clearEngineState()           // GameCanvas
  → await engine.clearAll()             // BabylonEngine
      → await SceneResetManager.resetForNewMap()
          → VFXManager.pauseAmbient()
          → dispose tracked particles + instances + lights
          → render one empty frame
  → clearUnits/clearTiles/resetGameState (stores)
  → await startGame(...)                // populates stores
  → tiles effect fires in GameCanvas → engine.createGrid(...)
      → GridRenderer.createGrid
      → LightManager.materialize(savedMap.lights)
      → SceneResetManager.finishLoad() → VFXManager.resumeAmbient()
```

If you add something that lives only for one map (a dynamic mesh, a new light, a map-scoped particle system), hand it to `SceneResetManager.trackMesh/trackLight/trackParticles` at creation time so the reset cycle cleans it up for you.

## Graphics & debug settings

User preferences persist in localStorage under `dnd-graphics-settings` via `src/stores/graphics.store.ts`.

- **Preset**: low / medium / high / ultra / custom. Selecting a preset overwrites every tunable; manually toggling anything drops the settings into `custom`.
- **Effects**: bloom, FXAA, vignette, chromatic aberration, glow layer, ambient particles, shadows. All live.
- **Shadow resolution**: 512 / 1024 / 2048 / 4096. Rebuilds the `ShadowGenerator` on change.
- **Hardware scaling**: 1.5x (fastest, softest) → 0.5x (sharpest, slowest). Calls `engine.setHardwareScalingLevel`.
- **Debug overlays**: FPS meter (DOM), wireframe, bounding boxes, collision cells (single `LineSystem` draw). Plus an "Ouvrir l'inspecteur Babylon" button and the F9 shortcut.

UI surface: **Paramètres → Graphique** (`src/pages/SettingsPage.tsx`).

## Map editor

`src/pages/MapEditor.tsx` is the orchestrator. Supporting modules:

- `src/components/map-editor/types.ts` — `MapAsset`, `AssetCategory`, `StackedAsset`
- `src/components/map-editor/PaletteData.ts` — `CHARACTER_ASSETS`, `ENEMY_ASSETS`, `ASSET_CATEGORIES` (built from `src/config/assetPacks.ts`)
- `src/components/map-editor/rotation.ts` — `applyRotationYDegrees`, `setRotationYRadians` (the single place that handles the glTF quaternion → Euler dance)
- `src/config/assetFavorites.ts` — ~70 curated items preloaded into ModelLoader on editor mount so the first drop is instant

## Lights in saved maps

`SavedMapData` is now versioned (`version: 2`) and includes `lights: SavedLightData[]`. `loadMap()` runs `migrateMap()` so pre-existing v1 payloads transparently pick up `lights: []`.

Presets live in `src/config/lightPresets.ts` (`torch`, `lantern`, `magical_orb`). Each entry declares mesh path, Y offset, colour, intensity, range, flicker flag, and particle kind. `LightManager.materialize(lights)` is called from `BabylonEngine.createGrid` when a map with lights is loaded — no manual wiring needed at callsites.

## CI/CD

- **CI**: GitHub Actions (`.github/workflows/ci.yml`) -- typecheck + build on push/PR to `main` and `dev`
- **CD**: Dokploy auto-deploy via GitHub App on push to configured branches
- **Cross-platform note**: `package-lock.json` generated on Windows lacks Linux-specific rollup binaries. CI uses `rm -f package-lock.json && npm install` as workaround. Dockerfile copies only `package.json` (not lockfile) for the same reason.
