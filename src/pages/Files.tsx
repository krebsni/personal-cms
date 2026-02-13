// Files page - File browser and management
import { useState, useEffect } from "react";
import { api } from "../services/api";
import type { FileMetadata } from "../types";
import FileList from "../components/files/FileList";
import FileUpload from "../components/files/FileUpload";

export default function Files() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);

    const response = await api.getFiles();

    if (response.success && response.data) {
      setFiles(response.data);
    } else {
      setError(response.error || "Failed to load files");
    }

    setLoading(false);
  };

  const handleUpload = async (file: File, path: string) => {
    setUploading(true);
    setError(null);

    const response = await api.uploadFile(file, path);

    if (response.success) {
      // Reload files to show the new upload
      await loadFiles();
      return true;
    } else {
      setError(response.error || "Upload failed");
      return false;
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Are you sure you want to delete "${path}"?`)) {
      return;
    }

    const response = await api.deleteFile(path);

    if (response.success) {
      // Remove from local state
      setFiles((prev) => prev.filter((f) => f.path !== path));
    } else {
      setError(response.error || "Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Files</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage your documents and files
            </p>
          </div>

          <FileUpload onUpload={handleUpload} uploading={uploading} />
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by uploading a file.
            </p>
          </div>
        ) : (
          <FileList files={files} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
