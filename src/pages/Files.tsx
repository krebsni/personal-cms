// Files page - File browser and management
import { useState, useEffect } from "react";
import { api } from "../services/api";
import type { FileMetadata } from "../types";
import FileList from "../components/files/FileList";
import FileUpload from "../components/files/FileUpload";
import { useNavigate } from "react-router-dom";

export default function Files() {
  const navigate = useNavigate();
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

  const handleSelect = (file: FileMetadata) => {
    navigate(`/editor${file.path}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Files</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage your documents and files
            </p>
          </div>

          <FileUpload onUpload={handleUpload} uploading={uploading} />
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No files</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by uploading a file.
            </p>
          </div>
        ) : (
          <FileList
            files={files}
            onDelete={handleDelete}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
}
