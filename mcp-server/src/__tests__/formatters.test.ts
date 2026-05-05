import { describe, it, expect } from "vitest";
import { formatSnapshot, renderTree } from "../formatters.js";
import type { ErrorSnapshot, DirectoryNode } from "../unity-client.js";

const BASE_SNAPSHOT: ErrorSnapshot = {
  entries: [],
  isCompiling: false,
  isPlayMode: false,
  projectPath: "/Users/dev/MyWorld",
  unityVersion: "2022.3.22f1",
};

// ─── formatSnapshot ────────────────────────────────────────────────────────

describe("formatSnapshot", () => {
  it("shows 'ありません' when entries is empty", () => {
    const result = formatSnapshot(BASE_SNAPSHOT, "エラー");
    expect(result).toContain("エラーはありません。");
  });

  it("includes Unity version and project path in meta line", () => {
    const result = formatSnapshot(BASE_SNAPSHOT, "エラー");
    expect(result).toContain("Unity 2022.3.22f1");
    expect(result).toContain("/Users/dev/MyWorld");
  });

  it("shows isCompiling and isPlayMode flags", () => {
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      isCompiling: true,
      isPlayMode: true,
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).toContain("コンパイル中: true");
    expect(result).toContain("プレイモード: true");
  });

  it("shows entry count when entries exist", () => {
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      entries: [
        {
          id: "1",
          errorType: 0,
          errorTypeString: "CompilationError",
          message: "CS0103 error",
          stackTrace: "",
          filePath: "Assets/Scripts/Foo.cs",
          lineNumber: 10,
          timestamp: "2026-05-05T00:00:00Z",
        },
      ],
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).toContain("エラー 1 件:");
  });

  it("shows errorTypeString in brackets", () => {
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      entries: [
        {
          id: "1",
          errorType: 2,
          errorTypeString: "RuntimeError",
          message: "NullReferenceException",
          stackTrace: "",
          filePath: "",
          lineNumber: -1,
          timestamp: "2026-05-05T00:00:00Z",
        },
      ],
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).toContain("【RuntimeError】");
  });

  it("shows file path with line number when lineNumber >= 0", () => {
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      entries: [
        {
          id: "1",
          errorType: 0,
          errorTypeString: "CompilationError",
          message: "error",
          stackTrace: "",
          filePath: "Assets/Scripts/Foo.cs",
          lineNumber: 42,
          timestamp: "2026-05-05T00:00:00Z",
        },
      ],
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).toContain("Assets/Scripts/Foo.cs:42行目");
  });

  it("shows file path without line suffix when lineNumber is -1", () => {
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      entries: [
        {
          id: "1",
          errorType: 2,
          errorTypeString: "RuntimeError",
          message: "error",
          stackTrace: "",
          filePath: "Assets/Scripts/Bar.cs",
          lineNumber: -1,
          timestamp: "2026-05-05T00:00:00Z",
        },
      ],
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).toContain("Assets/Scripts/Bar.cs");
    expect(result).not.toContain(":-1行目");
  });

  it("omits ファイル line when filePath is empty", () => {
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      entries: [
        {
          id: "1",
          errorType: 2,
          errorTypeString: "RuntimeError",
          message: "error",
          stackTrace: "",
          filePath: "",
          lineNumber: -1,
          timestamp: "2026-05-05T00:00:00Z",
        },
      ],
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).not.toContain("ファイル:");
  });

  it("includes first 5 lines of stackTrace and omits the rest", () => {
    const lines = ["line1", "line2", "line3", "line4", "line5", "line6", "line7"];
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      entries: [
        {
          id: "1",
          errorType: 2,
          errorTypeString: "RuntimeError",
          message: "error",
          stackTrace: lines.join("\n"),
          filePath: "",
          lineNumber: -1,
          timestamp: "2026-05-05T00:00:00Z",
        },
      ],
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).toContain("line5");
    expect(result).not.toContain("line6");
    expect(result).not.toContain("line7");
  });

  it("omits スタックトレース section when stackTrace is empty", () => {
    const snapshot: ErrorSnapshot = {
      ...BASE_SNAPSHOT,
      entries: [
        {
          id: "1",
          errorType: 0,
          errorTypeString: "CompilationError",
          message: "error",
          stackTrace: "",
          filePath: "Assets/S.cs",
          lineNumber: 1,
          timestamp: "2026-05-05T00:00:00Z",
        },
      ],
    };
    const result = formatSnapshot(snapshot, "エラー");
    expect(result).not.toContain("スタックトレース");
  });

  it("uses the provided label for warnings", () => {
    const result = formatSnapshot(BASE_SNAPSHOT, "警告");
    expect(result).toContain("警告はありません。");
  });
});

// ─── renderTree ────────────────────────────────────────────────────────────

describe("renderTree", () => {
  it("renders a single leaf node with trailing slash", () => {
    const node: DirectoryNode = { name: "Assets", path: "Assets", children: [] };
    expect(renderTree(node)).toBe("Assets/\n");
  });

  it("renders nested nodes with 2-space indentation per level", () => {
    const node: DirectoryNode = {
      name: "Assets",
      path: "Assets",
      children: [
        {
          name: "Scripts",
          path: "Assets/Scripts",
          children: [
            { name: "Player", path: "Assets/Scripts/Player", children: [] },
          ],
        },
      ],
    };
    const result = renderTree(node);
    expect(result).toBe("Assets/\n  Scripts/\n    Player/\n");
  });

  it("renders multiple children at the same level", () => {
    const node: DirectoryNode = {
      name: "Assets",
      path: "Assets",
      children: [
        { name: "Scripts", path: "Assets/Scripts", children: [] },
        { name: "Prefabs", path: "Assets/Prefabs", children: [] },
      ],
    };
    const result = renderTree(node);
    expect(result).toContain("  Scripts/\n");
    expect(result).toContain("  Prefabs/\n");
  });

  it("handles undefined children gracefully", () => {
    const node = { name: "Assets", path: "Assets" } as unknown as DirectoryNode;
    expect(() => renderTree(node)).not.toThrow();
    expect(renderTree(node)).toBe("Assets/\n");
  });

  it("applies custom indent prefix", () => {
    const node: DirectoryNode = { name: "Scripts", path: "Scripts", children: [] };
    expect(renderTree(node, ">> ")).toBe(">> Scripts/\n");
  });
});
