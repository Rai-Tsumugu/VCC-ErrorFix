# VCC-ErrorFix

Unity コンソールのエラー・警告を Claude AI（MCP 経由）へ中継し、スクリプトの自動修正を支援する Unity Editor プラグインです。

## システム構成

```
Unity Editor (C# プラグイン)
        ↓ HTTP localhost:7300
  MCP Server (Node.js)
        ↓ stdio (Model Context Protocol)
      Claude AI
```

Unity Editor 内で発生したコンパイルエラー・ランタイムエラー・警告を、ローカル HTTP サーバー経由で MCP サーバーに中継します。Claude AI は MCP ツールを通じてエラー情報・プロジェクト構造を取得し、修正案を提示します。

---

## 動作環境

| コンポーネント | バージョン |
|--------------|-----------|
| Unity | 2022.3.0f1 以降 |
| Node.js | 20.0.0 以降 |
| VCC (VRChat Creator Companion) | 最新版推奨 |

---

## インストール

### 1. Unity パッケージのインストール

1. VCC を開き、**Settings → Packages → Add Repository** を選択します
2. 以下の URL を入力して **Add** をクリックします：
   ```
   https://rai-tsumugu.github.io/VCC-ErrorFix/index.json
   ```
3. 対象プロジェクトの **Manage Packages** を開き、`VCC ErrorFix MCP Bridge` をインストールします

インストール後、Unity Editor を開くと HTTP サーバー（デフォルト: ポート 7300）が自動的に起動します。

> **GitHub Pages の有効化（初回のみ）**  
> リポジトリの **Settings → Pages → Source** で  
> `Deploy from a branch` / Branch: `main` / Folder: `/docs` を選択して Save してください。

### 2. MCP サーバーのビルド

```bash
cd mcp-server
npm install
npm run build
```

ビルド成功後、`mcp-server/dist/index.js` が生成されます。

### 3. VS Code 連携設定の生成

Unity Editor のダッシュボードを開き（`Tools > VCC ErrorFix > Open Dashboard`）、**Generate mcp.json** ボタンをクリックします。  
プロジェクトルートの `.vscode/mcp.json` が自動生成され、VS Code + Claude から MCP ツールを使用できるようになります。

---

## ダッシュボード

メニュー `Tools > VCC ErrorFix > Open Dashboard` でダッシュボードを開きます。最小ウィンドウサイズは 500×300px です。

### ステータスバー

| 表示 | 説明 |
|------|------|
| **● Running**（緑） | HTTP サーバー稼働中 |
| **● Stopped**（赤） | HTTP サーバー停止中 |

右側に現在のポート番号が表示されます。**Stop / Start / Restart** ボタンでサーバーを手動制御できます。

### 設定行

| UI 要素 | 説明 |
|---------|------|
| **Port** 入力欄 | HTTP サーバーのポート番号（デフォルト: 7300） |
| **Apply** ボタン | ポートを変更した場合のみ有効。押すとサーバーが新しいポートで再起動 |
| **エラー時に自動オープン** トグル | エラー発生時にダッシュボードを自動表示する |

### ツールバー

エントリ数がリアルタイムで更新されます。

```
コンパイルエラー: N  ランタイムエラー: N  警告: N
                          [Clear All] [Export JSON] [Generate mcp.json]
```

| ボタン | 動作 |
|--------|------|
| **Clear All** | 全エラー・警告バッファをクリア |
| **Export JSON** | 現在のスナップショットを JSON ファイルとして保存（保存先を選択するダイアログが開く） |
| **Generate mcp.json** | `.vscode/mcp.json` を生成または上書き |

### エラーリスト

各エントリは以下の情報を表示します。

```
[CompilationError]  Assets/Scripts/Example.cs:42          [Open]
スクリプトのエラーメッセージ内容...
  スタックトレース先頭3行...
```

| 要素 | 説明 |
|------|------|
| `[errorTypeString]` | エラー種別（後述） |
| ファイルパス:行番号 | 50文字を超える場合は先頭を `...` で省略 |
| **Open** ボタン | 該当ファイルを指定行で外部エディターまたは Unity で開く |
| メッセージ | エラー本文（選択・コピー可能） |
| スタックトレース | 先頭3行を縮小フォントで表示 |

---

## 設定

設定は `EditorPrefs` に保存され、Unity Editor 再起動後も保持されます。

| 設定キー | 型 | デフォルト値 | 説明 |
|---------|-----|------------|------|
| `VccErrorFix.Port` | int | `7300` | HTTP サーバーのリスンポート |
| `VccErrorFix.AutoOpenOnError` | bool | `false` | コンパイルエラー・ランタイムエラー発生時にダッシュボードを自動表示 |

---

## データ型

### ErrorType 列挙型

| 値 | 説明 |
|----|------|
| `CompilationError` | コンパイルエラー（ビルド失敗） |
| `CompilationWarning` | コンパイル警告 |
| `RuntimeError` | ランタイムエラー（プレイモード中の例外・Assert） |
| `RuntimeWarning` | ランタイム警告（プレイモード中） |
| `RuntimeLog` | 通常ログ（`Debug.Log` 等） |

### UnityLogEntry

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | GUID（一意識別子） |
| `errorType` | int | `ErrorType` の数値 |
| `errorTypeString` | string | `ErrorType` の文字列表現 |
| `message` | string | エラーメッセージ本文 |
| `stackTrace` | string | スタックトレース（コンパイルエラーは空文字） |
| `filePath` | string | プロジェクト相対パス（例: `Assets/Scripts/Foo.cs`） |
| `lineNumber` | int | 行番号（不明の場合は `-1`） |
| `timestamp` | string | UTC ISO 8601 形式（例: `2025-05-05T12:34:56.000Z`） |

### ErrorSnapshot

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `entries` | UnityLogEntry[] | エラー・警告エントリの配列 |
| `isCompiling` | bool | コンパイル中かどうか |
| `isPlayMode` | bool | プレイモード中かどうか |
| `projectPath` | string | Unity プロジェクトルートの絶対パス |
| `unityVersion` | string | Unity のバージョン文字列 |

### DirectoryNode

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `name` | string | フォルダ名 |
| `path` | string | `Assets` からの相対パス（例: `Assets/Scripts`） |
| `children` | DirectoryNode[] | 子ノードの配列（`.` で始まるフォルダは除外） |

---

## HTTP API リファレンス

HTTP サーバーはデフォルトで `http://localhost:7300` で待機します。  
全レスポンスは `Content-Type: application/json; charset=utf-8`、CORS ヘッダー付きで返されます。

### GET `/health`

サーバーの稼働確認。

**レスポンス例:**
```json
{"status": "ok", "port": 7300}
```

---

### GET `/errors`

エラーを取得します。`RuntimeLog`・`RuntimeWarning`・`CompilationWarning` は含まれません。

**クエリパラメータ:**

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `type` | `compilation` | `CompilationError` のみ返す |
| `type` | `runtime` | `RuntimeError` のみ返す |
| （省略） | — | 全エラー（`CompilationError` + `RuntimeError`）を返す |

**リクエスト例:**
```
GET /errors
GET /errors?type=compilation
GET /errors?type=runtime
```

**レスポンス形式:** `ErrorSnapshot`（JSON）

---

### GET `/warnings`

警告を取得します（`CompilationWarning` と `RuntimeWarning` のみ）。

**レスポンス形式:** `ErrorSnapshot`（JSON）

---

### POST `/clear`

エラーバッファを全件クリアします。GET リクエストは受け付けません。

**レスポンス例（成功）:**
```json
{"cleared": true}
```

**レスポンス例（GET で呼んだ場合）:**
```json
{"error": "POST required"}
```

---

### GET `/structure`

`Assets/` フォルダの構造を3階層分返します。`.` で始まるフォルダは除外されます。

**レスポンス例:**
```json
{
  "assets": {
    "name": "Assets",
    "path": "Assets",
    "children": [
      {
        "name": "Scripts",
        "path": "Assets/Scripts",
        "children": [...]
      }
    ]
  }
}
```

---

## MCP ツール リファレンス

MCP サーバーは stdio トランスポートで動作します。Unity への接続前に `/health` でヘルスチェックを行い、Unity が起動していない場合はエラーを返します（タイムアウト: 5秒）。

### `get_unity_errors`

Unity のエラーを取得します。

**入力スキーマ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `errorType` | string | 任意 | `"compilation"` / `"runtime"` / `"all"` または省略（全エラー） |

**出力:** `ErrorSnapshot` を人間が読みやすいテキスト形式に整形して返します。  
`isCompiling=true` の場合はコンパイル中、`isPlayMode=true` の場合はプレイモード中を示します。

---

### `get_unity_warnings`

Unity の警告（コンパイル警告・ランタイム警告）を取得します。

**入力スキーマ:** なし

**出力:** 警告の `ErrorSnapshot` を整形したテキスト

---

### `get_project_structure`

`Assets/` フォルダの構造を3階層分取得します。エラーが発生しているスクリプトのフォルダを把握するために使用します。

**入力スキーマ:** なし

**出力:** ディレクトリツリーをテキスト形式で返します。

```
Assets/
  Scripts/
    Player/
  Shaders/
```

---

### `clear_errors`

Unity のエラーバッファをクリアします。エラーを読んで修正した後に呼び出してください。

**入力スキーマ:** なし

**出力:**
- 成功: `"Unityのエラーバッファをクリアしました。"`
- 確認不可: `"クリアリクエストを送信しましたが、Unityからの確認が取れませんでした。"`

---

## .vscode/mcp.json の形式

**Generate mcp.json** ボタンで生成されるファイルの例:

```json
{
  "servers": {
    "vcc-errorfix": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/package/mcp-server/dist/index.js"],
      "env": {
        "UNITY_MCP_URL": "http://localhost:7300"
      }
    }
  }
}
```

### 環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| `UNITY_MCP_URL` | `http://localhost:7300` | MCP サーバーが接続する Unity HTTP API のベース URL |

ポートを変更した場合は、この環境変数も合わせて更新してください。

---

## トラブルシューティング

### ポートが使用中でサーバーが起動しない

Unity Console に以下のような警告が表示されます:

```
[VccErrorFix] HTTPサーバーをポート 7300 で起動できませんでした: ...
別のプロセスがポートを使用中の可能性があります。Settings から別のポートを設定してください。
```

**対処:** ダッシュボードの **Port** 欄で別のポート番号を入力し、**Apply** を押してください。その後、`.vscode/mcp.json` の `UNITY_MCP_URL` も合わせて更新してください。

---

### MCP サーバーが Unity に接続できない

```
Unity Editorに接続できません (http://localhost:7300)。
VCC ErrorFix パッケージを追加したUnityプロジェクトが開いているか確認してください。
```

**対処:**
1. Unity Editor が起動しているか確認する
2. VCC ErrorFix パッケージがインストールされているか確認する
3. ダッシュボードのステータスが **● Running** になっているか確認する
4. `UNITY_MCP_URL` のポートがダッシュボードの設定と一致しているか確認する

---

### コンパイルエラーがリストに残ったまま消えない

アセンブリリロード（スクリプト保存後の再コンパイル）が開始されると、前回のコンパイルエラー・コンパイル警告は自動的にクリアされます。  
手動でクリアしたい場合は **Clear All** ボタンまたは MCP ツール `clear_errors` を使用してください。

---

## ライセンス

MIT
