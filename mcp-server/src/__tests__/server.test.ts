import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ErrorSnapshot, ProjectStructure } from "../unity-client.js";

// ─── Mock unity-client module ──────────────────────────────────────────────

vi.mock("../unity-client.js", () => ({
  getErrors: vi.fn(),
  getWarnings: vi.fn(),
  clearErrors: vi.fn(),
  getProjectStructure: vi.fn(),
}));

import * as unityClient from "../unity-client.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

const EMPTY_SNAPSHOT: ErrorSnapshot = {
  entries: [],
  isCompiling: false,
  isPlayMode: false,
  projectPath: "/project",
  unityVersion: "2022.3.22f1",
};

const ERROR_SNAPSHOT: ErrorSnapshot = {
  entries: [
    {
      id: "1",
      errorType: 0,
      errorTypeString: "CompilationError",
      message: "CS0103: Foo not found",
      stackTrace: "",
      filePath: "Assets/Scripts/Foo.cs",
      lineNumber: 42,
      timestamp: "2026-05-05T10:00:00Z",
    },
  ],
  isCompiling: false,
  isPlayMode: false,
  projectPath: "/project",
  unityVersion: "2022.3.22f1",
};

const STRUCTURE: ProjectStructure = {
  assets: {
    name: "Assets",
    path: "Assets",
    children: [
      { name: "Scripts", path: "Assets/Scripts", children: [] },
    ],
  },
};

async function createTestPair() {
  const { createServer } = await import("../server.js");
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── list_tools ────────────────────────────────────────────────────────────

describe("list tools", () => {
  it("returns exactly 4 tools", async () => {
    vi.mocked(unityClient.getErrors).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(4);
  });

  it("exposes get_unity_errors, get_unity_warnings, get_project_structure, clear_errors", async () => {
    const { client } = await createTestPair();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("get_unity_errors");
    expect(names).toContain("get_unity_warnings");
    expect(names).toContain("get_project_structure");
    expect(names).toContain("clear_errors");
  });

  it("get_unity_errors has errorType input schema with compilation/runtime/all", async () => {
    const { client } = await createTestPair();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "get_unity_errors")!;
    const props = (tool.inputSchema as unknown as { properties: Record<string, { enum?: string[] }> }).properties;
    expect(props.errorType.enum).toEqual(
      expect.arrayContaining(["compilation", "runtime", "all"])
    );
  });
});

// ─── get_unity_errors ──────────────────────────────────────────────────────

describe("get_unity_errors tool", () => {
  it("calls getErrors(undefined) when no errorType provided", async () => {
    vi.mocked(unityClient.getErrors).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    await client.callTool({ name: "get_unity_errors", arguments: {} });
    expect(unityClient.getErrors).toHaveBeenCalledWith(undefined);
  });

  it("calls getErrors(undefined) when errorType='all'", async () => {
    vi.mocked(unityClient.getErrors).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    await client.callTool({ name: "get_unity_errors", arguments: { errorType: "all" } });
    expect(unityClient.getErrors).toHaveBeenCalledWith(undefined);
  });

  it("calls getErrors('compilation') when errorType='compilation'", async () => {
    vi.mocked(unityClient.getErrors).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    await client.callTool({ name: "get_unity_errors", arguments: { errorType: "compilation" } });
    expect(unityClient.getErrors).toHaveBeenCalledWith("compilation");
  });

  it("calls getErrors('runtime') when errorType='runtime'", async () => {
    vi.mocked(unityClient.getErrors).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    await client.callTool({ name: "get_unity_errors", arguments: { errorType: "runtime" } });
    expect(unityClient.getErrors).toHaveBeenCalledWith("runtime");
  });

  it("returns 'ありません' text when no errors", async () => {
    vi.mocked(unityClient.getErrors).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "get_unity_errors", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("エラーはありません");
  });

  it("returns formatted error list when errors exist", async () => {
    vi.mocked(unityClient.getErrors).mockResolvedValue(ERROR_SNAPSHOT);
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "get_unity_errors", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("CS0103: Foo not found");
    expect(text).toContain("Assets/Scripts/Foo.cs:42行目");
  });

  it("propagates error message when Unity is unreachable", async () => {
    vi.mocked(unityClient.getErrors).mockRejectedValue(
      new Error("Unity Editorに接続できません")
    );
    const { client } = await createTestPair();
    await expect(
      client.callTool({ name: "get_unity_errors", arguments: {} })
    ).rejects.toThrow();
  });
});

// ─── get_unity_warnings ────────────────────────────────────────────────────

describe("get_unity_warnings tool", () => {
  it("calls getWarnings()", async () => {
    vi.mocked(unityClient.getWarnings).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    await client.callTool({ name: "get_unity_warnings", arguments: {} });
    expect(unityClient.getWarnings).toHaveBeenCalledOnce();
  });

  it("returns 'ありません' when no warnings", async () => {
    vi.mocked(unityClient.getWarnings).mockResolvedValue(EMPTY_SNAPSHOT);
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "get_unity_warnings", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("警告はありません");
  });
});

// ─── get_project_structure ─────────────────────────────────────────────────

describe("get_project_structure tool", () => {
  it("calls getProjectStructure()", async () => {
    vi.mocked(unityClient.getProjectStructure).mockResolvedValue(STRUCTURE);
    const { client } = await createTestPair();
    await client.callTool({ name: "get_project_structure", arguments: {} });
    expect(unityClient.getProjectStructure).toHaveBeenCalledOnce();
  });

  it("returns rendered tree text", async () => {
    vi.mocked(unityClient.getProjectStructure).mockResolvedValue(STRUCTURE);
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "get_project_structure", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Assets/");
    expect(text).toContain("  Scripts/");
  });
});

// ─── clear_errors ──────────────────────────────────────────────────────────

describe("clear_errors tool", () => {
  it("calls clearErrors()", async () => {
    vi.mocked(unityClient.clearErrors).mockResolvedValue(true);
    const { client } = await createTestPair();
    await client.callTool({ name: "clear_errors", arguments: {} });
    expect(unityClient.clearErrors).toHaveBeenCalledOnce();
  });

  it("returns success message when cleared=true", async () => {
    vi.mocked(unityClient.clearErrors).mockResolvedValue(true);
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "clear_errors", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("クリアしました");
  });

  it("returns caution message when cleared=false", async () => {
    vi.mocked(unityClient.clearErrors).mockResolvedValue(false);
    const { client } = await createTestPair();
    const result = await client.callTool({ name: "clear_errors", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("確認が取れませんでした");
  });
});
