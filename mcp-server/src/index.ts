import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  getErrors,
  getWarnings,
  clearErrors,
  getProjectStructure,
  type ErrorSnapshot,
  type DirectoryNode,
} from "./unity-client.js";

const server = new Server(
  { name: "vcc-errorfix", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ──────────────────────────────────────────────────────

const tools = [
  {
    name: "get_unity_errors",
    description:
      "Unityのエラーを取得します。コンパイルエラー（スクリプトのビルド失敗）と" +
      "ランタイムエラー（プレイモード中の例外）を区別して取得できます。" +
      "errorType を省略するとすべてのエラーを返します。" +
      "isCompiling=true の場合はコンパイル中、isPlayMode=true はプレイモード中を示します。",
    inputSchema: {
      type: "object" as const,
      properties: {
        errorType: {
          type: "string",
          enum: ["compilation", "runtime", "all"],
          description:
            "compilation=コンパイルエラーのみ / runtime=ランタイムエラーのみ / all or 省略=全エラー",
        },
      },
    },
  },
  {
    name: "get_unity_warnings",
    description:
      "Unityの警告（コンパイル警告・ランタイム警告）を取得します。",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_project_structure",
    description:
      "VRChatワールドプロジェクトの Assets/ フォルダ構造を3階層分取得します。" +
      "エラーが発生しているスクリプトがどのフォルダにあるか把握するために使用します。",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "clear_errors",
    description:
      "Unityのエラーバッファをクリアします。エラーを読んで修正した後に呼び出してください。",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ─── List tools ────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// ─── Call tools ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_unity_errors": {
      const parsed = z
        .object({ errorType: z.enum(["compilation", "runtime", "all"]).optional() })
        .parse(args ?? {});
      const type =
        parsed.errorType === "all" || !parsed.errorType
          ? undefined
          : parsed.errorType;
      const snapshot = await getErrors(type);
      return { content: [{ type: "text", text: formatSnapshot(snapshot, "エラー") }] };
    }

    case "get_unity_warnings": {
      const snapshot = await getWarnings();
      return { content: [{ type: "text", text: formatSnapshot(snapshot, "警告") }] };
    }

    case "get_project_structure": {
      const structure = await getProjectStructure();
      return {
        content: [{ type: "text", text: renderTree(structure.assets) }],
      };
    }

    case "clear_errors": {
      const cleared = await clearErrors();
      return {
        content: [
          {
            type: "text",
            text: cleared
              ? "Unityのエラーバッファをクリアしました。"
              : "クリアリクエストを送信しましたが、Unityからの確認が取れませんでした。",
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ─── Formatting helpers ────────────────────────────────────────────────────

function formatSnapshot(snapshot: ErrorSnapshot, label: string): string {
  const meta = [
    `Unity ${snapshot.unityVersion}`,
    `プロジェクト: ${snapshot.projectPath}`,
    `コンパイル中: ${snapshot.isCompiling}`,
    `プレイモード: ${snapshot.isPlayMode}`,
  ].join(" | ");

  if (snapshot.entries.length === 0) {
    return `${meta}\n\n${label}はありません。`;
  }

  const lines: string[] = [meta, ``, `${label} ${snapshot.entries.length} 件:`, ``];

  for (const entry of snapshot.entries) {
    lines.push(`【${entry.errorTypeString}】 ${entry.timestamp}`);
    lines.push(`  メッセージ: ${entry.message}`);
    if (entry.filePath) {
      lines.push(
        `  ファイル: ${entry.filePath}${entry.lineNumber >= 0 ? `:${entry.lineNumber}行目` : ""}`
      );
    }
    if (entry.stackTrace) {
      const traceLines = entry.stackTrace.split("\n").slice(0, 5).join("\n  ");
      lines.push(`  スタックトレース:\n  ${traceLines}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

function renderTree(node: DirectoryNode, indent = ""): string {
  let out = `${indent}${node.name}/\n`;
  for (const child of node.children ?? []) {
    out += renderTree(child, indent + "  ");
  }
  return out;
}

// ─── Start server ──────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("VCC-ErrorFix MCP サーバー起動完了\n");
