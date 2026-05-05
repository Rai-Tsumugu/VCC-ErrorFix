using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.Compilation;
using UnityEngine;

namespace RaiTsumugu.VccErrorFix.Editor
{
    [InitializeOnLoad]
    public static class ErrorCollector
    {
        private static readonly object Lock = new object();
        private static readonly List<UnityLogEntry> Entries = new List<UnityLogEntry>();
        private static bool _isCompiling;

        // Matches both Mono and IL2CPP stack trace formats:
        // "in /abs/path/File.cs:42" or "in Assets/Scripts/File.cs:42"
        private static readonly Regex StackTraceRegex = new Regex(
            @"in (?<file>.+\.cs):(?<line>\d+)",
            RegexOptions.Compiled | RegexOptions.Multiline
        );

        static ErrorCollector()
        {
            CompilationPipeline.compilationStarted += OnCompilationStarted;
            CompilationPipeline.compilationFinished += OnCompilationFinished;
            CompilationPipeline.assemblyCompilationFinished += OnAssemblyCompilationFinished;
            Application.logMessageReceived += OnLogMessageReceived;
            AssemblyReloadEvents.beforeAssemblyReload += OnBeforeAssemblyReload;
        }

        private static void OnCompilationStarted(object context)
        {
            lock (Lock)
            {
                _isCompiling = true;
                Entries.RemoveAll(e =>
                    e.errorType == ErrorType.CompilationError ||
                    e.errorType == ErrorType.CompilationWarning);
            }
        }

        private static void OnCompilationFinished(object context)
        {
            lock (Lock) { _isCompiling = false; }
        }

        private static void OnAssemblyCompilationFinished(string assemblyPath, CompilerMessage[] messages)
        {
            lock (Lock)
            {
                foreach (var msg in messages)
                {
                    var errorType = msg.type == CompilerMessageType.Error
                        ? ErrorType.CompilationError
                        : ErrorType.CompilationWarning;

                    Entries.Add(new UnityLogEntry
                    {
                        id = Guid.NewGuid().ToString(),
                        errorType = errorType,
                        errorTypeString = errorType.ToString(),
                        message = msg.message,
                        stackTrace = string.Empty,
                        filePath = MakeProjectRelative(msg.file),
                        lineNumber = msg.line,
                        timestamp = DateTime.UtcNow.ToString("o")
                    });
                }
            }

            if (ErrorFixSettings.AutoOpenOnError)
            {
                bool hasErrors;
                lock (Lock)
                {
                    hasErrors = Entries.Exists(e => e.errorType == ErrorType.CompilationError);
                }
                if (hasErrors)
                    EditorApplication.delayCall += ErrorFixEditorWindow.Open;
            }
        }

        private static void OnLogMessageReceived(string logString, string stackTrace, LogType logType)
        {
            // During compilation Unity may echo compiler messages — skip them.
            // OnAssemblyCompilationFinished gives richer structured data.
            if (_isCompiling) return;

            ErrorType errorType;
            switch (logType)
            {
                case LogType.Error:
                case LogType.Exception:
                case LogType.Assert:
                    errorType = EditorApplication.isPlayingOrWillChangePlaymode
                        ? ErrorType.RuntimeError
                        : ErrorType.CompilationError;
                    break;
                case LogType.Warning:
                    errorType = EditorApplication.isPlayingOrWillChangePlaymode
                        ? ErrorType.RuntimeWarning
                        : ErrorType.CompilationWarning;
                    break;
                default:
                    errorType = ErrorType.RuntimeLog;
                    break;
            }

            ParseStackTrace(stackTrace, out string filePath, out int lineNumber);

            lock (Lock)
            {
                Entries.Add(new UnityLogEntry
                {
                    id = Guid.NewGuid().ToString(),
                    errorType = errorType,
                    errorTypeString = errorType.ToString(),
                    message = logString,
                    stackTrace = stackTrace,
                    filePath = MakeProjectRelative(filePath),
                    lineNumber = lineNumber,
                    timestamp = DateTime.UtcNow.ToString("o")
                });
            }

            if (ErrorFixSettings.AutoOpenOnError &&
                (errorType == ErrorType.RuntimeError || errorType == ErrorType.CompilationError))
            {
                EditorApplication.delayCall += ErrorFixEditorWindow.Open;
            }
        }

        private static void OnBeforeAssemblyReload()
        {
            lock (Lock)
            {
                Entries.RemoveAll(e =>
                    e.errorType == ErrorType.CompilationError ||
                    e.errorType == ErrorType.CompilationWarning);
            }
        }

        internal static void ParseStackTrace(string stackTrace, out string filePath, out int lineNumber)
        {
            filePath = string.Empty;
            lineNumber = -1;
            if (string.IsNullOrEmpty(stackTrace)) return;

            var match = StackTraceRegex.Match(stackTrace);
            if (!match.Success) return;

            filePath = match.Groups["file"].Value;
            int.TryParse(match.Groups["line"].Value, out lineNumber);
        }

        internal static string MakeProjectRelative(string absolutePath)
        {
            if (string.IsNullOrEmpty(absolutePath)) return string.Empty;
            string projectRoot = System.IO.Path.GetFullPath(
                System.IO.Path.Combine(Application.dataPath, ".."));
            if (absolutePath.StartsWith(projectRoot, StringComparison.OrdinalIgnoreCase))
                return absolutePath.Substring(projectRoot.Length).TrimStart('/', '\\');
            return absolutePath;
        }

        public static ErrorSnapshot GetSnapshot()
        {
            lock (Lock)
            {
                return new ErrorSnapshot
                {
                    entries = new List<UnityLogEntry>(Entries),
                    isCompiling = _isCompiling,
                    isPlayMode = EditorApplication.isPlayingOrWillChangePlaymode,
                    projectPath = System.IO.Path.GetFullPath(
                        System.IO.Path.Combine(Application.dataPath, "..")),
                    unityVersion = Application.unityVersion
                };
            }
        }

        public static int EntryCount
        {
            get { lock (Lock) { return Entries.Count; } }
        }

        public static void ClearEntries()
        {
            lock (Lock) { Entries.Clear(); }
        }
    }
}
