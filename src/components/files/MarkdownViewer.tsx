import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Highlight, HighlightColor } from "../../types";
import { HighlightMenu } from "./HighlightMenu";

interface MarkdownViewerProps {
  content: string;
  highlights: Highlight[];
  colors: HighlightColor[];
  onHighlight: (startOffset: number, endOffset: number, color: string, textSnapshot: string) => void;
  onDeleteHighlight?: (id: string) => void;
}

export function MarkdownViewer({ content, highlights, colors, onHighlight }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);

  // Handle text selection
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current?.contains(selection.anchorNode)) {
        setMenuPosition(null);
        setSelection(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Calculate offset relative to the text content... this is tricky with rendered markdown.
      // For a robust implementation, we might need a more complex approach to map DOM range to markdown source offset.
      // FOR NOW (MVP): We will rely on the "textSnapshot" for verifying highlights,
      // and finding the offset might be simplified or approximate.
      // actually, implementing exact offset mapping from rendered HTML back to Markdown source is very hard.
      // ALTERNATIVE: Just store the selected text and context, or use a library.
      // Let's try to get a rough offset if possible, or just pass the text.

      // Simplified approach: Just pass the text snapshot. Backend/Frontend sync might be imperfect for edits.
      // But user wants "Obsidian-like". Obsidian uses an editor (CodeMirror) which handles this.
      // Since we are in "Viewer" mode, we are rendering HTML.
      // Let's assume we just want to highlight the VIEW for now.

      setMenuPosition({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      });

      setSelection({
        start: 0, // Placeholder
        end: 0,   // Placeholder
        text: selection.toString(),
      });
    };

    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  const handleColorSelect = (color: string) => {
    if (selection) {
      // In a real implementation, we would calculate exact offsets here.
      // For this MVP, we will pass 0,0 and rely on the text snapshot or implement a better search later.
      onHighlight(selection.start, selection.end, color, selection.text);
      setMenuPosition(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  // Custom renderer to apply highlights
  // This is checking if the text node matches any highlight.
  // A robust implementation would parse the markdown AND the highlights and merge them.
  // For MVP, allow the native selection to work first.
  // TODO: Implement rendering of existing highlights (using 'highlights' prop)
  // This would require more complex rendering logic or a library like 'react-highlight-words' adapted for MD.

  return (
    <div className="relative group">
      <div
        ref={containerRef}
        className="prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white
          prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-p:leading-relaxed
          prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-gray-900 dark:prose-strong:text-white
          prose-code:text-pink-600 dark:prose-code:text-pink-400
          prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900
          bg-white dark:bg-gray-950 p-8 rounded-lg shadow-sm min-h-[500px]"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>

      <HighlightMenu
        position={menuPosition}
        colors={colors}
        onSelectColor={handleColorSelect}
        onClose={() => setMenuPosition(null)}
      />
    </div>
  );
}
