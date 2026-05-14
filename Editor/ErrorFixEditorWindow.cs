using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace RaiTsumugu.VccErrorFix.Editor
{
    public class ErrorFixEditorWindow : EditorWindow
    {
        private Vector2 _scrollPos;
        private int _lastEntryCount = -1;
        private int _pendingPort;
        private bool _portChanged;
        private List<UnityLogEntry> _displayEntries = new List<UnityLogEntry>();
        private ErrorType _filter = (ErrorType)(-1); // -1 = all

        [MenuItem("Tools/VCC ErrorFix/Open Dashboard")]
        public static void Open()
        {
            var window = GetWindow<ErrorFixEditorWindow>("VCC ErrorFix");
            window.minSize = new Vector2(500, 300);
            window.Show();
        }

        private void OnEnable()
        {
            _pendingPort = ErrorFixSettings.Port;
            EditorApplication.update += OnEditorUpdate;
            RefreshEntries();
        }

        private void OnDisable()
        {
            EditorApplication.update -= OnEditorUpdate;
        }

        private void OnEditorUpdate()
        {
            int count = ErrorCollector.EntryCount;
            if (count != _lastEntryCount)
            {
                _lastEntryCount = count;
                RefreshEntries();
                Repaint();
            }
        }

        private void RefreshEntries()
        {
            var snapshot = ErrorCollector.GetSnapshot();
            _displayEntries = snapshot.entries;
        }

        private void OnGUI()
        {
            DrawServerStatus();
            EditorGUILayout.Space(4);
            DrawSettings();
            EditorGUILayout.Space(4);
            DrawToolbar();
            EditorGUILayout.Space(4);
            DrawErrorList();
        }

        private void DrawServerStatus()
        {
            using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
            {
                bool running = HttpServer.IsRunning;
                var color = running ? Color.green : Color.red;
                var prevColor = GUI.color;
                GUI.color = color;
                GUILayout.Label(running ? "● Running" : "● Stopped", EditorStyles.boldLabel,
                    GUILayout.Width(100));
                GUI.color = prevColor;

                GUILayout.Label($"Port: {ErrorFixSettings.Port}", GUILayout.Width(80));

                GUILayout.FlexibleSpace();

                if (running)
                {
                    if (GUILayout.Button("Stop", EditorStyles.toolbarButton, GUILayout.Width(50)))
                        HttpServer.Stop();
                }
                else
                {
                    if (GUILayout.Button("Start", EditorStyles.toolbarButton, GUILayout.Width(50)))
                        HttpServer.Start();
                }

                if (GUILayout.Button("Restart", EditorStyles.toolbarButton, GUILayout.Width(60)))
                    HttpServer.Restart();
            }
        }

        private void DrawSettings()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Port", GUILayout.Width(40));
                int newPort = EditorGUILayout.IntField(_pendingPort, GUILayout.Width(70));
                if (newPort != _pendingPort)
                {
                    _pendingPort = newPort;
                    _portChanged = true;
                }

                using (new EditorGUI.DisabledScope(!_portChanged))
                {
                    if (GUILayout.Button("Apply", GUILayout.Width(50)))
                    {
                        ErrorFixSettings.Port = _pendingPort;
                        _portChanged = false;
                        HttpServer.Restart();
                    }
                }

                GUILayout.Space(20);

                bool autoOpen = EditorGUILayout.ToggleLeft(
                    "エラー時に自動オープン", ErrorFixSettings.AutoOpenOnError, GUILayout.Width(160));
                if (autoOpen != ErrorFixSettings.AutoOpenOnError)
                    ErrorFixSettings.AutoOpenOnError = autoOpen;
            }
        }

        private void DrawToolbar()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                var snapshot = ErrorCollector.GetSnapshot();
                int compErrors = snapshot.entries.Count(e => e.errorType == ErrorType.CompilationError);
                int rtErrors = snapshot.entries.Count(e => e.errorType == ErrorType.RuntimeError);
                int warnings = snapshot.entries.Count(e =>
                    e.errorType == ErrorType.CompilationWarning ||
                    e.errorType == ErrorType.RuntimeWarning);

                GUILayout.Label($"コンパイルエラー: {compErrors}  ランタイムエラー: {rtErrors}  警告: {warnings}");

                GUILayout.FlexibleSpace();

                if (GUILayout.Button("Clear All", GUILayout.Width(70)))
                {
                    ErrorCollector.ClearEntries();
                    RefreshEntries();
                }

                if (GUILayout.Button("Export JSON", GUILayout.Width(90)))
                    ExportJson();

                if (GUILayout.Button("Generate mcp.json", GUILayout.Width(130)))
                    GenerateVscodeMcpJson();
            }
        }

        private void DrawErrorList()
        {
            using (var scroll = new EditorGUILayout.ScrollViewScope(_scrollPos))
            {
                _scrollPos = scroll.scrollPosition;

                if (_displayEntries.Count == 0)
                {
                    EditorGUILayout.HelpBox("エラーはありません。", MessageType.Info);
                    return;
                }

                foreach (var entry in _displayEntries)
                {
                    MessageType msgType = entry.errorType == ErrorType.CompilationError ||
                                         entry.errorType == ErrorType.RuntimeError
                        ? MessageType.Error
                        : MessageType.Warning;

                    using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                    {
                        using (new EditorGUILayout.HorizontalScope())
                        {
                            string label = $"[{entry.errorTypeString}]  {TruncatePath(entry.filePath, 50)}" +
                                           (entry.lineNumber >= 0 ? $":{entry.lineNumber}" : "");
                            EditorGUILayout.LabelField(label, EditorStyles.boldLabel);

                            if (!string.IsNullOrEmpty(entry.filePath) &&
                                GUILayout.Button("Open", GUILayout.Width(50)))
                            {
                                OpenScript(entry.filePath, entry.lineNumber);
                            }
                        }

                        EditorGUILayout.SelectableLabel(
                            entry.message,
                            EditorStyles.wordWrappedLabel,
                            GUILayout.MinHeight(30));

                        if (!string.IsNullOrEmpty(entry.stackTrace))
                        {
                            var lines = entry.stackTrace.Split('\n');
                            string preview = string.Join("\n",
                                lines, 0, Math.Min(3, lines.Length));
                            EditorGUILayout.LabelField(preview, EditorStyles.miniLabel);
                        }
                    }

                    EditorGUILayout.Space(2);
                }
            }
        }

        private static void OpenScript(string filePath, int lineNumber)
        {
            // Try project-relative path first, then absolute
            var asset = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(filePath);
            if (asset != null)
            {
                AssetDatabase.OpenAsset(asset, lineNumber >= 0 ? lineNumber : 0);
            }
            else if (File.Exists(filePath))
            {
                // Absolute path — open directly
                InternalEditorUtility_OpenFileAtLineExternal(filePath, lineNumber >= 0 ? lineNumber : 0);
            }
        }

        // Uses the internal Unity method available since 2019.x
        private static void InternalEditorUtility_OpenFileAtLineExternal(string file, int line)
        {
            var method = typeof(UnityEditorInternal.InternalEditorUtility)
                .GetMethod("OpenFileAtLineExternal",
                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
            method?.Invoke(null, new object[] { file, line, 0 });
        }

        private void ExportJson()
        {
            string path = EditorUtility.SaveFilePanel(
                "Export errors to JSON", "", "unity_errors.json", "json");
            if (string.IsNullOrEmpty(path)) return;

            var snapshot = ErrorCollector.GetSnapshot();
            File.WriteAllText(path, JsonUtility.ToJson(snapshot, true));
            Debug.Log($"[VccErrorFix] エラーを書き出しました: {path}");
        }

        private void GenerateVscodeMcpJson()
        {
            // Locate mcp-server/dist/index.js relative to this package
            string packageRoot = FindPackageRoot();
            if (packageRoot == null)
            {
                EditorUtility.DisplayDialog("VCC ErrorFix",
                    "パッケージのルートフォルダが見つかりませんでした。", "OK");
                return;
            }

            string mcpServerPath = Path.Combine(packageRoot, "mcp-server", "dist", "bundle.js")
                .Replace('\\', '/');

            string projectRoot = Path.GetFullPath(
                Path.Combine(Application.dataPath, ".."));
            string vscodePath = Path.Combine(projectRoot, ".vscode");
            Directory.CreateDirectory(vscodePath);

            string mcpJsonPath = Path.Combine(vscodePath, "mcp.json");
            string content = "{\n" +
                "  \"servers\": {\n" +
                "    \"vcc-errorfix\": {\n" +
                "      \"type\": \"stdio\",\n" +
                "      \"command\": \"node\",\n" +
                "      \"args\": [\"" + mcpServerPath.Replace("\"", "\\\"") + "\"],\n" +
                "      \"env\": {\n" +
                $"        \"UNITY_MCP_URL\": \"http://localhost:{ErrorFixSettings.Port}\"\n" +
                "      }\n" +
                "    }\n" +
                "  }\n" +
                "}\n";

            File.WriteAllText(mcpJsonPath, content);
            Debug.Log($"[VccErrorFix] .vscode/mcp.json を生成しました: {mcpJsonPath}");
            EditorUtility.DisplayDialog("VCC ErrorFix",
                $".vscode/mcp.json を生成しました:\n{mcpJsonPath}\n\nVSCodeでこのフォルダを開いてClaudeからMCPを使用できます。",
                "OK");
        }

        private static string FindPackageRoot()
        {
            // Look for this package in the Unity Package Cache or local packages
            string[] guids = AssetDatabase.FindAssets("VccErrorFixEditor", new[] { "Packages" });
            if (guids.Length > 0)
            {
                string asmdefPath = AssetDatabase.GUIDToAssetPath(guids[0]);
                return Path.GetFullPath(Path.Combine(
                    Path.GetDirectoryName(asmdefPath) ?? "", ".."));
            }
            return null;
        }

        private static string TruncatePath(string path, int maxLen)
        {
            if (string.IsNullOrEmpty(path)) return "(unknown)";
            if (path.Length <= maxLen) return path;
            return "..." + path.Substring(path.Length - maxLen + 3);
        }
    }
}
