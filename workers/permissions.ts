// Permissions Management module for Cloudflare Workers
import type { Env, ResponseHelpers } from "./index";
import { getUserFromRequest } from "./auth";
import { checkFilePermission } from "./files";

// Permission type matching database schema
interface Permission {
  id: string;
  file_id: string;
  user_id: string | null; // null = public
  permission: "read" | "write";
  created_at: number;
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID();
}

// Check if user is file owner
async function isFileOwner(fileId: string, userId: string, env: Env): Promise<boolean> {
  const file = await env.DB.prepare("SELECT owner_id FROM files WHERE id = ?")
    .bind(fileId)
    .first<{ owner_id: string }>();

  return file?.owner_id === userId;
}

// Permissions router
export async function permissionsRouter(
  request: Request,
  env: Env,
  helpers: ResponseHelpers
): Promise<Response> {
  const { successResponse, errorResponse } = helpers;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Get current user (required for all permission operations)
    const user = await getUserFromRequest(request, env);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    // GET /api/permissions/file/:fileId - Get file permissions
    if (path.match(/^\/api\/permissions\/file\/[^/]+$/) && request.method === "GET") {
      const fileId = path.split("/").pop()!;

      // Check if user is owner or admin
      const owner = await isFileOwner(fileId, user.id, env);
      if (!owner && user.role !== "admin") {
        return errorResponse("Only file owner can view permissions", 403);
      }

      // Get all permissions for file
      const result = await env.DB.prepare(
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

      return successResponse(permissionsData);
    }

    // POST /api/permissions/file/:fileId - Grant file permission
    if (path.match(/^\/api\/permissions\/file\/[^/]+$/) && request.method === "POST") {
      const fileId = path.split("/").pop()!;

      // Check if user is owner or admin
      const owner = await isFileOwner(fileId, user.id, env);
      if (!owner && user.role !== "admin") {
        return errorResponse("Only file owner can grant permissions", 403);
      }

      const body = await request.json() as {
        userId?: string | null;
        permission: "read" | "write";
      };

      if (!body.permission || !["read", "write"].includes(body.permission)) {
        return errorResponse("Invalid permission type. Must be 'read' or 'write'", 400);
      }

      // Check if permission already exists
      let existing;
      if (body.userId) {
        existing = await env.DB.prepare(
          "SELECT id FROM permissions WHERE file_id = ? AND user_id = ?"
        )
          .bind(fileId, body.userId)
          .first<{ id: string }>();
      } else {
        existing = await env.DB.prepare(
          "SELECT id FROM permissions WHERE file_id = ? AND user_id IS NULL"
        )
          .bind(fileId)
          .first<{ id: string }>();
      }

      if (existing) {
        // Update existing permission
        await env.DB.prepare(
          "UPDATE permissions SET permission = ? WHERE id = ?"
        )
          .bind(body.permission, existing.id)
          .run();

        return successResponse(
          { id: existing.id, fileId, userId: body.userId, permission: body.permission },
          "Permission updated"
        );
      }

      // Create new permission
      const permissionId = generateId();
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(
        "INSERT INTO permissions (id, file_id, user_id, permission, created_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(permissionId, fileId, body.userId || null, body.permission, now)
        .run();

      return successResponse(
        {
          id: permissionId,
          fileId,
          userId: body.userId,
          permission: body.permission,
          createdAt: now,
        },
        "Permission granted"
      );
    }

    // DELETE /api/permissions/file/:fileId/:permissionId - Revoke permission
    if (path.match(/^\/api\/permissions\/file\/[^/]+\/[^/]+$/) && request.method === "DELETE") {
      const parts = path.split("/");
      const permissionId = parts.pop()!;
      const fileId = parts.pop()!;

      // Check if user is owner or admin
      const owner = await isFileOwner(fileId, user.id, env);
      if (!owner && user.role !== "admin") {
        return errorResponse("Only file owner can revoke permissions", 403);
      }

      // Delete permission
      const result = await env.DB.prepare(
        "DELETE FROM permissions WHERE id = ? AND file_id = ?"
      )
        .bind(permissionId, fileId)
        .run();

      if (result.meta.changes === 0) {
        return errorResponse("Permission not found", 404);
      }

      return successResponse(null, "Permission revoked");
    }

    // POST /api/permissions/file/:fileId/public - Make file public
    if (path.match(/^\/api\/permissions\/file\/[^/]+\/public$/) && request.method === "POST") {
      const pathParts = path.split("/");
      pathParts.pop(); // Remove 'public'
      const fileId = pathParts.pop()!;

      // Check if user is owner or admin
      const owner = await isFileOwner(fileId, user.id, env);
      if (!owner && user.role !== "admin") {
        return errorResponse("Only file owner can make file public", 403);
      }

      const body = await request.json() as { permission: "read" | "write" };

      if (!body.permission || !["read", "write"].includes(body.permission)) {
        return errorResponse("Invalid permission type", 400);
      }

      // Check if public permission exists
      const existing = await env.DB.prepare(
        "SELECT id FROM permissions WHERE file_id = ? AND user_id IS NULL"
      )
        .bind(fileId)
        .first<{ id: string }>();

      if (existing) {
        // Update existing
        await env.DB.prepare(
          "UPDATE permissions SET permission = ? WHERE id = ?"
        )
          .bind(body.permission, existing.id)
          .run();

        return successResponse(null, "Public permission updated");
      }

      // Create new public permission
      const permissionId = generateId();
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(
        "INSERT INTO permissions (id, file_id, user_id, permission, created_at) VALUES (?, ?, NULL, ?, ?)"
      )
        .bind(permissionId, fileId, body.permission, now)
        .run();

      return successResponse(null, "File made public");
    }

    // DELETE /api/permissions/file/:fileId/public - Make file private
    if (path.match(/^\/api\/permissions\/file\/[^/]+\/public$/) && request.method === "DELETE") {
      const pathParts = path.split("/");
      pathParts.pop(); // Remove 'public'
      const fileId = pathParts.pop()!;

      // Check if user is owner or admin
      const owner = await isFileOwner(fileId, user.id, env);
      if (!owner && user.role !== "admin") {
        return errorResponse("Only file owner can make file private", 403);
      }

      // Delete public permission
      const result = await env.DB.prepare(
        "DELETE FROM permissions WHERE file_id = ? AND user_id IS NULL"
      )
        .bind(fileId)
        .run();

      if (result.meta.changes === 0) {
        return errorResponse("File is not public or permission not found", 404);
      }

      return successResponse(null, "File made private");
    }

    // Route not found
    return errorResponse(`Permission route not found: ${path}`, 404);
  } catch (error) {
    console.error("Permissions error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Permission operation error",
      500
    );
  }
}
