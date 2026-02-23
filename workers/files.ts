// File Management module for Cloudflare Workers
import { Hono } from "hono";
import type { Env } from "./types";
import { getUserFromContext } from "./auth";
import { generateId } from "./utils";

interface FileRecord {
  id: string;
  path: string;
  owner_id: string;
  parent_id: string | null;
  repository_id: string | null;
  is_public: number;
  content_r2_key: string;
  size: number;
  created_at: number;
  updated_at: number;
}



// Check if user has permission to access file
async function checkFilePermission(
  fileId: string,
  userId: string | null,
  requiredPermission: "read" | "write",
  env: Env
): Promise<boolean> {
  // If reading, check if public
  if (requiredPermission === "read") {
    const isPublic = await env.DB.prepare("SELECT 1 FROM files WHERE id = ? AND is_public = 1").bind(fileId).first();
    if (isPublic) return true;
  }

  if (!userId) return false;

  // Check if owner of the file or the repository
  const isOwner = await env.DB.prepare(`
    SELECT 1 FROM files f
    LEFT JOIN repositories r ON f.repository_id = r.id
    WHERE f.id = ? AND (f.owner_id = ? OR r.owner_id = ?)
  `).bind(fileId, userId, userId).first();

  if (isOwner) return true;

  // Check assignments on the file or any parent folder
  const roleCondition = requiredPermission === "write"
    ? "a.role = 'editor'"
    : "(a.role = 'viewer' OR a.role = 'editor')";

  const query = `
    WITH RECURSIVE parent_folders AS (
      SELECT parent_id as folder_id FROM files WHERE id = ?
      UNION ALL
      SELECT f.parent_id FROM folders f
      JOIN parent_folders pf ON f.id = pf.folder_id
      WHERE f.parent_id IS NOT NULL
    )
    SELECT 1 FROM assignments a
    WHERE a.user_id = ?
      AND ${roleCondition}
      AND (
           a.resource_id = ?
           OR a.resource_id IN (SELECT folder_id FROM parent_folders WHERE folder_id IS NOT NULL)
          )
  `;

  const hasAssignment = await env.DB.prepare(query)
    .bind(fileId, userId, fileId)
    .first();

  return !!hasAssignment;
}

// Get all files accessible to user
async function getAccessibleFiles(userId: string | null, env: Env): Promise<FileRecord[]> {
  if (!userId) {
    // Anonymous users only see public files
    const result = await env.DB.prepare(
      `SELECT * FROM files WHERE is_public = 1 ORDER BY created_at DESC`
    ).all<FileRecord>();
    return result.results || [];
  }

  const query = `
    WITH RECURSIVE accessible_folders AS (
      SELECT f.id FROM folders f
      JOIN assignments a ON a.resource_id = f.id
      WHERE a.user_id = ?

      UNION ALL

      SELECT child.id FROM folders child
      JOIN accessible_folders parent ON child.parent_id = parent.id
    )
    SELECT DISTINCT f.* FROM files f
    LEFT JOIN repositories r ON f.repository_id = r.id
    LEFT JOIN assignments a ON a.resource_id = f.id
    WHERE f.is_public = 1
       OR f.owner_id = ?
       OR r.owner_id = ?
       OR a.user_id = ?
       OR f.parent_id IN (SELECT id FROM accessible_folders)
    ORDER BY f.created_at DESC
  `;

  const result = await env.DB.prepare(query)
    .bind(userId, userId, userId, userId)
    .all<FileRecord>();

  return result.results || [];
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
      parentId: f.parent_id,
      repositoryId: f.repository_id,
      isPublic: f.is_public === 1,
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
    let parentId: string | null = null;
    let repositoryId: string | null = null;
    let isPublic = false;

    // Handle multipart/form-data (file upload from browser)
    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.parseBody();
      const file = formData["file"];
      const pathFromForm = formData["path"] as string;
      parentId = formData["parentId"] as string || null;
      repositoryId = formData["repositoryId"] as string || null;
      isPublic = formData["isPublic"] === "true";

      if (!file || !(file instanceof File)) {
        return c.json({ success: false, error: "No file provided" }, 400);
      }

      fileName = file.name;
      filePath = pathFromForm || `/${user.username}/${fileName}`;
      fileContent = await file.arrayBuffer();
    }
    // Handle JSON (direct content upload)
    else if (contentType.includes("application/json")) {
      const body = await c.req.json() as {
        path: string;
        content: string;
        parentId?: string;
        repositoryId?: string;
        isPublic?: boolean;
      };

      if (!body.path || !body.content) {
        return c.json({ success: false, error: "Path and content are required" }, 400);
      }

      filePath = body.path;
      fileName = filePath.split("/").pop() || "untitled.md";
      fileContent = new TextEncoder().encode(body.content).buffer;
      parentId = body.parentId || null;
      repositoryId = body.repositoryId || null;
      isPublic = body.isPublic || false;
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
      "INSERT INTO files (id, path, owner_id, parent_id, repository_id, is_public, content_r2_key, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(fileId, filePath, user.id, parentId, repositoryId, isPublic ? 1 : 0, r2Key, fileContent.byteLength, now, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: fileId,
        path: filePath,
        ownerId: user.id,
        parentId,
        repositoryId,
        isPublic,
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
          parentId: file.parent_id,
          repositoryId: file.repository_id,
          isPublic: file.is_public === 1,
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

// PUT /api/files/:filePath/raw - Update raw file content (Owners only)
app.put("/:filePath{.+}/raw", async (c) => {
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

    // Check if user is an owner of the file or its repository
    const isOwner = await c.env.DB.prepare(`
      SELECT 1 FROM files f
      LEFT JOIN repositories r ON f.repository_id = r.id
      WHERE f.id = ? AND (f.owner_id = ? OR r.owner_id = ?)
    `).bind(file.id, user.id, user.id).first();

    if (!isOwner) {
      return c.json({ success: false, error: "Only owners can perform raw code edits" }, 403);
    }

    // Get new content
    const body = await c.req.json() as { content: string };

    if (body.content === undefined) {
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
      message: "Raw file updated successfully"
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
// POST /api/files/:path/share - Share file with another user
app.post("/:filePath{.+}/share", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const rawPath = c.req.param("filePath");
    let filePath = decodeURIComponent(rawPath);
    // Be careful with URL encoding, :filePath{+} captures everything including the /share part if not careful
    // But since we defined /:filePath{.+}/share, Hono should match the share suffix.
    // Wait, Hono router might be tricky here.
    // Actually, usually it's safer to use /share/:filePath or query params if path has slashes.
    // But let's try this. If filePath includes "/share", we might need to strip it?
    // No, Hono's specific route definition should take precedence or match correctly.
    // However, the param will be everything before /share.

    const body = await c.req.json() as { email: string };
    if (!body.email) {
      return c.json({ success: false, error: "Email is required" }, 400);
    }

    // Get file from database
    const file = await c.env.DB.prepare("SELECT * FROM files WHERE path = ?")
      .bind(filePath)
      .first<FileRecord>();

    if (!file) {
      return c.json({ success: false, error: "File not found" }, 404);
    }

    // Check if user is an owner (only owners can share)
    const isOwner = await c.env.DB.prepare(
      "SELECT 1 FROM file_owners WHERE file_id = ? AND user_id = ?"
    )
      .bind(file.id, user.id)
      .first();

    if (!isOwner) {
      return c.json({ success: false, error: "Only file owners can share files" }, 403);
    }

    // Find target user by email
    const targetUser = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(body.email)
      .first<{ id: string }>();

    if (!targetUser) {
      return c.json({ success: false, error: "User with this email not found" }, 404);
    }

    // Check if already an owner
    const alreadyOwner = await c.env.DB.prepare(
      "SELECT 1 FROM file_owners WHERE file_id = ? AND user_id = ?"
    )
      .bind(file.id, targetUser.id)
      .first();

    if (alreadyOwner) {
      return c.json({ success: true, message: "User is already an owner" });
    }

    // Add as owner
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(
      "INSERT INTO file_owners (file_id, user_id, created_at) VALUES (?, ?, ?)"
    )
      .bind(file.id, targetUser.id, now)
      .run();

    return c.json({ success: true, message: "File shared successfully" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

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
