import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ErrorSnapshot, ProjectStructure } from "../unity-client.js";

// ─── Mock fetch globally ───────────────────────────────────────────────────

function mockFetch(response: Partial<Response> & { body?: unknown }) {
  const { body, ...rest } = response;
  const resolved: Response = {
    ok: true,
    status: 200,
    json: async () => body,
    ...rest,
  } as unknown as Response;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resolved));
}

function mockFetchReject(error: Error) {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}

const HEALTH_OK = { status: "ok", port: 7300 };

const EMPTY_SNAPSHOT: ErrorSnapshot = {
  entries: [],
  isCompiling: false,
  isPlayMode: false,
  projectPath: "/project",
  unityVersion: "2022.3.22f1",
};

const SAMPLE_SNAPSHOT: ErrorSnapshot = {
  entries: [
    {
      id: "abc",
      errorType: 0,
      errorTypeString: "CompilationError",
      message: "CS0103: The name 'Foo' does not exist",
      stackTrace: "",
      filePath: "Assets/Scripts/MyScript.cs",
      lineNumber: 42,
      timestamp: "2026-05-05T10:00:00Z",
    },
  ],
  isCompiling: false,
  isPlayMode: false,
  projectPath: "/project",
  unityVersion: "2022.3.22f1",
};

// Re-import module after stubbing fetch — dynamic import to avoid hoisting
async function importClient() {
  // Vitest re-imports fresh module each time because of vi.resetModules
  return await import("../unity-client.js");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── assertUnityRunning (tested implicitly via exported functions) ──────────

describe("assertUnityRunning", () => {
  it("throws a descriptive Japanese error when fetch rejects (connection refused)", async () => {
    mockFetchReject(new TypeError("fetch failed"));
    const { getErrors } = await importClient();
    await expect(getErrors()).rejects.toThrow("Unity Editorに接続できません");
  });

  it("throws when health endpoint returns non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response)
    );
    const { getErrors } = await importClient();
    await expect(getErrors()).rejects.toThrow("Unity Editorに接続できません");
  });
});

// ─── getErrors ─────────────────────────────────────────────────────────────

describe("getErrors", () => {
  it("calls /errors and returns snapshot when no type given", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => EMPTY_SNAPSHOT } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getErrors } = await importClient();
    const result = await getErrors();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/errors"),
      expect.anything()
    );
    const url: string = fetchMock.mock.calls[1][0];
    expect(url).not.toContain("?type=");
    expect(result).toEqual(EMPTY_SNAPSHOT);
  });

  it("appends ?type=compilation when type='compilation'", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => EMPTY_SNAPSHOT } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getErrors } = await importClient();
    await getErrors("compilation");

    const url: string = fetchMock.mock.calls[1][0];
    expect(url).toContain("?type=compilation");
  });

  it("appends ?type=runtime when type='runtime'", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => EMPTY_SNAPSHOT } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getErrors } = await importClient();
    await getErrors("runtime");

    const url: string = fetchMock.mock.calls[1][0];
    expect(url).toContain("?type=runtime");
  });

  it("throws when /errors returns non-OK status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getErrors } = await importClient();
    await expect(getErrors()).rejects.toThrow("/errors が 500");
  });

  it("returns parsed snapshot data", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => SAMPLE_SNAPSHOT } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getErrors } = await importClient();
    const result = await getErrors();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].errorTypeString).toBe("CompilationError");
  });
});

// ─── getWarnings ───────────────────────────────────────────────────────────

describe("getWarnings", () => {
  it("calls /warnings and returns snapshot", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => EMPTY_SNAPSHOT } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getWarnings } = await importClient();
    const result = await getWarnings();

    const url: string = fetchMock.mock.calls[1][0];
    expect(url).toContain("/warnings");
    expect(result).toEqual(EMPTY_SNAPSHOT);
  });

  it("throws when /warnings returns non-OK status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getWarnings } = await importClient();
    await expect(getWarnings()).rejects.toThrow("/warnings が 404");
  });
});

// ─── clearErrors ───────────────────────────────────────────────────────────

describe("clearErrors", () => {
  it("POSTs to /clear and returns true on success", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ cleared: true }) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { clearErrors } = await importClient();
    const result = await clearErrors();

    expect(result).toBe(true);
    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("/clear");
    expect((opts as RequestInit).method).toBe("POST");
  });

  it("returns false when cleared is false", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ cleared: false }) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { clearErrors } = await importClient();
    expect(await clearErrors()).toBe(false);
  });

  it("throws when /clear returns non-OK status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 405, json: async () => ({}) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { clearErrors } = await importClient();
    await expect(clearErrors()).rejects.toThrow("/clear が 405");
  });
});

// ─── getProjectStructure ───────────────────────────────────────────────────

describe("getProjectStructure", () => {
  it("calls /structure and returns project structure", async () => {
    const structure: ProjectStructure = {
      assets: { name: "Assets", path: "Assets", children: [] },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => structure } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getProjectStructure } = await importClient();
    const result = await getProjectStructure();

    const url: string = fetchMock.mock.calls[1][0];
    expect(url).toContain("/structure");
    expect(result.assets.name).toBe("Assets");
  });

  it("throws when /structure returns non-OK status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => HEALTH_OK } as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { getProjectStructure } = await importClient();
    await expect(getProjectStructure()).rejects.toThrow("/structure が 500");
  });
});

// ─── fetchWithTimeout ──────────────────────────────────────────────────────

describe("fetch timeout", () => {
  it("wires AbortSignal into fetch and rejects when signal is aborted", async () => {
    // Arrange: fetch hangs forever but respects the AbortSignal
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, opts: RequestInit) =>
          new Promise((_resolve, reject) => {
            (opts.signal as AbortSignal).addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            );
          })
      )
    );

    vi.useFakeTimers();

    const { getErrors } = await importClient();

    // Start the call (will hang on fetch)
    const promise = getErrors().catch((e: unknown) => e as Error);

    // Advance time past the 5-second timeout
    await vi.advanceTimersByTimeAsync(6_000);

    const err = await promise;
    expect((err as Error).message).toContain("Unity Editorに接続できません");

    vi.useRealTimers();
  });
});
