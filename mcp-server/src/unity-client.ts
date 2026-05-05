const UNITY_BASE_URL = process.env.UNITY_MCP_URL ?? "http://localhost:7300";
const TIMEOUT_MS = 5_000;

export interface UnityLogEntry {
  id: string;
  errorType: number;
  errorTypeString:
    | "CompilationError"
    | "CompilationWarning"
    | "RuntimeError"
    | "RuntimeWarning"
    | "RuntimeLog";
  message: string;
  stackTrace: string;
  filePath: string;
  lineNumber: number;
  timestamp: string;
}

export interface ErrorSnapshot {
  entries: UnityLogEntry[];
  isCompiling: boolean;
  isPlayMode: boolean;
  projectPath: string;
  unityVersion: string;
}

export interface DirectoryNode {
  name: string;
  path: string;
  children: DirectoryNode[];
}

export interface ProjectStructure {
  assets: DirectoryNode;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function assertUnityRunning(): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${UNITY_BASE_URL}/health`);
    if (!res.ok) throw new Error(`ヘルスチェックが ${res.status} を返しました`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Unity Editorに接続できません (${UNITY_BASE_URL})。\n` +
        `VCC ErrorFix パッケージを追加したUnityプロジェクトが開いているか確認してください。\n` +
        `詳細: ${msg}`
    );
  }
}

export async function getErrors(
  type?: "compilation" | "runtime"
): Promise<ErrorSnapshot> {
  await assertUnityRunning();
  const url = type
    ? `${UNITY_BASE_URL}/errors?type=${type}`
    : `${UNITY_BASE_URL}/errors`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`/errors が ${res.status} を返しました`);
  return (await res.json()) as ErrorSnapshot;
}

export async function getWarnings(): Promise<ErrorSnapshot> {
  await assertUnityRunning();
  const res = await fetchWithTimeout(`${UNITY_BASE_URL}/warnings`);
  if (!res.ok) throw new Error(`/warnings が ${res.status} を返しました`);
  return (await res.json()) as ErrorSnapshot;
}

export async function clearErrors(): Promise<boolean> {
  await assertUnityRunning();
  const res = await fetchWithTimeout(`${UNITY_BASE_URL}/clear`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`/clear が ${res.status} を返しました`);
  const body = (await res.json()) as { cleared: boolean };
  return body.cleared;
}

export async function getProjectStructure(): Promise<ProjectStructure> {
  await assertUnityRunning();
  const res = await fetchWithTimeout(`${UNITY_BASE_URL}/structure`);
  if (!res.ok) throw new Error(`/structure が ${res.status} を返しました`);
  return (await res.json()) as ProjectStructure;
}
