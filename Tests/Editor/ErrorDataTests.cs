using NUnit.Framework;
using UnityEngine;
using RaiTsumugu.VccErrorFix.Editor;
using System.Collections.Generic;

namespace RaiTsumugu.VccErrorFix.Tests.Editor
{
    [TestFixture]
    public class ErrorDataTests
    {
        [Test]
        public void ErrorType_CompilationError_HasValue0()
        {
            Assert.AreEqual(0, (int)ErrorType.CompilationError);
        }

        [Test]
        public void ErrorType_AllValuesAreDistinct()
        {
            var values = System.Enum.GetValues(typeof(ErrorType));
            var set = new System.Collections.Generic.HashSet<int>();
            foreach (ErrorType v in values)
                Assert.IsTrue(set.Add((int)v), $"Duplicate enum value: {v}");
        }

        [Test]
        public void UnityLogEntry_JsonUtility_RoundTrip()
        {
            var entry = new UnityLogEntry
            {
                id = "test-id",
                errorType = ErrorType.RuntimeError,
                errorTypeString = "RuntimeError",
                message = "NullReferenceException",
                stackTrace = "at Foo.Bar()",
                filePath = "Assets/Scripts/Foo.cs",
                lineNumber = 99,
                timestamp = "2026-05-05T00:00:00Z"
            };

            string json = JsonUtility.ToJson(entry);
            Assert.IsNotEmpty(json);
            Assert.IsTrue(json.Contains("NullReferenceException"));
            Assert.IsTrue(json.Contains("Assets/Scripts/Foo.cs"));

            var deserialized = JsonUtility.FromJson<UnityLogEntry>(json);
            Assert.AreEqual(entry.id, deserialized.id);
            Assert.AreEqual(entry.message, deserialized.message);
            Assert.AreEqual(entry.filePath, deserialized.filePath);
            Assert.AreEqual(entry.lineNumber, deserialized.lineNumber);
            Assert.AreEqual(entry.errorTypeString, deserialized.errorTypeString);
        }

        [Test]
        public void ErrorSnapshot_JsonUtility_SerializesEntries()
        {
            var snapshot = new ErrorSnapshot
            {
                entries = new List<UnityLogEntry>
                {
                    new UnityLogEntry
                    {
                        id = "1",
                        errorType = ErrorType.CompilationError,
                        errorTypeString = "CompilationError",
                        message = "CS0103",
                        stackTrace = "",
                        filePath = "Assets/S.cs",
                        lineNumber = 1,
                        timestamp = "2026-05-05T00:00:00Z"
                    }
                },
                isCompiling = false,
                isPlayMode = false,
                projectPath = "/project",
                unityVersion = "2022.3.22f1"
            };

            string json = JsonUtility.ToJson(snapshot);
            Assert.IsNotEmpty(json);
            Assert.IsTrue(json.Contains("CS0103"));
            Assert.IsTrue(json.Contains("CompilationError"));

            var deserialized = JsonUtility.FromJson<ErrorSnapshot>(json);
            Assert.AreEqual(1, deserialized.entries.Count);
            Assert.AreEqual("CS0103", deserialized.entries[0].message);
        }

        [Test]
        public void ErrorSnapshot_EmptyEntries_Serializes()
        {
            var snapshot = new ErrorSnapshot
            {
                entries = new List<UnityLogEntry>(),
                isCompiling = true,
                isPlayMode = false,
                projectPath = "/p",
                unityVersion = "2022.3"
            };

            string json = JsonUtility.ToJson(snapshot);
            var deserialized = JsonUtility.FromJson<ErrorSnapshot>(json);
            Assert.IsNotNull(deserialized.entries);
            Assert.AreEqual(0, deserialized.entries.Count);
            Assert.IsTrue(deserialized.isCompiling);
        }

        [Test]
        public void DirectoryNode_JsonUtility_RoundTrip()
        {
            var node = new DirectoryNode
            {
                name = "Assets",
                path = "Assets",
                children = new List<DirectoryNode>
                {
                    new DirectoryNode { name = "Scripts", path = "Assets/Scripts", children = new List<DirectoryNode>() }
                }
            };

            string json = JsonUtility.ToJson(node);
            Assert.IsTrue(json.Contains("Scripts"));
        }
    }
}
