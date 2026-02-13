// HighlightManager - Manages text highlighting in the editor
import { useState, useEffect, useCallback } from "react";
import { api } from "../../services/api";
import type { Highlight } from "../../types";
import ColorPicker from "./ColorPicker";

interface HighlightManagerProps {
  fileId: string;
  content: string;
  onHighlightsChange?: (highlights: Highlight[]) => void;
}

export default function HighlightManager({
  fileId,
  content,
  onHighlightsChange,
}: HighlightManagerProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState<{
    text: string;
    startOffset: number;
    endOffset: number;
  } | null>(null);

  // Load highlights on mount
  useEffect(() => {
    loadHighlights();
  }, [fileId]);

  const loadHighlights = async () => {
    const response = await api.getHighlights(fileId);
    if (response.success && response.data) {
      setHighlights(response.data);
      onHighlightsChange?.(response.data);
    }
  };

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowColorPicker(false);
      return;
    }

    const text = selection.toString();
    const range = selection.getRangeAt(0);

    // Calculate offset in the content string
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(document.getElementById("markdown-content")!);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preCaretRange.toString().length;
    const endOffset = startOffset + text.length;

    setSelectedText({ text, startOffset, endOffset });

    // Position color picker near selection
    const rect = range.getBoundingClientRect();
    setPickerPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + window.scrollY + 10,
    });
    setShowColorPicker(true);
  }, []);

  const handleColorSelect = async (color: string) => {
    if (!selectedText) return;

    const response = await api.createHighlight({
      fileId,
      userId: "", // Will be set by backend from session
      startOffset: selectedText.startOffset,
      endOffset: selectedText.endOffset,
      color,
      textSnapshot: selectedText.text,
      createdAt: 0,
      updatedAt: 0,
    });

    if (response.success && response.data) {
      const newHighlights = [...highlights, response.data];
      setHighlights(newHighlights);
      onHighlightsChange?.(newHighlights);
    }

    setShowColorPicker(false);
    setSelectedText(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    const response = await api.deleteHighlight(highlightId);
    if (response.success) {
      const newHighlights = highlights.filter((h) => h.id !== highlightId);
      setHighlights(newHighlights);
      onHighlightsChange?.(newHighlights);
    }
  };

  // Apply highlights to content
  const renderHighlightedContent = () => {
    if (highlights.length === 0) return content;

    // Sort highlights by start position
    const sortedHighlights = [...highlights].sort(
      (a, b) => a.startOffset - b.startOffset
    );

    let result = "";
    let lastIndex = 0;

    sortedHighlights.forEach((highlight) => {
      // Add text before highlight
      result += content.substring(lastIndex, highlight.startOffset);

      // Add highlighted text
      result += `<mark style="background-color: ${highlight.color}; cursor: pointer;" data-highlight-id="${highlight.id}" title="Click to remove">${content.substring(
        highlight.startOffset,
        highlight.endOffset
      )}</mark>`;

      lastIndex = highlight.endOffset;
    });

    // Add remaining text
    result += content.substring(lastIndex);

    return result;
  };

  return (
    <div>
      <div
        id="markdown-content"
        onMouseUp={handleTextSelection}
        className="select-text cursor-text"
        dangerouslySetInnerHTML={{ __html: renderHighlightedContent() }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "MARK") {
            const highlightId = target.dataset.highlightId;
            if (highlightId && confirm("Remove this highlight?")) {
              handleDeleteHighlight(highlightId);
            }
          }
        }}
      />

      {showColorPicker && (
        <ColorPicker
          position={pickerPosition}
          onColorSelect={handleColorSelect}
          onClose={() => setShowColorPicker(false)}
        />
      )}

      {/* Highlight List */}
      {highlights.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Your Highlights ({highlights.length})
          </h3>
          <div className="space-y-2">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50"
              >
                <div
                  className="w-4 h-4 rounded mt-1 flex-shrink-0"
                  style={{ backgroundColor: highlight.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {highlight.textSnapshot}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(highlight.createdAt * 1000).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteHighlight(highlight.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
