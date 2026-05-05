using System;
using System.Collections.Generic;

namespace RaiTsumugu.VccErrorFix.Editor
{
    [Serializable]
    public enum ErrorType
    {
        CompilationError,
        CompilationWarning,
        RuntimeError,
        RuntimeWarning,
        RuntimeLog
    }

    [Serializable]
    public class UnityLogEntry
    {
        public string id;
        public ErrorType errorType;
        public string errorTypeString;
        public string message;
        public string stackTrace;
        public string filePath;
        public int lineNumber;
        public string timestamp;
    }

    [Serializable]
    public class ErrorSnapshot
    {
        public List<UnityLogEntry> entries;
        public bool isCompiling;
        public bool isPlayMode;
        public string projectPath;
        public string unityVersion;
    }

    [Serializable]
    public class ProjectStructureResponse
    {
        public DirectoryNode assets;
    }

    [Serializable]
    public class DirectoryNode
    {
        public string name;
        public string path;
        public List<DirectoryNode> children;
    }
}
