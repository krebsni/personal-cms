import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { PersistentHighlights } from '../../lib/tiptap/persistentHighlights';
import { useFetchColors, useFetchHighlights, useCreateHighlight, useDeleteHighlight } from '../../hooks/useAdminApi';
import { useFetchFile, useUpdateFile } from '../../hooks/useRepositoriesApi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Edit3, Type } from 'lucide-react';

interface MarkdownEditorProps {
  fileId: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ fileId }) => {
  const [mode, setMode] = useState<'source' | 'highlight'>('highlight');

  // Real data from backend
  const { data: fileData, isLoading: fileLoading } = useFetchFile(fileId);
  const updateFileMutation = useUpdateFile(fileId);

  const [sourceCode, setSourceCode] = useState('');

  // Update sourceCode locally when file data is fetched
  useEffect(() => {
    if (fileData?.content && !sourceCode) {
      setSourceCode(fileData.content);
    }
  }, [fileData?.content]);

  const { data: colors = [] } = useFetchColors();
  const { data: highlights = [] } = useFetchHighlights(fileId);
  const createHighlightMutation = useCreateHighlight(fileId);
  const deleteHighlightMutation = useDeleteHighlight(fileId);

  const [menuPos, setMenuPos] = useState<{ top: number, left: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      PersistentHighlights.configure({
        highlights,
        colors,
      })
    ],
    content: fileData?.content || '',
    editable: false, // In Highlight mode, text isn't directly editable, only stylable via highlights
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] leading-relaxed',
      },
    },
  });

  // Sync editor highlights if data updates from server
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
       editor.commands.updateAttributes('persistentHighlights', { highlights, colors });
       // Force a re-render of decorations by pushing a dummy transaction
       editor.view.dispatch(editor.state.tr.setMeta('updateDecorations', true));
    }
  }, [editor, highlights, colors]);

  // Sync editor content if fileData changes from backend
  useEffect(() => {
    if (editor && fileData?.content !== undefined && editor.getHTML() !== fileData.content) {
      // Small timeout avoids flushing while rendering
      setTimeout(() => {
        editor.commands.setContent(fileData.content || '');
      });
    }
  }, [editor, fileData?.content]);

  useEffect(() => {
    if (!editor) return;

    const updateMenu = () => {
      const { from, to, empty } = editor.state.selection;

      if (empty || mode !== 'highlight' || !editorRef.current) {
        setMenuPos(null);
        return;
      }

      // Get coords of selection
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const containerRect = editorRef.current.getBoundingClientRect();

      setMenuPos({
        top: start.top - containerRect.top - 50, // 50px above selection
        left: start.left - containerRect.left + (end.left - start.left) / 2 - 100 // Center menu
      });
    };

    editor.on('selectionUpdate', updateMenu);
    editor.on('blur', () => setTimeout(() => setMenuPos(null), 200)); // Delay to allow click on menu

    return () => {
      editor.off('selectionUpdate', updateMenu);
      editor.off('blur', () => setMenuPos(null));
    };
  }, [editor, mode]);

  if (!editor) {
    return null;
  }

  const handleApplyHighlight = async (colorId: string) => {
    const { from, to } = editor.state.selection;
    if (from === to) return; // No text selected

    const textContent = editor.state.doc.textBetween(from, to, ' ');

    // Save to backend via TanStack Query mutation
    await createHighlightMutation.mutateAsync({
      startOffset: from,
      endOffset: to,
      textContent,
      colorId
    });
  };

  const handleClearHighlight = async () => {
    // Find if the current selection is within an existing highlight
    const { from, to } = editor.state.selection;

    // Check if there is a highlight covering the current selection
    // Note: A more robust implementation would check the actual marks at the cursor position
    const activeHighlight = highlights.find(h =>
      (from >= h.start_offset && from < h.end_offset) ||
      (to > h.start_offset && to <= h.end_offset) ||
      (from <= h.start_offset && to >= h.end_offset)
    );

    if (activeHighlight) {
      await deleteHighlightMutation.mutateAsync(activeHighlight.id);
    }
  };

  const handleSaveSource = async () => {
    await updateFileMutation.mutateAsync({
      content: sourceCode
    });
  };

  if (fileLoading) {
    return <div className="flex-1 flex justify-center mt-20 text-muted-foreground">Loading file...</div>;
  }

  return (
    <div className="w-full flex-1 flex flex-col bg-background relative relative">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border bg-muted/40 absolute top-0 right-0 z-10 w-full h-12">
        <div className="flex gap-2">
           <Button
            variant={mode === 'highlight' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('highlight')}
            className="h-8"
          >
            <Type className="w-4 h-4 mr-2" />
            Highlight Mode
          </Button>
          <Button
            variant={mode === 'source' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('source')}
            className="h-8"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Source Mode
          </Button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto pt-16 pb-20 px-8 relative" ref={editorRef}>
        {mode === 'highlight' ? (
          <>
            {menuPos && (
              <div
                className="absolute z-50 transition-all duration-150"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <Card className="flex items-center gap-1 p-1 bg-popover border-border shadow-lg">
                  {colors.map((mc) => (
                    <button
                      key={mc.id}
                      title={mc.name}
                      className="w-8 h-8 rounded-full border border-border flex items-center justify-center transition-transform hover:scale-110 shrink-0"
                      style={{ backgroundColor: mc.hex_code }}
                      onClick={() => handleApplyHighlight(mc.id)}
                      disabled={createHighlightMutation.isPending}
                    />
                  ))}
                  <div className="w-px h-6 bg-border mx-1" />
                   <Button
                     variant="ghost"
                     size="sm"
                     className="h-8 text-xs font-semibold px-2 hover:bg-destructive hover:text-destructive-foreground"
                     disabled={createHighlightMutation.isPending || deleteHighlightMutation.isPending}
                     onClick={handleClearHighlight}
                   >
                     Clear
                   </Button>
                </Card>
              </div>
            )}
            <div className="mt-4">
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div className="mt-4 h-full min-h-[500px] flex flex-col gap-4">
            <textarea
              className="w-full h-[500px] bg-transparent border border-border focus:ring-1 focus:ring-ring focus:border-ring rounded-md p-4 text-foreground resize-none font-mono text-sm leading-relaxed"
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="# Start writing..."
            />
            <div className="flex justify-end">
              <Button onClick={handleSaveSource} disabled={updateFileMutation.isPending || sourceCode === fileData?.content}>
                {updateFileMutation.isPending ? 'Saving...' : 'Save File'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
