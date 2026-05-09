# CLAUDE.md — VCC-ErrorFix 開発ガイドライン

このファイルは Claude Code がプロジェクト作業を行う際に従うべき指針です。

---

## プロジェクト概要

VCC-ErrorFix は Unity Editor のコンパイルエラー・ランタイムエラーを Claude AI に中継するブリッジツールです。

```
Unity Editor (C#) → HTTP localhost:7300 → MCP Server (Node.js/TypeScript) → Claude AI
```

---

## コンポーネントの責務マップ

エラー修正の前に、問題のコードがこの表のどこに位置するかを確認してください。

### Unity Editor Plugin（`Editor/`）

| ファイル | 責務 | 削除したら何が壊れるか |
|---------|------|----------------------|
| `ErrorData.cs` | `ErrorType` 列挙型・`UnityLogEntry`・`ErrorSnapshot`・`DirectoryNode` のデータ定義 | 全コンポーネントのシリアライズが崩壊する |
| `ErrorCollector.cs` | `CompilationPipeline` と `Application.logMessageReceived` をフックしてエラーを収集する。スレッドセーフなリスト管理 | エラーが一切収集されなくなる |
| `HttpServer.cs` | `localhost:7300` で HTTP を待受。`/errors` `/warnings` `/clear` `/structure` `/health` の5エンドポイントを提供 | MCP サーバーが Unity に接続できなくなる |
| `ErrorFixSettings.cs` | `EditorPrefs` による Port・AutoOpenOnError の永続化 | ポート設定が毎回リセットされる |
| `ErrorFixEditorWindow.cs` | ダッシュボード UI（Tools メニュー）・mcp.json 生成・JSON エクスポート | エディター上での操作が一切できなくなる |

### MCP Server（`mcp-server/src/`）

| ファイル | 責務 | 削除したら何が壊れるか |
|---------|------|----------------------|
| `index.ts` | stdio トランスポートでサーバーを起動するエントリポイント | MCP サーバーが起動しない |
| `server.ts` | `get_unity_errors` `get_unity_warnings` `get_project_structure` `clear_errors` の4ツールを Claude に公開 | Claude が Unity のエラーを取得できなくなる |
| `unity-client.ts` | Unity HTTP API への接続クライアント。`/health` でヘルスチェック後にリクエスト。5秒タイムアウト | 全ツールの実行が失敗する |
| `formatters.ts` | `ErrorSnapshot` をテキスト整形・ディレクトリツリーをレンダリング | Claude への出力が JSON の生データになる |

---

## エラー修正の必須プロセス

> **原則:** エラーの「症状」に対処するのではなく、「原因」に対処する。
> コードを削除することでエラーが消えても、それは修正ではない。

### Step 1 — 機能上の役割を明文化する

作業を始める前に、問題のコードが上の「責務マップ」のどこに該当するかを特定し、
**そのコードが存在しない場合に何が失われるか** を一文で書き出す。

### Step 2 — 実装意図を把握する

以下の順で設計意図を読み取る。

1. **テストコード**（`Tests/Editor/*.cs`、`mcp-server/src/__tests__/`）— 期待動作の仕様書
2. **型定義・インターフェース**（`ErrorData.cs`、`unity-client.ts` の interface）— データ契約
3. **エラーメッセージ本文**— 単語の意味を調べ、表面的に解釈しない

### Step 3 — 根本原因を特定する

- エラーメッセージが示す「本当の意味」を確認する（ツールのバージョン非互換、API 変更、設定ミスなど）
- 「このコードを削除すればエラーは消える」という発想は根本原因の特定を放棄している

### Step 4 — 機能を保った修正を実施する

- 修正後に既存テストがすべて通ることを確認する
- 機能を意図的に削除する場合は、削除する理由と代替手段をコミットメッセージに記録する

---

## 禁止パターン

以下の操作は **明示的な承認なしに行ってはならない**。

| 禁止操作 | 代わりにすべきこと |
|---------|-----------------|
| ❌ エラーを発生させているコードを削除する | エラーの根本原因を特定し、機能を保ったまま修正する |
| ❌ `try { ... } catch { /* ignore */ }` でエラーを握りつぶす | エラーをログに記録し、適切なフォールバックを実装する |
| ❌ `// TODO: fix later` を付けてコメントアウトする | その場で直すか、Issue を起票して追跡可能にする |
| ❌ テストを削除してビルドを通す | テストが失敗している理由を理解し、実装を修正する |
| ❌ 型アサーション（`as any`、`!`）でエラーを回避する | 型エラーの原因となっている設計上の問題を修正する |

---

## ビルドとテスト

```bash
# MCP サーバー（TypeScript）のビルドとテスト
cd mcp-server
npm run build          # tsc による型チェック＋コンパイル
npm run test           # Vitest でユニットテスト
npm run test:coverage  # カバレッジ付きテスト

# 単体実行ファイルのビルド（開発者のみ・Node.js 20 以上が必要）
npm run build:bundle   # esbuild で CJS バンドル生成
npm run build:exe      # pkg で各 OS 向け実行ファイル生成 → bin/
```

Unity の C# テストは Unity Test Runner（`Window > General > Test Runner > EditMode`）で実行する。
CI 上では Unity ライセンスが必要なため、パッケージ構造の検証のみ行っている。

---

## コミットメッセージの規則

```
<種別>: <変更の要約>

<変更の背景・理由>（省略可）
```

種別: `feat`（新機能）/ `fix`（バグ修正）/ `refactor` / `docs` / `chore`（ビルド・CI）

バグ修正のコミットには必ず「根本原因」を記載すること。
「エラーが出ていたので削除した」は根本原因の記載として認められない。
