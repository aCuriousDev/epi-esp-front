import { createSignal, onMount } from "solid-js";

const STORAGE_KEY = "dnd:lastCampaignId";

export function readLastCampaignId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function writeLastCampaignId(id: string): void {
  try {
    const trimmed = id.trim();
    if (trimmed.length === 0) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // Ignore: private mode / quota.
  }
}

export function clearLastCampaignId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Reactive accessor — reads localStorage once on mount.
 * Storage events from other tabs aren't relevant here (Discord is one tab).
 */
export function useLastCampaignId(): () => string | null {
  const [id, setId] = createSignal<string | null>(null);
  onMount(() => setId(readLastCampaignId()));
  return id;
}
