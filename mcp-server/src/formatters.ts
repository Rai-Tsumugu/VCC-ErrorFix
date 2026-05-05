import type { ErrorSnapshot, DirectoryNode } from "./unity-client.js";

export function formatSnapshot(snapshot: ErrorSnapshot, label: string): string {
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

export function renderTree(node: DirectoryNode, indent = ""): string {
  let out = `${indent}${node.name}/\n`;
  for (const child of node.children ?? []) {
    out += renderTree(child, indent + "  ");
  }
  return out;
}
