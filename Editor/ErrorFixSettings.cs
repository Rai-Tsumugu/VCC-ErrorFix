using UnityEditor;

namespace RaiTsumugu.VccErrorFix.Editor
{
    public static class ErrorFixSettings
    {
        private const string KeyPort = "VccErrorFix.Port";
        private const string KeyAutoOpen = "VccErrorFix.AutoOpenOnError";
        public const int DefaultPort = 7300;

        public static int Port
        {
            get => EditorPrefs.GetInt(KeyPort, DefaultPort);
            set => EditorPrefs.SetInt(KeyPort, value);
        }

        public static bool AutoOpenOnError
        {
            get => EditorPrefs.GetBool(KeyAutoOpen, false);
            set => EditorPrefs.SetBool(KeyAutoOpen, value);
        }

        public static string HttpPrefix => $"http://localhost:{Port}/";
    }
}
