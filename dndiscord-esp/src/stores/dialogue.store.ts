import { createStore, produce } from "solid-js/store";
import { playBabbleSound } from "../game/audio/SoundIntegration";

// ============================================
// TYPES
// ============================================

export interface DialogueEntry {
  text: string;
  playerName: string;
  color: string;
  /** unit id in the 3D scene */
  unitId: string;
  /** phase: "in" → visible, "out" → fading out, "hidden" → gone */
  phase: "in" | "out" | "hidden";
}

export interface DmDialogue {
  text: string;
  phase: "in" | "out" | "hidden";
}

interface DialogueState {
  /** Keyed by unitId — one bubble per unit */
  bubbles: Record<string, DialogueEntry>;
  dm: DmDialogue;
}

// ============================================
// STORE
// ============================================

const [state, setState] = createStore<DialogueState>({
  bubbles: {},
  dm: { text: "", phase: "hidden" },
});

export { state as dialogueState };

// ============================================
// TIMERS
// ============================================

const bubbleTimers = new Map<string, number>();
let dmTimer: number | null = null;

const DEFAULT_DURATION = 4000; // ms
const FADE_OUT_DURATION = 400; // ms — must match CSS transition

// ============================================
// PLAYER BUBBLES
// ============================================

/**
 * Show (or update) a player dialogue bubble above a unit.
 * If a bubble already exists for this unit, resets the timer.
 */
export function showPlayerBubble(
  unitId: string,
  text: string,
  playerName: string,
  color: string,
  duration = DEFAULT_DURATION
): void {
  // Clear any existing timer for this unit
  const existing = bubbleTimers.get(unitId);
  if (existing != null) clearTimeout(existing);

  // Set or update the bubble  (phase "in" triggers fade-in CSS)
  setState("bubbles", unitId, {
    text,
    playerName,
    color,
    unitId,
    phase: "in",
  });

  // Animal Crossing–style babble voice (random pitch per character)
  const pitches: ('low' | 'mid' | 'high')[] = ['low', 'mid', 'high'];
  playBabbleSound(text, pitches[Math.abs(unitId.charCodeAt(0)) % 3]);

  // Schedule fade-out → hidden
  const timer = window.setTimeout(() => {
    setState("bubbles", unitId, "phase", "out");

    // After the CSS fade-out completes, remove
    const removeTimer = window.setTimeout(() => {
      setState(
        produce((s) => {
          delete s.bubbles[unitId];
        })
      );
      bubbleTimers.delete(unitId);
    }, FADE_OUT_DURATION);

    bubbleTimers.set(unitId, removeTimer);
  }, duration);

  bubbleTimers.set(unitId, timer);
}

// ============================================
// DM OVERLAY
// ============================================

/**
 * Show the DM overlay at the top of the screen.
 */
export function showDmMessage(text: string, duration = DEFAULT_DURATION): void {
  if (dmTimer != null) clearTimeout(dmTimer);

  setState("dm", { text, phase: "in" });

  // DM babble (low-pitched, authoritative)
  playBabbleSound(text, 'low');

  dmTimer = window.setTimeout(() => {
    setState("dm", "phase", "out");

    dmTimer = window.setTimeout(() => {
      setState("dm", { text: "", phase: "hidden" });
      dmTimer = null;
    }, FADE_OUT_DURATION);
  }, duration);
}

/**
 * Immediately clear all dialogue state.
 */
export function clearAllDialogues(): void {
  bubbleTimers.forEach((t) => clearTimeout(t));
  bubbleTimers.clear();
  if (dmTimer != null) {
    clearTimeout(dmTimer);
    dmTimer = null;
  }
  setState({ bubbles: {}, dm: { text: "", phase: "hidden" } });
}
