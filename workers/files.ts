// File Management module for Cloudflare Workers
import { Hono } from "hono";
import type { Env } from "./types";
import { getUserFromContext } from "./auth";
import { generateId } from "./utils";

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

const app = new Hono<{ Bindings: Env }>();

// GET /api/files/:path - List all accessible files
app.get("/", async (c) => {
  try {
    const user = await getUserFromContext(c);
    const files = await getAccessibleFiles(user?.id || null, c.env);

    // Convert database format to API format (snake_case to camelCase)
    const filesData = files.map((f) => ({
      id: f.id,
      path: f.path,
      ownerId: f.owner_id,
      size: f.size,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }));

    return c.json({ success: true, data: filesData });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/files - Upload file
app.post("/", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const contentType = c.req.header("content-type") || "";
    let filePath: string;
    let fileContent: ArrayBuffer;
    let fileName: string;

    // Handle multipart/form-data (file upload from browser)
    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.parseBody();
      const file = formData["file"];
      const pathFromForm = formData["path"] as string;

      if (!file || !(file instanceof File)) {
        return c.json({ success: false, error: "No file provided" }, 400);
      }

      fileName = file.name;
      filePath = pathFromForm || `/${user.username}/${fileName}`;
      fileContent = await file.arrayBuffer();
    }
    // Handle JSON (direct content upload)
    else if (contentType.includes("application/json")) {
      const body = await c.req.json() as { path: string; content: string };

      if (!body.path || !body.content) {
        return c.json({ success: false, error: "Path and content are required" }, 400);
      }

      filePath = body.path;
      fileName = filePath.split("/").pop() || "untitled.md";
      fileContent = new TextEncoder().encode(body.content).buffer;
    } else {
      return c.json({ success: false, error: "Unsupported content type" }, 400);
    }

    // Validate file path
    if (!filePath.startsWith("/")) {
      filePath = "/" + filePath;
    }

    // Check if file already exists
    const existingFile = await c.env.DB.prepare("SELECT id FROM files WHERE path = ?")
      .bind(filePath)
      .first<{ id: string }>();

    if (existingFile) {
      return c.json({ success: false, error: "File already exists at this path" }, 409);
    }

    // Generate R2 key
    const fileId = generateId();
    const r2Key = `files/${user.id}/${fileId}`;

    // Upload to R2
    await c.env.R2_BUCKET.put(r2Key, fileContent, {
      httpMetadata: {
        contentType: fileName.endsWith(".md") ? "text/markdown" : "application/octet-stream",
      },
    });

    // Save metadata to D1
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(
      "INSERT INTO files (id, path, owner_id, content_r2_key, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(fileId, filePath, user.id, r2Key, fileContent.byteLength, now, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: fileId,
        path: filePath,
        ownerId: user.id,
        size: fileContent.byteLength,
        createdAt: now,
        updatedAt: now,
      },
      message: "File uploaded successfully"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/files/:path - Get file metadata and content
// Using named parameter with regex to capture full path
app.get("/:filePath{.+}", async (c) => {
  try {
    const user = await getUserFromContext(c);

    // Get capture group (relative path)
    const rawPath = c.req.param("filePath");
    // Decode it (e.g. %2Ftest%2Fgetfile.md -> /test/getfile.md)
    let filePath = decodeURIComponent(rawPath);

    // console.log(`[FilesDebug] GET raw: ${rawPath}, decoded: ${filePath}`);

    // Get file from database
    const file = await c.env.DB.prepare("SELECT * FROM files WHERE path = ?")
      .bind(filePath)
      .first<FileRecord>();

    if (!file) {
      return c.json({ success: false, error: "File not found" }, 404);
    }

    // Check permission
    const hasPermission = await checkFilePermission(file.id, user?.id || null, "read", c.env);

    if (!hasPermission) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Get content from R2
    const r2Object = await c.env.R2_BUCKET.get(file.content_r2_key);

    if (!r2Object) {
      return c.json({ success: false, error: "File content not found in storage" }, 404);
    }

    const content = await r2Object.text();

    return c.json({
      success: true,
      data: {
        metadata: {
          id: file.id,
          path: file.path,
          ownerId: file.owner_id,
          size: file.size,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
        },
        content,
      }
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/files/:path - Update file content
app.put("/:filePath{.+}", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const rawPath = c.req.param("filePath");
    let filePath = decodeURIComponent(rawPath);

    // Get file from database
    const file = await c.env.DB.prepare("SELECT * FROM files WHERE path = ?")
      .bind(filePath)
      .first<FileRecord>();

    if (!file) {
      return c.json({ success: false, error: "File not found" }, 404);
    }

    // Check write permission
    const hasPermission = await checkFilePermission(file.id, user.id, "write", c.env);

    if (!hasPermission) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Get new content
    const body = await c.req.json() as { content: string };

    if (!body.content) {
      return c.json({ success: false, error: "Content is required" }, 400);
    }

    const newContent = new TextEncoder().encode(body.content).buffer;

    // Update in R2
    await c.env.R2_BUCKET.put(file.content_r2_key, newContent, {
      httpMetadata: {
        contentType: file.path.endsWith(".md") ? "text/markdown" : "application/octet-stream",
      },
    });

    // Update metadata in D1
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare("UPDATE files SET size = ?, updated_at = ? WHERE id = ?")
      .bind(newContent.byteLength, now, file.id)
      .run();

    return c.json({
      success: true,
      data: {
        id: file.id,
        path: file.path,
        ownerId: file.owner_id,
        size: newContent.byteLength,
        createdAt: file.created_at,
        updatedAt: now,
      },
      message: "File updated successfully"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/files/:path - Delete file
app.delete("/:filePath{.+}", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const rawPath = c.req.param("filePath");
    let filePath = decodeURIComponent(rawPath);

    // Get file from database
    const file = await c.env.DB.prepare("SELECT * FROM files WHERE path = ?")
      .bind(filePath)
      .first<FileRecord>();

    if (!file) {
      return c.json({ success: false, error: "File not found" }, 404);
    }

    // Check write permission (needed to delete)
    const hasPermission = await checkFilePermission(file.id, user.id, "write", c.env);

    if (!hasPermission) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Delete from R2
    await c.env.R2_BUCKET.delete(file.content_r2_key);

    // Delete from D1 (cascades to permissions and highlights)
    await c.env.DB.prepare("DELETE FROM files WHERE id = ?").bind(file.id).run();

    return c.json({ success: true, message: "File deleted successfully" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export { app as filesApp, checkFilePermission, getAccessibleFiles };
