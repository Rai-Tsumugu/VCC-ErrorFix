using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Threading;
using UnityEditor;
using UnityEngine;

namespace RaiTsumugu.VccErrorFix.Editor
{
    [InitializeOnLoad]
    public static class HttpServer
    {
        private static HttpListener _listener;
        private static Thread _thread;
        private static volatile bool _running;

        public static bool IsRunning => _running;

        static HttpServer()
        {
            Start();
            AssemblyReloadEvents.beforeAssemblyReload += Stop;
            EditorApplication.quitting += Stop;
        }

        public static void Start()
        {
            if (_running) return;

            _listener = new HttpListener();
            _listener.Prefixes.Add(ErrorFixSettings.HttpPrefix);

            try
            {
                _listener.Start();
            }
            catch (HttpListenerException ex)
            {
                Debug.LogWarning(
                    $"[VccErrorFix] HTTPサーバーをポート {ErrorFixSettings.Port} で起動できませんでした: {ex.Message}\n" +
                    $"別のプロセスがポートを使用中の可能性があります。Settings から別のポートを設定してください。");
                return;
            }

            _running = true;
            _thread = new Thread(ListenLoop)
            {
                IsBackground = true,
                Name = "VccErrorFix-HttpServer"
            };
            _thread.Start();

            Debug.Log($"[VccErrorFix] HTTPサーバー起動: {ErrorFixSettings.HttpPrefix}");
        }

        public static void Stop()
        {
            _running = false;
            try { _listener?.Stop(); } catch { /* already stopped */ }
            _thread?.Join(500);
            _listener = null;
        }

        public static void Restart()
        {
            Stop();
            Start();
        }

        private static void ListenLoop()
        {
            while (_running)
            {
                HttpListenerContext ctx;
                try
                {
                    ctx = _listener.GetContext();
                }
                catch (HttpListenerException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[VccErrorFix] HttpListener エラー: {ex.Message}");
                    break;
                }

                ThreadPool.QueueUserWorkItem(_ => HandleRequest(ctx));
            }
        }

        private static void HandleRequest(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;

            res.AddHeader("Access-Control-Allow-Origin", "*");
            res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.ContentType = "application/json; charset=utf-8";

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            string path = req.Url.AbsolutePath.TrimEnd('/');
            string body;

            try
            {
                switch (path)
                {
                    case "/errors":
                        body = HandleErrors(req);
                        break;
                    case "/warnings":
                        body = HandleWarnings();
                        break;
                    case "/clear":
                        body = HandleClear(req);
                        break;
                    case "/structure":
                        body = HandleStructure();
                        break;
                    case "/health":
                        body = $"{{\"status\":\"ok\",\"port\":{ErrorFixSettings.Port}}}";
                        break;
                    default:
                        res.StatusCode = 404;
                        body = "{\"error\":\"not found\"}";
                        break;
                }
            }
            catch (Exception ex)
            {
                res.StatusCode = 500;
                body = $"{{\"error\":\"{Escape(ex.Message)}\"}}";
            }

            byte[] bytes = Encoding.UTF8.GetBytes(body);
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        private static string HandleErrors(HttpListenerRequest req)
        {
            var snapshot = ErrorCollector.GetSnapshot();
            string filter = req.QueryString["type"];

            if (filter == "compilation")
                snapshot.entries.RemoveAll(e => e.errorType != ErrorType.CompilationError);
            else if (filter == "runtime")
                snapshot.entries.RemoveAll(e => e.errorType != ErrorType.RuntimeError);
            else
                snapshot.entries.RemoveAll(e =>
                    e.errorType == ErrorType.RuntimeWarning ||
                    e.errorType == ErrorType.CompilationWarning ||
                    e.errorType == ErrorType.RuntimeLog);

            return JsonUtility.ToJson(snapshot);
        }

        private static string HandleWarnings()
        {
            var snapshot = ErrorCollector.GetSnapshot();
            snapshot.entries.RemoveAll(e =>
                e.errorType != ErrorType.CompilationWarning &&
                e.errorType != ErrorType.RuntimeWarning);
            return JsonUtility.ToJson(snapshot);
        }

        private static string HandleClear(HttpListenerRequest req)
        {
            if (req.HttpMethod != "POST")
                return "{\"error\":\"POST required\"}";
            ErrorCollector.ClearEntries();
            return "{\"cleared\":true}";
        }

        private static string HandleStructure()
        {
            string assetsPath = Application.dataPath;
            var root = BuildDirectoryNode(assetsPath, Application.dataPath, depth: 0, maxDepth: 3);
            var response = new ProjectStructureResponse { assets = root };
            return JsonUtility.ToJson(response);
        }

        private static DirectoryNode BuildDirectoryNode(
            string dir, string assetsRoot, int depth, int maxDepth)
        {
            var node = new DirectoryNode
            {
                name = System.IO.Path.GetFileName(dir),
                path = "Assets" + dir.Substring(assetsRoot.Length).Replace('\\', '/'),
                children = new List<DirectoryNode>()
            };

            if (depth >= maxDepth) return node;

            try
            {
                foreach (var sub in System.IO.Directory.GetDirectories(dir))
                {
                    string name = System.IO.Path.GetFileName(sub);
                    if (name.StartsWith(".")) continue;
                    node.children.Add(BuildDirectoryNode(sub, assetsRoot, depth + 1, maxDepth));
                }
            }
            catch { /* skip unreadable dirs */ }

            return node;
        }

        private static string Escape(string s) =>
            s?.Replace("\\", "\\\\").Replace("\"", "\\\"")
              .Replace("\n", "\\n").Replace("\r", "\\r") ?? "";
    }
}
