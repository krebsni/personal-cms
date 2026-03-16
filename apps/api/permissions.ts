// Permissions Management module for Cloudflare Workers
import { Hono } from "hono";
import type { Env } from "./types";
import { getUserFromContext } from "./auth";
import { generateId } from "./utils";

// Permission type matching database schema
interface Permission {
  id: string;
  file_id: string;
  user_id: string | null; // null = public
  permission: "read" | "write";
  created_at: number;
}



// Check if user is file owner
async function isFileOwner(fileId: string, userId: string, env: Env): Promise<boolean> {
  const file = await env.DB.prepare("SELECT owner_id FROM files WHERE id = ?")
    .bind(fileId)
    .first<{ owner_id: string }>();

  return file?.owner_id === userId;
}

const app = new Hono<{ Bindings: Env }>();

// GET /api/permissions/file/:fileId - Get file permissions
app.get("/file/:fileId", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const fileId = c.req.param("fileId");

    // Check if user is owner or admin
    const owner = await isFileOwner(fileId, user.id, c.env);
    if (!owner && user.role !== "admin") {
      return c.json({ success: false, error: "Only file owner can view permissions" }, 403);
    }

    // Get all permissions for file
    const result = await c.env.DB.prepare(
      "SELECT * FROM permissions WHERE file_id = ? ORDER BY created_at DESC"
    )
      .bind(fileId)
      .all<Permission>();

    const permissions = result.results || [];

    // Convert to API format
    const permissionsData = permissions.map((p) => ({
      id: p.id,
      fileId: p.file_id,
      userId: p.user_id,
      permission: p.permission,
      createdAt: p.created_at,
    }));

    return c.json({ success: true, data: permissionsData });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/permissions/file/:fileId - Grant file permission
app.post("/file/:fileId", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const fileId = c.req.param("fileId");

    // Check if user is owner or admin
    const owner = await isFileOwner(fileId, user.id, c.env);
    if (!owner && user.role !== "admin") {
      return c.json({ success: false, error: "Only file owner can grant permissions" }, 403);
    }

    const body = await c.req.json() as {
      userId?: string | null;
      permission: "read" | "write";
    };

    if (!body.permission || !["read", "write"].includes(body.permission)) {
      return c.json({ success: false, error: "Invalid permission type. Must be 'read' or 'write'" }, 400);
    }

    // Check if permission already exists
    let existing;
    if (body.userId) {
      existing = await c.env.DB.prepare(
        "SELECT id FROM permissions WHERE file_id = ? AND user_id = ?"
      )
        .bind(fileId, body.userId)
        .first<{ id: string }>();
    } else {
      existing = await c.env.DB.prepare(
        "SELECT id FROM permissions WHERE file_id = ? AND user_id IS NULL"
      )
        .bind(fileId)
        .first<{ id: string }>();
    }

    if (existing) {
      // Update existing permission
      await c.env.DB.prepare(
        "UPDATE permissions SET permission = ? WHERE id = ?"
      )
        .bind(body.permission, existing.id)
        .run();

      return c.json({
        success: true,
        data: { id: existing.id, fileId, userId: body.userId, permission: body.permission },
        message: "Permission updated"
      });
    }

    // Create new permission
    const permissionId = generateId();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      "INSERT INTO permissions (id, file_id, user_id, permission, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(permissionId, fileId, body.userId || null, body.permission, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: permissionId,
        fileId,
        userId: body.userId,
        permission: body.permission,
        createdAt: now,
      },
      message: "Permission granted"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/permissions/file/:fileId/public - Make file public
app.post("/file/:fileId/public", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const fileId = c.req.param("fileId");

    // Check if user is owner or admin
    const owner = await isFileOwner(fileId, user.id, c.env);
    if (!owner && user.role !== "admin") {
      return c.json({ success: false, error: "Only file owner can make file public" }, 403);
    }

    const body = await c.req.json() as { permission: "read" | "write" };

    if (!body.permission || !["read", "write"].includes(body.permission)) {
      return c.json({ success: false, error: "Invalid permission type" }, 400);
    }

    // Check if public permission exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM permissions WHERE file_id = ? AND user_id IS NULL"
    )
      .bind(fileId)
      .first<{ id: string }>();

    if (existing) {
      // Update existing
      await c.env.DB.prepare(
        "UPDATE permissions SET permission = ? WHERE id = ?"
      )
        .bind(body.permission, existing.id)
        .run();

      return c.json({ success: true, message: "Public permission updated" });
    }

    // Create new public permission
    const permissionId = generateId();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      "INSERT INTO permissions (id, file_id, user_id, permission, created_at) VALUES (?, ?, NULL, ?, ?)"
    )
      .bind(permissionId, fileId, body.permission, now)
      .run();

    return c.json({ success: true, message: "File made public" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/permissions/file/:fileId/public - Make file private
app.delete("/file/:fileId/public", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const fileId = c.req.param("fileId");
    console.log(`[Permissions] Handling DELETE public for ${fileId}`);

    // Check if user is owner or admin
    const owner = await isFileOwner(fileId, user.id, c.env);
    if (!owner && user.role !== "admin") {
      return c.json({ success: false, error: "Only file owner can make file private" }, 403);
    }

    // Delete public permission
    console.log(`Attempting to delete public permission for fileId: ${fileId}`);

    const existing = await c.env.DB.prepare(
      "SELECT id FROM permissions WHERE file_id = ? AND user_id IS NULL"
    )
      .bind(fileId)
      .first<{ id: string }>();

    if (!existing) {
      return c.json({ success: false, error: "File is not public or permission not found" }, 404);
    }

    console.log(`Found public permission with ID: ${existing.id}`);

    const result = await c.env.DB.prepare(
      "DELETE FROM permissions WHERE id = ?"
    )
      .bind(existing.id)
      .run();

    console.log("Delete result:", JSON.stringify(result));

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: "Failed to delete permission" }, 500);
    }

    return c.json({ success: true, message: "File made private" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/permissions/file/:fileId/:permissionId - Revoke permission
app.delete("/file/:fileId/:permissionId", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const fileId = c.req.param("fileId");
    const permissionId = c.req.param("permissionId");

    // Check if user is owner or admin
    const owner = await isFileOwner(fileId, user.id, c.env);
    if (!owner && user.role !== "admin") {
      return c.json({ success: false, error: "Only file owner can revoke permissions" }, 403);
    }

    // Delete permission
    const result = await c.env.DB.prepare(
      "DELETE FROM permissions WHERE id = ? AND file_id = ?"
    )
      .bind(permissionId, fileId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: "Permission not found" }, 404);
    }

    return c.json({ success: true, message: "Permission revoked" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export { app as permissionsApp };
