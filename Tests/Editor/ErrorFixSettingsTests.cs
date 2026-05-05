using NUnit.Framework;
using UnityEditor;
using RaiTsumugu.VccErrorFix.Editor;

namespace RaiTsumugu.VccErrorFix.Tests.Editor
{
    [TestFixture]
    public class ErrorFixSettingsTests
    {
        private const string KeyPort = "VccErrorFix.Port";
        private const string KeyAutoOpen = "VccErrorFix.AutoOpenOnError";

        [SetUp]
        public void SetUp()
        {
            // Reset to defaults before each test
            EditorPrefs.DeleteKey(KeyPort);
            EditorPrefs.DeleteKey(KeyAutoOpen);
        }

        [TearDown]
        public void TearDown()
        {
            EditorPrefs.DeleteKey(KeyPort);
            EditorPrefs.DeleteKey(KeyAutoOpen);
        }

        [Test]
        public void Port_DefaultValue_Is7300()
        {
            Assert.AreEqual(7300, ErrorFixSettings.Port);
        }

        [Test]
        public void Port_SetAndGet_RoundTrip()
        {
            ErrorFixSettings.Port = 8080;
            Assert.AreEqual(8080, ErrorFixSettings.Port);
        }

        [Test]
        public void Port_SetToNonStandardPort_Persists()
        {
            ErrorFixSettings.Port = 12345;
            Assert.AreEqual(12345, ErrorFixSettings.Port);
        }

        [Test]
        public void HttpPrefix_DefaultPort_CorrectFormat()
        {
            Assert.AreEqual("http://localhost:7300/", ErrorFixSettings.HttpPrefix);
        }

        [Test]
        public void HttpPrefix_CustomPort_ReflectsChange()
        {
            ErrorFixSettings.Port = 9000;
            Assert.AreEqual("http://localhost:9000/", ErrorFixSettings.HttpPrefix);
        }

        [Test]
        public void AutoOpenOnError_DefaultValue_IsFalse()
        {
            Assert.IsFalse(ErrorFixSettings.AutoOpenOnError);
        }

        [Test]
        public void AutoOpenOnError_SetTrue_Persists()
        {
            ErrorFixSettings.AutoOpenOnError = true;
            Assert.IsTrue(ErrorFixSettings.AutoOpenOnError);
        }

        [Test]
        public void AutoOpenOnError_Toggle_WorksBothWays()
        {
            ErrorFixSettings.AutoOpenOnError = true;
            Assert.IsTrue(ErrorFixSettings.AutoOpenOnError);

            ErrorFixSettings.AutoOpenOnError = false;
            Assert.IsFalse(ErrorFixSettings.AutoOpenOnError);
        }
    }
}
