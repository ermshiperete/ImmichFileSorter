import { describe, it, expect, vi, beforeEach } from "vitest";

const baseUrl = "http://localhost:2283";
const apiKey = "test-api-key";

describe("Immich API client", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("fetchAlbums", () => {
    it("fetches albums with correct headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const { fetchAlbums } = await import("../src/immich");
      await fetchAlbums(baseUrl, apiKey);

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/albums`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });
    });

    it("returns parsed albums on success", async () => {
      const albums = [{ albumName: "Test", assets: [] }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => albums,
      });

      const { fetchAlbums } = await import("../src/immich");
      const result = await fetchAlbums(baseUrl, apiKey);
      expect(result).toEqual(albums);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { fetchAlbums } = await import("../src/immich");
      await expect(fetchAlbums(baseUrl, apiKey)).rejects.toThrow();
    });
  });

  describe("findAlbumByName", () => {
    it("returns album matching exact name", async () => {
      const albums = [
        { id: "1", albumName: "A", assets: [] },
        { id: "2", albumName: "B", assets: [] },
      ];
      const { findAlbumByName } = await import("../src/immich");
      const result = findAlbumByName(albums, "B");
      expect(result).toEqual({ id: "2", albumName: "B", assets: [] });
    });

    it("returns undefined when no album matches", async () => {
      const albums = [{ id: "1", albumName: "A", assets: [] }];
      const { findAlbumByName } = await import("../src/immich");
      const result = findAlbumByName(albums, "B");
      expect(result).toBeUndefined();
    });
  });

  describe("searchAssetsByAlbumIds", () => {
    it("searches assets with albumIds in POST body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ assets: [{ id: "a1", originalFileName: "x.jpg", type: "IMAGE" }] }),
      });

      const { searchAssetsByAlbumIds } = await import("../src/immich");
      const result = await searchAssetsByAlbumIds(baseUrl, apiKey, ["album-1", "album-2"]);

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/search/metadata`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ albumIds: ["album-1", "album-2"] }),
      });
      expect(result).toHaveLength(1);
    });

    it("returns empty array when assets is missing", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { searchAssetsByAlbumIds } = await import("../src/immich");
      const result = await searchAssetsByAlbumIds(baseUrl, apiKey, ["album-1"]);
      expect(result).toEqual([]);
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const { searchAssetsByAlbumIds } = await import("../src/immich");
      await expect(searchAssetsByAlbumIds(baseUrl, apiKey, ["album-1"])).rejects.toThrow();
    });
  });

  describe("filterImages", () => {
    it("keeps only IMAGE type assets", async () => {
      const assets = [
        { id: "1", originalFileName: "a.jpg", type: "IMAGE" as const },
        { id: "2", originalFileName: "b.jpg", type: "VIDEO" as const },
        { id: "3", originalFileName: "c.jpg", type: "IMAGE" as const },
      ];
      const { filterImages } = await import("../src/immich");
      const result = filterImages(assets);
      expect(result).toHaveLength(2);
      expect(result.map((a: { id: string }) => a.id)).toEqual(["1", "3"]);
    });

    it("returns empty array for non-image assets", async () => {
      const assets = [
        { id: "1", originalFileName: "a.jpg", type: "VIDEO" as const },
      ];
      const { filterImages } = await import("../src/immich");
      const result = filterImages(assets);
      expect(result).toHaveLength(0);
    });
  });

  describe("updateAssetTimestamp", () => {
    it("sends PUT with all three timestamp fields", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1" }),
      });

      const { updateAssetTimestamp } = await import("../src/immich");
      await updateAssetTimestamp(baseUrl, apiKey, "asset-1", "2024-01-01T12:00:00+02:00");

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/assets/asset-1`,
        {
          method: "PUT",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateTimeOriginal: "2024-01-01T12:00:00+02:00",
            fileCreatedAt: "2024-01-01T12:00:00+02:00",
            fileModifiedAt: "2024-01-01T12:00:00+02:00",
          }),
        }
      );
    });

    it("preserves timezone offset in timestamps", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1" }),
      });

      const { updateAssetTimestamp } = await import("../src/immich");
      await updateAssetTimestamp(baseUrl, apiKey, "asset-1", "2024-06-15T10:30:00-05:00");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.dateTimeOriginal).toBe("2024-06-15T10:30:00-05:00");
      expect(callBody.fileCreatedAt).toBe("2024-06-15T10:30:00-05:00");
      expect(callBody.fileModifiedAt).toBe("2024-06-15T10:30:00-05:00");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const { updateAssetTimestamp } = await import("../src/immich");
      await expect(updateAssetTimestamp(baseUrl, apiKey, "missing", "2024-01-01T12:00:00+02:00")).rejects.toThrow();
    });
  });
});
