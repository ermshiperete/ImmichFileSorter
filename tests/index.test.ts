import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const baseUrl = "http://localhost:2283";
const apiKey = "test-api-key";

function createMockAsset(id: string, fileName: string, fileCreatedAt: string) {
  return {
    id,
    originalFileName: fileName,
    type: "IMAGE" as const,
    fileCreatedAt,
  };
}

describe("CLI integration", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints error when album not found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: "1", albumName: "Other", assetCount: 0 }],
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI(["--url", baseUrl, "--api-key", apiKey, "--album", "Missing"]);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Album 'Missing' not found"));
  });

  it("prints error when album has no images", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 1 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assets: { items: [{ id: "v1", originalFileName: "v.mp4", type: "VIDEO" }], hasNextPage: false } }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI(["--url", baseUrl, "--api-key", apiKey, "--album", "Test"]);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("no images"));
  });

  it("dry-run prints planned changes without API writes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 2 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:00+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/albums`, expect.any(Object));
    expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/search/metadata`, expect.any(Object));
  });

  it("force mode applies timestamp updates", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 2 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:00+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
      "--force",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const calls = mockFetch.mock.calls;
    expect(calls[2]).toEqual([
      `${baseUrl}/api/assets/1`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:00+02:00",
          fileCreatedAt: "2024-01-01T10:00:00+02:00",
          fileModifiedAt: "2024-01-01T10:00:00+02:00",
        }),
      }),
    ]);
    expect(calls[3]).toEqual([
      `${baseUrl}/api/assets/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:01+02:00",
          fileCreatedAt: "2024-01-01T10:00:01+02:00",
          fileModifiedAt: "2024-01-01T10:00:01+02:00",
        }),
      }),
    ]);
  });

  it("uses custom increment", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 2 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:00+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
      "--increment", "5",
      "--force",
    ]);

    expect(exitCode).toBe(0);
    const calls = mockFetch.mock.calls;
    expect(calls[3][1].body).toContain("2024-01-01T10:00:05+02:00");
  });

  it("dry-run is true by default", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 1 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "a.jpg", "2024-01-01T10:00:00+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("prints error on API failure during force mode", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 0 }],
    });
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
      "--force",
    ]);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Network error"));
  });

  it("skips images with a different timestamp", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 3 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:05+02:00"),
            createMockAsset("3", "IMG0003.jpg", "2024-01-01T10:00:05+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
      "--force",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const calls = mockFetch.mock.calls;
    expect(calls[2]).toEqual([
      `${baseUrl}/api/assets/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:05+02:00",
          fileCreatedAt: "2024-01-01T10:00:05+02:00",
          fileModifiedAt: "2024-01-01T10:00:05+02:00",
        }),
      }),
    ]);
    expect(calls[3]).toEqual([
      `${baseUrl}/api/assets/3`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:06+02:00",
          fileCreatedAt: "2024-01-01T10:00:06+02:00",
          fileModifiedAt: "2024-01-01T10:00:06+02:00",
        }),
      }),
    ]);
  });

  it("dry-run skips images with a different timestamp", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 3 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:05+02:00"),
            createMockAsset("3", "IMG0003.jpg", "2024-01-01T10:00:05+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("IMG0002.jpg")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("IMG0003.jpg")
    );
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining("IMG0001.jpg")
    );
  });

  it("updates a group at the beginning", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 3 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("3", "IMG0003.jpg", "2024-01-01T10:00:05+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
      "--force",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const calls = mockFetch.mock.calls;
    expect(calls[2]).toEqual([
      `${baseUrl}/api/assets/1`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:00+02:00",
          fileCreatedAt: "2024-01-01T10:00:00+02:00",
          fileModifiedAt: "2024-01-01T10:00:00+02:00",
        }),
      }),
    ]);
    expect(calls[3]).toEqual([
      `${baseUrl}/api/assets/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:01+02:00",
          fileCreatedAt: "2024-01-01T10:00:01+02:00",
          fileModifiedAt: "2024-01-01T10:00:01+02:00",
        }),
      }),
    ]);
  });

  it("updates a group in the middle", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 4 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:05+02:00"),
            createMockAsset("3", "IMG0003.jpg", "2024-01-01T10:00:05+02:00"),
            createMockAsset("4", "IMG0004.jpg", "2024-01-01T10:00:10+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
      "--force",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const calls = mockFetch.mock.calls;
    expect(calls[2]).toEqual([
      `${baseUrl}/api/assets/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:05+02:00",
          fileCreatedAt: "2024-01-01T10:00:05+02:00",
          fileModifiedAt: "2024-01-01T10:00:05+02:00",
        }),
      }),
    ]);
    expect(calls[3]).toEqual([
      `${baseUrl}/api/assets/3`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:06+02:00",
          fileCreatedAt: "2024-01-01T10:00:06+02:00",
          fileModifiedAt: "2024-01-01T10:00:06+02:00",
        }),
      }),
    ]);
  });

  it("updates multiple groups", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 6 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("3", "IMG0003.jpg", "2024-01-01T10:00:05+02:00"),
            createMockAsset("4", "IMG0004.jpg", "2024-01-01T10:00:05+02:00"),
            createMockAsset("5", "IMG0005.jpg", "2024-01-01T10:00:10+02:00"),
            createMockAsset("6", "IMG0006.jpg", "2024-01-01T10:00:10+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
      "--force",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(8);
    const calls = mockFetch.mock.calls;
    expect(calls[2]).toEqual([
      `${baseUrl}/api/assets/1`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:00+02:00",
          fileCreatedAt: "2024-01-01T10:00:00+02:00",
          fileModifiedAt: "2024-01-01T10:00:00+02:00",
        }),
      }),
    ]);
    expect(calls[3]).toEqual([
      `${baseUrl}/api/assets/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:01+02:00",
          fileCreatedAt: "2024-01-01T10:00:01+02:00",
          fileModifiedAt: "2024-01-01T10:00:01+02:00",
        }),
      }),
    ]);
    expect(calls[4]).toEqual([
      `${baseUrl}/api/assets/3`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:07+02:00",
          fileCreatedAt: "2024-01-01T10:00:07+02:00",
          fileModifiedAt: "2024-01-01T10:00:07+02:00",
        }),
      }),
    ]);
    expect(calls[5]).toEqual([
      `${baseUrl}/api/assets/4`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:08+02:00",
          fileCreatedAt: "2024-01-01T10:00:08+02:00",
          fileModifiedAt: "2024-01-01T10:00:08+02:00",
        }),
      }),
    ]);
    expect(calls[6]).toEqual([
      `${baseUrl}/api/assets/5`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:14+02:00",
          fileCreatedAt: "2024-01-01T10:00:14+02:00",
          fileModifiedAt: "2024-01-01T10:00:14+02:00",
        }),
      }),
    ]);
    expect(calls[7]).toEqual([
      `${baseUrl}/api/assets/6`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          dateTimeOriginal: "2024-01-01T10:00:15+02:00",
          fileCreatedAt: "2024-01-01T10:00:15+02:00",
          fileModifiedAt: "2024-01-01T10:00:15+02:00",
        }),
      }),
    ]);
  });

  it("prints message when no groups of 2+ with same timestamp exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "1", albumName: "Test", assetCount: 3 }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assets: {
          items: [
            createMockAsset("1", "IMG0001.jpg", "2024-01-01T10:00:00+02:00"),
            createMockAsset("2", "IMG0002.jpg", "2024-01-01T10:00:05+02:00"),
            createMockAsset("3", "IMG0003.jpg", "2024-01-01T10:00:10+02:00"),
          ],
          hasNextPage: false,
        },
      }),
    });

    const { runCLI } = await import("../src/index");
    const exitCode = await runCLI([
      "--url", baseUrl,
      "--api-key", apiKey,
      "--album", "Test",
    ]);

    expect(exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("No groups of 2+ images")
    );
  });
});
