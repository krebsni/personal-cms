// Editor page - Markdown viewer and editor
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import MarkdownRenderer from "../components/editor/MarkdownRenderer";

type EditorMode = "edit" | "preview" | "split";

export default function Editor() {
  const { "*": filePath } = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("split");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fullPath = `/${filePath}`;

  // Load file content
  useEffect(() => {
    if (!filePath) {
      setError("No file specified");
      setLoading(false);
      return;
    }

    loadFile();
  }, [filePath]);

  // Track changes
  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);

    const response = await api.getFile(fullPath);

    if (response.success && response.data) {
      const fileContent = response.data.content || "";
      setContent(fileContent);
      setOriginalContent(fileContent);
    } else {
      setError(response.error || "Failed to load file");
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Create JSON body for update
    const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/files${fullPath}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ content }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      setOriginalContent(content);
      setHasChanges(false);
    } else {
      setError(data.error || "Failed to save file");
    }

    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd+S / Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (hasChanges && !saving) {
        handleSave();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading file...</p>
        </div>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading file</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <button
            onClick={() => navigate("/files")}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Back to Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/files")}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {fullPath.split("/").pop()}
                </h1>
                <p className="text-xs text-gray-500">{fullPath}</p>
              </div>
              {hasChanges && (
                <span className="text-xs text-orange-600 font-medium">• Unsaved changes</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Mode Toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setMode("edit")}
                  className={`px-3 py-1 text-sm ${
                    mode === "edit"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setMode("split")}
                  className={`px-3 py-1 text-sm border-l border-gray-300 ${
                    mode === "split"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Split
                </button>
                <button
                  onClick={() => setMode("preview")}
                  className={`px-3 py-1 text-sm border-l border-gray-300 ${
                    mode === "preview"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Preview
                </button>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div
          className={`grid gap-6 ${
            mode === "split" ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {/* Edit Mode */}
          {(mode === "edit" || mode === "split") && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
                <h2 className="text-sm font-medium text-gray-700">Editor</h2>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-[calc(100vh-240px)] p-4 font-mono text-sm focus:outline-none resize-none"
                placeholder="Write your markdown here..."
                spellCheck={false}
              />
            </div>
          )}

          {/* Preview Mode */}
          {(mode === "preview" || mode === "split") && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200 px-4 py-2 bg-gray-50">
                <h2 className="text-sm font-medium text-gray-700">Preview</h2>
              </div>
              <div className="p-6 overflow-y-auto h-[calc(100vh-240px)]">
                <MarkdownRenderer content={content} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded">
          {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+S
        </kbd>{" "}
        to save
      </div>
    </div>
  );
}
