// Editor page - Markdown viewer and editor
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { MarkdownViewer } from "../components/files/MarkdownViewer";
import type { Highlight, HighlightColor } from "../types";

type EditorMode = "edit" | "reader";

export default function Editor() {
  const { "*": filePath } = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("reader");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Highlight state
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightColors, setHighlightColors] = useState<HighlightColor[]>([]);
  const [fileId, setFileId] = useState<string | null>(null);

  const fullPath = `/${filePath}`;

  // Load file content and colors
  useEffect(() => {
    if (!filePath) {
      setError("No file specified");
      setLoading(false);
      return;
    }

    loadFile();
    loadColors();
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
      setFileId(response.data.metadata.id);

      // Load highlights for this file
      loadHighlights(response.data.metadata.id);
    } else {
      setError(response.error || "Failed to load file");
    }

    setLoading(false);
  };

  const loadHighlights = async (id: string) => {
    const response = await api.getHighlights(id);
    if (response.success && response.data) {
      setHighlights(response.data);
    }
  };

  const loadColors = async () => {
    const response = await api.getHighlightColors();
    if (response.success && response.data) {
      setHighlightColors(response.data);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

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
      // Switch back to reader mode after save? Optional.
    } else {
      setError(data.error || "Failed to save file");
    }

    setSaving(false);
  };

  const handleHighlight = async (startOffset: number, endOffset: number, color: string, textSnapshot: string) => {
    if (!fileId) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newHighlight: Highlight = {
      id: tempId,
      fileId: fileId,
      userId: "currentUser", // Placeholder
      startOffset,
      endOffset,
      color,
      textSnapshot,
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000,
    };

    setHighlights(prev => [...prev, newHighlight]);

    const response = await api.createHighlight({
      fileId,
      startOffset,
      endOffset,
      color,
      textSnapshot
    });

    if (response.success && response.data) {
      // Replace temp with actual
      setHighlights(prev => prev.map(h => h.id === tempId ? response.data! : h));
    } else {
      // Revert on failure
      setHighlights(prev => prev.filter(h => h.id !== tempId));
      console.error("Failed to create highlight", response.error);
    }
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading file...</p>
        </div>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-500 mb-4">⚠️</div>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Error loading file</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={() => navigate("/files")}
            className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Back to Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/files")}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {fullPath.split("/").pop()}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">{fullPath}</p>
              </div>
              {hasChanges && (
                <span className="text-xs text-orange-600 font-medium">• Unsaved changes</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Share Button */}
              <button
                onClick={() => {
                  const email = prompt("Enter email to share with:");
                  if (email) {
                    api.request(`/${fullPath.substring(1)}/share`, {
                      method: "POST",
                      body: JSON.stringify({ email }),
                    }).then(res => {
                      if (res.success) alert("Shared successfully!");
                      else alert("Share failed: " + res.error);
                    });
                  }
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                title="Share"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>

              {/* Mode Toggle */}
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => setMode("reader")}
                  className={`px-3 py-1 text-sm ${
                    mode === "reader"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  Read
                </button>
                <button
                  onClick={() => setMode("edit")}
                  className={`px-3 py-1 text-sm border-l border-gray-300 dark:border-gray-600 ${
                    mode === "edit"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  Edit
                </button>
              </div>

              {/* Save Button (only visible in edit mode or if changes exist) */}
              {(mode === "edit" || hasChanges) && (
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 w-full">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {/* Editor/Viewer Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {mode === "edit" ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-[calc(100vh-180px)]">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-full p-6 font-mono text-sm bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none resize-none"
              placeholder="Write your markdown here..."
              spellCheck={false}
            />
          </div>
        ) : (
          <MarkdownViewer
            content={content}
            highlights={highlights}
            colors={highlightColors}
            onHighlight={handleHighlight}
          />
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      {mode === "edit" && (
        <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+S
          </kbd>{" "}
          to save
        </div>
      )}
    </div>
  );
}
