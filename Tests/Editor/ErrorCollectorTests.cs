using NUnit.Framework;
using RaiTsumugu.VccErrorFix.Editor;

namespace RaiTsumugu.VccErrorFix.Tests.Editor
{
    [TestFixture]
    public class ErrorCollectorTests
    {
        // ─── ParseStackTrace ────────────────────────────────────────────────

        [Test]
        public void ParseStackTrace_MonoFormat_ExtractsFileAndLine()
        {
            string trace = "UnityEngine.Debug:LogError (object)\n" +
                           "MyScript:Update () (at Assets/Scripts/MyScript.cs:42)";
            // Unity rewrites traces to Mono format in console; the internal regex
            // matches "in <file>:<line>" which is the IL2CPP + Mono expanded format.
            // Simulate the expanded format Unity uses internally:
            string expandedTrace = "at MyScript.Update () [0x00000] in Assets/Scripts/MyScript.cs:42";

            ErrorCollector.ParseStackTrace(expandedTrace, out string filePath, out int lineNumber);

            Assert.AreEqual("Assets/Scripts/MyScript.cs", filePath);
            Assert.AreEqual(42, lineNumber);
        }

        [Test]
        public void ParseStackTrace_AbsolutePath_ExtractsCorrectly()
        {
            string trace = "at Foo.Bar () [0x00001] in /abs/path/Assets/Scripts/Foo.cs:99";

            ErrorCollector.ParseStackTrace(trace, out string filePath, out int lineNumber);

            Assert.AreEqual("/abs/path/Assets/Scripts/Foo.cs", filePath);
            Assert.AreEqual(99, lineNumber);
        }

        [Test]
        public void ParseStackTrace_PathWithSpaces_ExtractsCorrectly()
        {
            string trace = "at Foo.Bar () [0x0] in /path/My Project/Assets/Scripts/Foo.cs:5";

            ErrorCollector.ParseStackTrace(trace, out string filePath, out int lineNumber);

            Assert.AreEqual("/path/My Project/Assets/Scripts/Foo.cs", filePath);
            Assert.AreEqual(5, lineNumber);
        }

        [Test]
        public void ParseStackTrace_NullInput_ReturnsDefaults()
        {
            ErrorCollector.ParseStackTrace(null, out string filePath, out int lineNumber);

            Assert.AreEqual(string.Empty, filePath);
            Assert.AreEqual(-1, lineNumber);
        }

        [Test]
        public void ParseStackTrace_EmptyString_ReturnsDefaults()
        {
            ErrorCollector.ParseStackTrace(string.Empty, out string filePath, out int lineNumber);

            Assert.AreEqual(string.Empty, filePath);
            Assert.AreEqual(-1, lineNumber);
        }

        [Test]
        public void ParseStackTrace_NonMatchingTrace_ReturnsDefaults()
        {
            string trace = "NullReferenceException: Object reference not set to an instance";

            ErrorCollector.ParseStackTrace(trace, out string filePath, out int lineNumber);

            Assert.AreEqual(string.Empty, filePath);
            Assert.AreEqual(-1, lineNumber);
        }

        [Test]
        public void ParseStackTrace_MultiLineTrace_UsesFirstMatch()
        {
            string trace =
                "at Outer.Method () [0x0] in Assets/Scripts/Outer.cs:10\n" +
                "at Inner.Method () [0x0] in Assets/Scripts/Inner.cs:20";

            ErrorCollector.ParseStackTrace(trace, out string filePath, out int lineNumber);

            // First match wins
            Assert.AreEqual("Assets/Scripts/Outer.cs", filePath);
            Assert.AreEqual(10, lineNumber);
        }

        // ─── MakeProjectRelative ────────────────────────────────────────────

        [Test]
        public void MakeProjectRelative_EmptyPath_ReturnsEmpty()
        {
            string result = ErrorCollector.MakeProjectRelative(string.Empty);
            Assert.AreEqual(string.Empty, result);
        }

        [Test]
        public void MakeProjectRelative_NullPath_ReturnsEmpty()
        {
            string result = ErrorCollector.MakeProjectRelative(null);
            Assert.AreEqual(string.Empty, result);
        }

        [Test]
        public void MakeProjectRelative_PathOutsideProject_ReturnsUnchanged()
        {
            string externalPath = "/some/other/path/File.cs";
            string result = ErrorCollector.MakeProjectRelative(externalPath);
            Assert.AreEqual(externalPath, result);
        }

        // ─── GetSnapshot ────────────────────────────────────────────────────

        [Test]
        public void GetSnapshot_ReturnsNonNull()
        {
            var snapshot = ErrorCollector.GetSnapshot();
            Assert.IsNotNull(snapshot);
        }

        [Test]
        public void GetSnapshot_EntriesListIsNotNull()
        {
            var snapshot = ErrorCollector.GetSnapshot();
            Assert.IsNotNull(snapshot.entries);
        }

        [Test]
        public void GetSnapshot_UnityVersionIsPopulated()
        {
            var snapshot = ErrorCollector.GetSnapshot();
            Assert.IsNotEmpty(snapshot.unityVersion);
        }

        [Test]
        public void GetSnapshot_ProjectPathIsPopulated()
        {
            var snapshot = ErrorCollector.GetSnapshot();
            Assert.IsNotEmpty(snapshot.projectPath);
        }

        // ─── ClearEntries ────────────────────────────────────────────────────

        [Test]
        public void ClearEntries_SetsEntryCountToZero()
        {
            // EntryCount may or may not be zero at test start; clearing guarantees zero.
            ErrorCollector.ClearEntries();
            Assert.AreEqual(0, ErrorCollector.EntryCount);
        }

        [Test]
        public void ClearEntries_CalledTwice_StillZero()
        {
            ErrorCollector.ClearEntries();
            ErrorCollector.ClearEntries();
            Assert.AreEqual(0, ErrorCollector.EntryCount);
        }
    }
}
