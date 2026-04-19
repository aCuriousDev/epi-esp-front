import { describe, it, expect } from "vitest";
import { applyMapSwitched } from "../mapSwitched";

describe("applyMapSwitched", () => {
  it("returns parsed shape for a well-formed payload", () => {
    const result = applyMapSwitched({
      mapId: "m-123",
      name: "Crypt",
      data: JSON.stringify({ id: "m-123", name: "Crypt", tiles: [] }),
    });
    expect(result).not.toBeNull();
    expect(result!.mapId).toBe("m-123");
    expect(result!.name).toBe("Crypt");
    expect(result!.parsedData).toEqual({ id: "m-123", name: "Crypt", tiles: [] });
  });

  it("unwraps `.payload` when the event is wrapped in a GameMessage envelope", () => {
    const result = applyMapSwitched({
      payload: { mapId: "m-1", name: "X", data: "{}" },
    });
    expect(result?.mapId).toBe("m-1");
  });

  it("returns null when mapId is missing", () => {
    expect(
      applyMapSwitched({ name: "X", data: "{}" }),
    ).toBeNull();
  });

  it("returns null when data is missing or empty", () => {
    expect(applyMapSwitched({ mapId: "m", name: "X" })).toBeNull();
    expect(applyMapSwitched({ mapId: "m", name: "X", data: "" })).toBeNull();
  });

  it("returns null when data is malformed JSON (does not throw)", () => {
    const result = applyMapSwitched({
      mapId: "m",
      name: "X",
      data: "{not valid json",
    });
    expect(result).toBeNull();
  });

  it("falls back to a placeholder name when the server sends an empty one", () => {
    const result = applyMapSwitched({
      mapId: "m",
      name: "",
      data: "{}",
    });
    expect(result?.name).toBe("Nouvelle carte");
  });

  it("returns null for non-object / null / undefined inputs", () => {
    expect(applyMapSwitched(null)).toBeNull();
    expect(applyMapSwitched(undefined)).toBeNull();
    expect(applyMapSwitched("string" as any)).toBeNull();
    expect(applyMapSwitched(42 as any)).toBeNull();
  });
});
