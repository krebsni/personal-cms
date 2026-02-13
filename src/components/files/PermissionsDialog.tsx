// PermissionsDialog - Manage file permissions
import { useState, useEffect } from "react";
import { api } from "../../services/api";
import type { Permission, User } from "../../types";

interface PermissionsDialogProps {
  fileId: string;
  filePath: string;
  onClose: () => void;
}

export default function PermissionsDialog({
  fileId,
  filePath,
  onClose,
}: PermissionsDialogProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [permissionType, setPermissionType] = useState<"read" | "write">("read");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    loadData();
  }, [fileId]);

  const loadData = async () => {
    setLoading(true);

    // Load permissions
    const permResponse = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/permissions/file/${fileId}`,
      { credentials: "include" }
    );
    if (permResponse.ok) {
      const data = await permResponse.json();
      setPermissions(data.data || []);
      setIsPublic(data.data?.some((p: Permission) => p.userId === null) || false);
    }

    // Load users
    const usersResponse = await api.getUsers();
    if (usersResponse.success && usersResponse.data) {
      setUsers(usersResponse.data);
    }

    setLoading(false);
  };

  const handleGrantPermission = async () => {
    if (!selectedUser) return;

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/permissions/file/${fileId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: selectedUser, permission: permissionType }),
      }
    );

    if (response.ok) {
      await loadData();
      setSelectedUser("");
    }
  };

  const handleRevokePermission = async (permissionId: string) => {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/permissions/file/${fileId}/${permissionId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (response.ok) {
      await loadData();
    }
  };

  const handleTogglePublic = async () => {
    if (isPublic) {
      // Make private
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/permissions/file/${fileId}/public`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (response.ok) {
        setIsPublic(false);
        await loadData();
      }
    } else {
      // Make public
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/permissions/file/${fileId}/public`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ permission: "read" }),
        }
      );
      if (response.ok) {
        setIsPublic(true);
        await loadData();
      }
    }
  };

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Manage Permissions
            </h3>
            <p className="text-sm text-gray-500 mb-4">{filePath}</p>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Public Access Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">Public Access</div>
                    <div className="text-sm text-gray-500">
                      Anyone with the link can view this file
                    </div>
                  </div>
                  <button
                    onClick={handleTogglePublic}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isPublic ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Grant Permission */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Grant Access</h4>
                  <div className="flex space-x-2">
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username} ({user.email})
                        </option>
                      ))}
                    </select>
                    <select
                      value={permissionType}
                      onChange={(e) => setPermissionType(e.target.value as "read" | "write")}
                      className="border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                    </select>
                    <button
                      onClick={handleGrantPermission}
                      disabled={!selectedUser}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      Grant
                    </button>
                  </div>
                </div>

                {/* Current Permissions */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Current Access</h4>
                  <div className="space-y-2">
                    {permissions
                      .filter((p) => p.userId !== null)
                      .map((permission) => {
                        const user = users.find((u) => u.id === permission.userId);
                        return (
                          <div
                            key={permission.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded"
                          >
                            <div>
                              <div className="font-medium text-sm">
                                {user?.username || "Unknown User"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {user?.email}
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-sm text-gray-600">
                                {permission.permission}
                              </span>
                              <button
                                onClick={() => handleRevokePermission(permission.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {permissions.filter((p) => p.userId !== null).length === 0 && (
                      <div className="text-sm text-gray-500 italic">
                        No user-specific permissions
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
