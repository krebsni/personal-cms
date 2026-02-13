// File Management module for Cloudflare Workers
import type { Env, ResponseHelpers } from "./index";
import { getUserFromRequest } from "./auth";

// File metadata type matching database schema
interface FileRecord {
  id: string;
  path: string;
  owner_id: string;
  content_r2_key: string;
  size: number;
  created_at: number;
  updated_at: number;
}

// Permission type
interface Permission {
  id: string;
  file_id: string;
  user_id: string | null;
  permission: "read" | "write";
  created_at: number;
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID();
}

// Check if user has permission to access file
async function checkFilePermission(
  fileId: string,
  userId: string | null,
  requiredPermission: "read" | "write",
  env: Env
): Promise<boolean> {
  // Get file owner
  const file = await env.DB.prepare("SELECT owner_id FROM files WHERE id = ?")
    .bind(fileId)
    .first<{ owner_id: string }>();

  if (!file) {
    return false;
  }

  // Owner has all permissions
  if (userId && file.owner_id === userId) {
    return true;
  }

  // Check if file is public (user_id is NULL in permissions)
  const publicPermission = await env.DB.prepare(
    "SELECT * FROM permissions WHERE file_id = ? AND user_id IS NULL AND permission >= ?"
  )
    .bind(fileId, requiredPermission)
    .first<Permission>();

  if (publicPermission) {
    return true;
  }

  // Check user-specific permission
  if (userId) {
    const userPermission = await env.DB.prepare(
      "SELECT * FROM permissions WHERE file_id = ? AND user_id = ? AND permission >= ?"
    )
      .bind(fileId, userId, requiredPermission)
      .first<Permission>();

    if (userPermission) {
      return true;
    }
  }

  return false;
}

// Get all files accessible to user
async function getAccessibleFiles(userId: string | null, env: Env): Promise<FileRecord[]> {
  let files: FileRecord[] = [];

  if (userId) {
    // Get files owned by user + files with explicit permission + public files
    const result = await env.DB.prepare(
      `SELECT DISTINCT f.* FROM files f
       LEFT JOIN permissions p ON f.id = p.file_id
       WHERE f.owner_id = ? OR p.user_id = ? OR p.user_id IS NULL
       ORDER BY f.created_at DESC`
    )
      .bind(userId, userId)
      .all<FileRecord>();

    files = result.results || [];
  } else {
    // Anonymous users only see public files
    const result = await env.DB.prepare(
      `SELECT DISTINCT f.* FROM files f
       INNER JOIN permissions p ON f.id = p.file_id
       WHERE p.user_id IS NULL
       ORDER BY f.created_at DESC`
    )
      .all<FileRecord>();

    files = result.results || [];
  }

  return files;
}

// Files router
export async function filesRouter(
  request: Request,
  env: Env,
  helpers: ResponseHelpers
): Promise<Response> {
  const { successResponse, errorResponse } = helpers;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Get current user (can be null for anonymous)
    const user = await getUserFromRequest(request, env);

    // GET /api/files - List all accessible files
    if (path === "/api/files" && request.method === "GET") {
      const files = await getAccessibleFiles(user?.id || null, env);

      // Convert database format to API format (snake_case to camelCase)
      const filesData = files.map((f) => ({
        id: f.id,
        path: f.path,
        ownerId: f.owner_id,
        size: f.size,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));

      return successResponse(filesData);
    }

    // POST /api/files - Upload file
    if (path === "/api/files" && request.method === "POST") {
      if (!user) {
        return errorResponse("Authentication required", 401);
      }

      const contentType = request.headers.get("content-type") || "";

      let filePath: string;
      let fileContent: ArrayBuffer;
      let fileName: string;

      // Handle multipart/form-data (file upload from browser)
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const pathFromForm = formData.get("path") as string;

        if (!file) {
          return errorResponse("No file provided", 400);
        }

        fileName = file.name;
        filePath = pathFromForm || `/${user.username}/${fileName}`;
        fileContent = await file.arrayBuffer();
      }
      // Handle JSON (direct content upload)
      else if (contentType.includes("application/json")) {
        const body = await request.json() as { path: string; content: string };

        if (!body.path || !body.content) {
          return errorResponse("Path and content are required", 400);
        }

        filePath = body.path;
        fileName = filePath.split("/").pop() || "untitled.md";
        fileContent = new TextEncoder().encode(body.content).buffer;
      } else {
        return errorResponse("Unsupported content type", 400);
      }

      // Validate file path
      if (!filePath.startsWith("/")) {
        filePath = "/" + filePath;
      }

      // Check if file already exists
      const existingFile = await env.DB.prepare("SELECT id FROM files WHERE path = ?")
        .bind(filePath)
        .first<{ id: string }>();

      if (existingFile) {
        return errorResponse("File already exists at this path", 409);
      }

      // Generate R2 key
      const fileId = generateId();
      const r2Key = `files/${user.id}/${fileId}`;

      // Upload to R2
      await env.R2_BUCKET.put(r2Key, fileContent, {
        httpMetadata: {
          contentType: fileName.endsWith(".md") ? "text/markdown" : "application/octet-stream",
        },
      });

      // Save metadata to D1
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        "INSERT INTO files (id, path, owner_id, content_r2_key, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(fileId, filePath, user.id, r2Key, fileContent.byteLength, now, now)
        .run();

      // Return file metadata
      return successResponse(
        {
          id: fileId,
          path: filePath,
          ownerId: user.id,
          size: fileContent.byteLength,
          createdAt: now,
          updatedAt: now,
        },
        "File uploaded successfully"
      );
    }

    // GET /api/files/:path - Get file metadata and content
    if (path.startsWith("/api/files/") && request.method === "GET") {
      const encodedPath = path.substring("/api/files/".length);
      const filePath = decodeURIComponent(encodedPath);

      // Get file from database
      const file = await env.DB.prepare("SELECT * FROM files WHERE path = ?")
        .bind(filePath)
        .first<FileRecord>();

      if (!file) {
        return errorResponse("File not found", 404);
      }

      // Check permission
      const hasPermission = await checkFilePermission(file.id, user?.id || null, "read", env);

      if (!hasPermission) {
        return errorResponse("Access denied", 403);
      }

      // Get content from R2
      const r2Object = await env.R2_BUCKET.get(file.content_r2_key);

      if (!r2Object) {
        return errorResponse("File content not found in storage", 404);
      }

      const content = await r2Object.text();

      return successResponse({
        metadata: {
          id: file.id,
          path: file.path,
          ownerId: file.owner_id,
          size: file.size,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
        },
        content,
      });
    }

    // PUT /api/files/:path - Update file content
    if (path.startsWith("/api/files/") && request.method === "PUT") {
      if (!user) {
        return errorResponse("Authentication required", 401);
      }

      const encodedPath = path.substring("/api/files/".length);
      const filePath = decodeURIComponent(encodedPath);

      // Get file from database
      const file = await env.DB.prepare("SELECT * FROM files WHERE path = ?")
        .bind(filePath)
        .first<FileRecord>();

      if (!file) {
        return errorResponse("File not found", 404);
      }

      // Check write permission
      const hasPermission = await checkFilePermission(file.id, user.id, "write", env);

      if (!hasPermission) {
        return errorResponse("Access denied", 403);
      }

      // Get new content
      const body = await request.json() as { content: string };

      if (!body.content) {
        return errorResponse("Content is required", 400);
      }

      const newContent = new TextEncoder().encode(body.content).buffer;

      // Update in R2
      await env.R2_BUCKET.put(file.content_r2_key, newContent, {
        httpMetadata: {
          contentType: file.path.endsWith(".md") ? "text/markdown" : "application/octet-stream",
        },
      });

      // Update metadata in D1
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("UPDATE files SET size = ?, updated_at = ? WHERE id = ?")
        .bind(newContent.byteLength, now, file.id)
        .run();

      return successResponse(
        {
          id: file.id,
          path: file.path,
          ownerId: file.owner_id,
          size: newContent.byteLength,
          createdAt: file.created_at,
          updatedAt: now,
        },
        "File updated successfully"
      );
    }

    // DELETE /api/files/:path - Delete file
    if (path.startsWith("/api/files/") && request.method === "DELETE") {
      if (!user) {
        return errorResponse("Authentication required", 401);
      }

      const encodedPath = path.substring("/api/files/".length);
      const filePath = decodeURIComponent(encodedPath);

      // Get file from database
      const file = await env.DB.prepare("SELECT * FROM files WHERE path = ?")
        .bind(filePath)
        .first<FileRecord>();

      if (!file) {
        return errorResponse("File not found", 404);
      }

      // Check write permission (needed to delete)
      const hasPermission = await checkFilePermission(file.id, user.id, "write", env);

      if (!hasPermission) {
        return errorResponse("Access denied", 403);
      }

      // Delete from R2
      await env.R2_BUCKET.delete(file.content_r2_key);

      // Delete from D1 (cascades to permissions and highlights)
      await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(file.id).run();

      return successResponse(null, "File deleted successfully");
    }

    // Route not found in files module
    return errorResponse(`File route not found: ${path}`, 404);
  } catch (error) {
    console.error("Files error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "File operation error",
      500
    );
  }
}

// Export permission checker for use in other modules
export { checkFilePermission, getAccessibleFiles };
