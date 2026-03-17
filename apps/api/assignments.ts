// Assignments API for Cloudflare Workers
import { Hono } from "hono";
import type { Env } from "./types";
import { getUserFromContext } from "./auth";
import { generateId } from "./utils";

const app = new Hono<{ Bindings: Env }>();

// GET /api/assignments/:resourceId - List assignments for a resource
app.get("/:resourceId", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const resourceId = c.req.param("resourceId");

    // Retrieve all assignments for this resource
    // Also include user details
    const assignments = await c.env.DB.prepare(`
      SELECT a.id, a.user_id, a.role, a.created_at, u.username, u.email
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      WHERE a.resource_id = ?
      ORDER BY a.created_at DESC
    `)
      .bind(resourceId)
      .all<{
        id: string;
        user_id: string;
        role: "viewer" | "editor";
        created_at: number;
        username: string;
        email: string;
      }>();

    return c.json({ success: true, data: assignments.results });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/assignments/:resourceId - Create an assignment
app.post("/:resourceId", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const resourceId = c.req.param("resourceId");
    const body = await c.req.json() as { email: string; role: "viewer" | "editor" };

    if (!body.email || !['viewer', 'editor'].includes(body.role)) {
      return c.json({ success: false, error: "Valid email and role ('viewer' or 'editor') are required" }, 400);
    }

    // Verify the caller has permission to assign (must be repo owner or admin, or file owner)
    // For simplicity, we just check if the caller is the owner of the resource or an admin.
    let isOwner = user.role === 'admin';
    if (!isOwner) {
        // Is it a file? Check file owner or repo owner
        const fileOwner = await c.env.DB.prepare(`
            SELECT 1 FROM files f LEFT JOIN repositories r ON f.repository_id = r.id
            WHERE f.id = ? AND (f.owner_id = ? OR r.owner_id = ?)
        `).bind(resourceId, user.id, user.id).first();

        if (fileOwner) isOwner = true;
        else {
            // Is it a folder? Check folder owner or repo owner
            const folderOwner = await c.env.DB.prepare(`
                SELECT 1 FROM folders f LEFT JOIN repositories r ON f.repository_id = r.id
                WHERE f.id = ? AND (f.owner_id = ? OR r.owner_id = ?)
            `).bind(resourceId, user.id, user.id).first();

            if (folderOwner) isOwner = true;
        }
    }

    if (!isOwner) {
        return c.json({ success: false, error: "Only owners or admins can manage assignments" }, 403);
    }

    // Find user to assign
    const targetUser = await c.env.DB.prepare("SELECT id, username, email FROM users WHERE email = ?")
      .bind(body.email)
      .first<{ id: string, username: string, email: string }>();

    if (!targetUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const assignmentId = generateId();
    const now = Math.floor(Date.now() / 1000);

    // Upsert assignment (if already assigned, update role)
    await c.env.DB.prepare(`
      INSERT INTO assignments (id, resource_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, resource_id) DO UPDATE SET role = excluded.role
    `)
      .bind(assignmentId, resourceId, targetUser.id, body.role, now)
      .run();

    return c.json({
        success: true,
        message: "Assigned successfully",
        data: {
             id: assignmentId,
             resource_id: resourceId,
             user_id: targetUser.id,
             role: body.role,
             username: targetUser.username,
             email: targetUser.email,
             created_at: now
        }
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/assignments/:resourceId/:userId - Delete an assignment
app.delete("/:resourceId/:userId", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const resourceId = c.req.param("resourceId");
    const targetUserId = c.req.param("userId");

    // Check permissions
    let isOwner = user.role === 'admin';
    if (!isOwner) {
        const fileOwner = await c.env.DB.prepare(`
            SELECT 1 FROM files f LEFT JOIN repositories r ON f.repository_id = r.id
            WHERE f.id = ? AND (f.owner_id = ? OR r.owner_id = ?)
        `).bind(resourceId, user.id, user.id).first();
        if (fileOwner) isOwner = true;
        else {
            const folderOwner = await c.env.DB.prepare(`
                SELECT 1 FROM folders f LEFT JOIN repositories r ON f.repository_id = r.id
                WHERE f.id = ? AND (f.owner_id = ? OR r.owner_id = ?)
            `).bind(resourceId, user.id, user.id).first();
            if (folderOwner) isOwner = true;
        }
    }

    if (!isOwner) {
        return c.json({ success: false, error: "Only owners or admins can manage assignments" }, 403);
    }

    await c.env.DB.prepare("DELETE FROM assignments WHERE resource_id = ? AND user_id = ?")
      .bind(resourceId, targetUserId)
      .run();

    return c.json({ success: true, message: "Assignment removed" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export { app as assignmentsApp };
