// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readLastCampaignId, writeLastCampaignId, clearLastCampaignId } from "../useLastCampaign";

describe("useLastCampaign storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns null when nothing is stored", () => {
    expect(readLastCampaignId()).toBeNull();
  });

  it("round-trips a campaign id", () => {
    writeLastCampaignId("camp-123");
    expect(readLastCampaignId()).toBe("camp-123");
  });

  it("clears the campaign id", () => {
    writeLastCampaignId("camp-456");
    clearLastCampaignId();
    expect(readLastCampaignId()).toBeNull();
  });

  it("writes nothing when id is empty or whitespace", () => {
    writeLastCampaignId("");
    expect(readLastCampaignId()).toBeNull();
    writeLastCampaignId("   ");
    expect(readLastCampaignId()).toBeNull();
  });

  it("returns null when storage throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    expect(readLastCampaignId()).toBeNull();
    spy.mockRestore();
  });
});
