import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
} from "./unity-client.js";
import { formatSnapshot, renderTree } from "./formatters.js";

const TOOLS = [
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
    description: "Unityの警告（コンパイル警告・ランタイム警告）を取得します。",
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

export function createServer(): Server {
  const server = new Server(
    { name: "vcc-errorfix", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

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

  return server;
}

export { TOOLS };
