// ColorPicker - Color selection for highlights
import { useEffect, useRef } from "react";

interface ColorPickerProps {
  position: { x: number; y: number };
  onColorSelect: (color: string) => void;
  onClose: () => void;
}

const DEFAULT_COLORS = [
  { name: "Yellow", color: "#FEF08A" },
  { name: "Green", color: "#BBF7D0" },
  { name: "Blue", color: "#BFDBFE" },
  { name: "Pink", color: "#FBCFE8" },
  { name: "Purple", color: "#DDD6FE" },
  { name: "Orange", color: "#FED7AA" },
];

export default function ColorPicker({
  position,
  onColorSelect,
  onClose,
}: ColorPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)",
      }}
    >
      <div className="text-xs font-medium text-gray-700 mb-2">
        Choose highlight color:
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DEFAULT_COLORS.map(({ name, color }) => (
          <button
            key={color}
            onClick={() => onColorSelect(color)}
            className="group relative w-12 h-12 rounded-md hover:ring-2 hover:ring-blue-500 transition-all"
            style={{ backgroundColor: color }}
            title={name}
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
