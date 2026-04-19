import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import axios from "axios";
import { MapService } from "../map.service";

vi.mock("axios", () => {
  const m = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return { default: m, ...m };
});

const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// Minimal localStorage stub — the vite.config runs tests in a node env where
// globalThis.localStorage isn't defined, but the service reads a token from it.
beforeAll(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
});

describe("MapService URL construction", () => {
  beforeEach(() => {
    localStorage.setItem("token", "test-token");
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.post.mockResolvedValue({ data: { id: "new-map" } });
    mockedAxios.put.mockResolvedValue({ data: { id: "updated" } });
    mockedAxios.delete.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("list calls GET /api/campaigns/{id}/maps with auth header", async () => {
    await MapService.list("campaign-abc");
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    const [url, opts] = mockedAxios.get.mock.calls[0];
    expect(url).toContain("/api/campaigns/campaign-abc/maps");
    expect(opts.headers.Authorization).toBe("Bearer test-token");
  });

  it("get calls GET /api/campaigns/{id}/maps/{mapId}", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { id: "m1" } });
    await MapService.get("camp-1", "map-xyz");
    const [url] = mockedAxios.get.mock.calls[0];
    expect(url).toContain("/api/campaigns/camp-1/maps/map-xyz");
  });

  it("create POSTs to /api/campaigns/{id}/maps with body", async () => {
    await MapService.create("camp-1", { name: "Cave", data: "{}" });
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxios.post.mock.calls[0];
    expect(url).toContain("/api/campaigns/camp-1/maps");
    expect(body).toEqual({ name: "Cave", data: "{}" });
  });

  it("update PUTs to /api/campaigns/{id}/maps/{mapId} with partial body", async () => {
    await MapService.update("camp-1", "map-xyz", { name: "Renamed" });
    const [url, body] = mockedAxios.put.mock.calls[0];
    expect(url).toContain("/api/campaigns/camp-1/maps/map-xyz");
    expect(body).toEqual({ name: "Renamed" });
  });

  it("remove DELETEs /api/campaigns/{id}/maps/{mapId}", async () => {
    await MapService.remove("camp-1", "map-xyz");
    const [url] = mockedAxios.delete.mock.calls[0];
    expect(url).toContain("/api/campaigns/camp-1/maps/map-xyz");
  });
});
