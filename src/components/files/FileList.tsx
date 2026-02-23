// FileList component - Displays files in a grid layout
import { Link } from "react-router-dom";
import type { FileMetadata } from "../../types";

interface FileListProps {
  files: FileMetadata[];
  onSelect: (file: FileMetadata) => void;
  selectedFileId?: string;
  onDelete: (path: string) => void;
}

export default function FileList({ files, onSelect, selectedFileId, onDelete }: FileListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getFileIcon = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "md":
        return "📝";
      case "txt":
        return "📄";
      case "pdf":
        return "📕";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return "🖼️";
      case "js":
      case "ts":
      case "tsx":
      case "jsx":
        return "📜";
      default:
        return "📄";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      <div className="overflow-y-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Name
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {files.map((file) => (
              <tr
                key={file.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                  selectedFileId === file.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
                onClick={() => onSelect(file)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{getFileIcon(file.path)}</span>
                    <div className="overflow-hidden">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]" title={file.path}>
                        {file.path.split("/").pop()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                        {formatDate(file.updatedAt)} • {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex flex-col gap-2 items-end">
                    <Link
                      to={`/editor${file.path}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file.path);
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
