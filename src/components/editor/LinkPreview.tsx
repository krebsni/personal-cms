// LinkPreview - Hover preview for internal links
import { useState, useEffect } from "react";
import { api } from "../../services/api";
import MarkdownRenderer from "./MarkdownRenderer";

interface LinkPreviewProps {
  href: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function LinkPreview({ href, position, onClose }: LinkPreviewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, [href]);

  const loadPreview = async () => {
    // Only preview internal links (file paths)
    if (!href.startsWith("/")) {
      setError("External link - no preview available");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const response = await api.getFile(href);

    if (response.success && response.data) {
      // Truncate content to first 500 characters for preview
      const previewContent = response.data.content.substring(0, 500);
      setContent(previewContent + (response.data.content.length > 500 ? "..." : ""));
    } else {
      setError("Failed to load preview");
    }

    setLoading(false);
  };

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-96 overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseLeave={onClose}
    >
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="text-xs font-medium text-gray-700 truncate">{href}</div>
      </div>

      <div className="p-4 overflow-y-auto max-h-80">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-sm text-gray-500 italic">{error}</div>
        ) : (
          <div className="text-sm">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>

      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        Click to open file
      </div>
    </div>
  );
}
