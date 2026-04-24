/**
 * Pure shape-validation + JSON parse for the `MapSwitched` SignalR event.
 *
 * Extracted from gameSync so it can be unit-tested without pulling in the
 * engine / store modules. Returns the parsed payload when valid, or null
 * when the payload is missing fields or the data blob is unparseable —
 * the caller must never trust malformed input to drive a scene reload.
 */

export interface MapSwitchedRaw {
  mapId?: unknown;
  name?: unknown;
  data?: unknown;
}

export interface MapSwitchedParsed {
  mapId: string;
  name: string;
  /** Parsed SavedMapData object — typed as unknown here to keep this module
   * free of engine types; the caller narrows via mapStorage helpers. */
  parsedData: unknown;
}

export function applyMapSwitched(raw: unknown): MapSwitchedParsed | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = (raw as { payload?: MapSwitchedRaw }).payload ?? (raw as MapSwitchedRaw);

  if (typeof payload.mapId !== "string" || payload.mapId.length === 0) return null;
  if (typeof payload.data !== "string" || payload.data.length === 0) return null;

  let parsedData: unknown;
  try {
    parsedData = JSON.parse(payload.data);
  } catch {
    return null;
  }

  return {
    mapId: payload.mapId,
    name: typeof payload.name === "string" && payload.name.length > 0
      ? payload.name
      : "Nouvelle carte",
    parsedData,
  };
}
