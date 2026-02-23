import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Highlight, HighlightColor } from '../../hooks/useAdminApi';

export interface PersistentHighlightsOptions {
  highlights: Highlight[];
  colors: HighlightColor[];
}

export const PersistentHighlightsName = 'persistentHighlights';

export const PersistentHighlights = Extension.create<PersistentHighlightsOptions>({
  name: PersistentHighlightsName,

  addOptions() {
    return {
      highlights: [],
      colors: [],
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey(PersistentHighlightsName),
        props: {
          decorations: (state) => {
            const { highlights, colors } = this.options;
            const decorations: Decoration[] = [];

            highlights.forEach((highlight) => {
              const colorDef = colors.find(c => c.id === highlight.color_id);
              if (!colorDef) return;

              // Ensure offsets are within doc bounds to avoid PM crashes
              const docSize = state.doc.content.size;
              const start = Math.max(0, Math.min(highlight.start_offset, docSize));
              const end = Math.max(0, Math.min(highlight.end_offset, docSize));

              if (start >= end) return;

              decorations.push(
                Decoration.inline(start, end, {
                  class: 'persistent-highlight rounded px-1 transition-colors',
                  style: `background-color: ${colorDef.hex_code}80; border-bottom: 2px solid ${colorDef.hex_code};`,
                  'data-highlight-id': highlight.id,
                })
              );
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
