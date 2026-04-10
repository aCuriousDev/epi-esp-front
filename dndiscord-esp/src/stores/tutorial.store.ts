import { createStore } from "solid-js/store";

const STORAGE_KEY = "dndiscord_tutorial_v1";

type TutorialPersisted = {
  completed: boolean;
};

export type TutorialState = {
  active: boolean;
  stepIndex: number;
  completed: boolean;
  /** If true, tutorial was explicitly started by user (test mode). */
  testMode: boolean;
};

function loadPersisted(): TutorialPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: false };
    const parsed = JSON.parse(raw);
    return { completed: !!parsed?.completed };
  } catch {
    return { completed: false };
  }
}

function persistCompleted(completed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed }));
  } catch {
    // ignore
  }
}

const persisted = loadPersisted();

export const [tutorialState, setTutorialState] = createStore<TutorialState>({
  active: false,
  stepIndex: 0,
  completed: persisted.completed,
  testMode: false,
});

export function startTutorial(testMode = false): void {
  setTutorialState({
    active: true,
    stepIndex: 0,
    completed: tutorialState.completed,
    testMode,
  });
}

export function stopTutorial(markCompleted: boolean): void {
  setTutorialState("active", false);
  setTutorialState("testMode", false);
  if (markCompleted) {
    setTutorialState("completed", true);
    persistCompleted(true);
  }
}

export function restartTutorialTest(): void {
  // Keep completion as-is; this is for replay/testing.
  setTutorialState({
    active: true,
    stepIndex: 0,
    completed: tutorialState.completed,
    testMode: true,
  });
}

export function nextTutorialStep(maxSteps: number): void {
  const next = Math.min(maxSteps - 1, tutorialState.stepIndex + 1);
  setTutorialState("stepIndex", next);
}

export function prevTutorialStep(): void {
  const prev = Math.max(0, tutorialState.stepIndex - 1);
  setTutorialState("stepIndex", prev);
}

