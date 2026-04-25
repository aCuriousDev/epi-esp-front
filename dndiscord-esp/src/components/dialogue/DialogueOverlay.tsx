import { Component, For, Show, createSignal, onCleanup, createEffect } from "solid-js";
import { Vector3, Matrix, AbstractMesh } from "@babylonjs/core";
import { PlayerBubble } from "./PlayerBubble";
import { DmOverlay } from "./DmOverlay";
import { dialogueState } from "../../stores/dialogue.store";
import { gridToWorld } from "../../game/utils/GridUtils";
import { units } from "../../game/stores/UnitsStore";
import { getEngine, isEngineReady } from "../GameCanvas";

// ============================================
// Types
// ============================================

interface ScreenPos {
  x: number;
  y: number;
  offScreen: boolean;
}

// Height above the mesh to place the bubble
const BUBBLE_Y_OFFSET = 2.0;

// ============================================
// Component
// ============================================

export const DialogueOverlay: Component = () => {
  const [positions, setPositions] = createSignal<Record<string, ScreenPos>>({});
  let observer: any = null;

  createEffect(() => {
    // isEngineReady() is a reactive signal — re-runs this effect when engine initialises.
    // Without it, getEngine() returns null on first mount and the observer is never registered.
    if (!isEngineReady()) return;
    const eng = getEngine();
    if (!eng) return;

    const scene = eng.getScene();

    if (observer) {
      scene.onBeforeRenderObservable.remove(observer);
    }

    observer = scene.onBeforeRenderObservable.add(() => {
      const bubbles = dialogueState.bubbles;
      const ids = Object.keys(bubbles);
      if (ids.length === 0) {
        setPositions({});
        return;
      }

      const camera = scene.activeCamera;
      if (!camera) return;

      const engine = scene.getEngine();
      // Use CSS canvas dimensions, not internal render dimensions.
      // getRenderWidth/Height reflect hardwareScalingLevel (0.5–1.5) and diverge
      // from CSS pixels — Vector3.Project output would be offset by that factor.
      const canvas = engine.getRenderingCanvas();
      const width = canvas?.clientWidth ?? engine.getRenderWidth();
      const height = canvas?.clientHeight ?? engine.getRenderHeight();
      const vp = camera.viewport.toGlobal(width, height);
      const identity = Matrix.Identity();
      const viewProjection = scene.getTransformMatrix();

      const next: Record<string, ScreenPos> = {};

      for (const unitId of ids) {
        // Try to read the actual mesh position first (smooth during animations)
        const mesh = scene.getMeshByName(`unit_${unitId}`) as AbstractMesh | null;
        let wx: number, wy: number, wz: number;

        if (mesh && !mesh.isDisposed()) {
          // Use the live mesh position — follows Babylon animation frames
          wx = mesh.position.x;
          wy = mesh.position.y + BUBBLE_Y_OFFSET;
          wz = mesh.position.z;
        } else {
          // Fallback to grid→world conversion
          const unit = units[unitId];
          if (!unit) continue;
          const world = gridToWorld(unit.position);
          wx = world.x;
          wy = world.y + BUBBLE_Y_OFFSET;
          wz = world.z;
        }

        const worldVec = new Vector3(wx, wy, wz);
        const projected = Vector3.Project(worldVec, identity, viewProjection, vp);

        next[unitId] = {
          x: projected.x,
          y: projected.y,
          offScreen:
            projected.z < 0 ||
            projected.z > 1 ||
            projected.x < -50 ||
            projected.x > width + 50 ||
            projected.y < -50 ||
            projected.y > height + 50,
        };
      }

      setPositions(next);
    });
  });

  onCleanup(() => {
    if (observer) {
      const eng = getEngine();
      if (eng) {
        eng.getScene().onBeforeRenderObservable.remove(observer);
      }
      observer = null;
    }
  });

  return (
    <>
      {/* DM overlay */}
      <Show when={dialogueState.dm.phase !== "hidden"}>
        <DmOverlay text={dialogueState.dm.text} phase={dialogueState.dm.phase} />
      </Show>

      {/* Player bubbles — absolute positioned over canvas */}
      <For each={Object.entries(dialogueState.bubbles)}>
        {([unitId, entry]) => {
          const pos = () => positions()[unitId];
          return (
            <Show when={pos() && !pos()!.offScreen}>
              <div
                class="absolute pointer-events-none"
                style={{
                  left: `${pos()!.x}px`,
                  top: `${pos()!.y}px`,
                  transform: "translate(-50%, -100%)",
                  "z-index": "40",
                }}
              >
                <PlayerBubble
                  text={entry.text}
                  playerName={entry.playerName}
                  color={entry.color}
                  phase={entry.phase === "hidden" ? "out" : entry.phase}
                />
              </div>
            </Show>
          );
        }}
      </For>
    </>
  );
};
