import type { HighlightColor } from "../../types";

interface HighlightMenuProps {
  position: { top: number; left: number } | null;
  colors: HighlightColor[];
  onSelectColor: (color: string) => void;
  onClose: () => void;
}

export function HighlightMenu({ position, colors, onSelectColor, onClose }: HighlightMenuProps) {
  if (!position) return null;

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 flex gap-2 animate-in fade-in zoom-in duration-200"
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%) translateY(-10px)",
      }}
    >
      {colors.map((color) => (
        <button
          key={color.id}
          onClick={() => onSelectColor(color.hexCode)}
          className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          style={{ backgroundColor: color.hexCode }}
          title={color.name}
          aria-label={`Highlight ${color.name}`}
        />
      ))}
    </div>
  );
}
