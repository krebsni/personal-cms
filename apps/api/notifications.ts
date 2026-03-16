// Notifications API for Cloudflare Workers
import { Hono } from "hono";
import type { Env } from "./types";
import { getUserFromContext } from "./auth";
import { generateId } from "./utils";

const app = new Hono<{ Bindings: Env }>();

// GET /api/notifications - List all notifications for the current user
app.get("/", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const notifications = await c.env.DB.prepare(`
      SELECT n.*, u.username as sender_username, u.email as sender_email
      FROM notifications n
      JOIN users u ON n.sender_id = u.id
      WHERE n.recipient_id = ?
      ORDER BY n.created_at DESC
    `)
      .bind(user.id)
      .all();

    return c.json({ success: true, data: notifications.results });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/notifications/request-access - Create an access request notification
app.post("/request-access", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const body = await c.req.json() as { resourceId: string };
    if (!body.resourceId) {
      return c.json({ success: false, error: "Resource ID is required" }, 400);
    }

    // Determine the owner of the resource (file or folder or repository)
    let recipientId: string | null = null;

    // Check File
    const file = await c.env.DB.prepare(
        "SELECT f.owner_id as file_owner, r.owner_id as repo_owner FROM files f LEFT JOIN repositories r ON f.repository_id = r.id WHERE f.id = ?"
    ).bind(body.resourceId).first<{ file_owner: string, repo_owner: string }>();

    if (file) {
        recipientId = file.file_owner || file.repo_owner;
    } else {
        // Check Folder
        const folder = await c.env.DB.prepare(
            "SELECT f.owner_id as folder_owner, r.owner_id as repo_owner FROM folders f LEFT JOIN repositories r ON f.repository_id = r.id WHERE f.id = ?"
        ).bind(body.resourceId).first<{ folder_owner: string, repo_owner: string }>();

        if (folder) {
            recipientId = folder.folder_owner || folder.repo_owner;
        } else {
            // Check Repository directly
             const repo = await c.env.DB.prepare(
                "SELECT owner_id FROM repositories WHERE id = ?"
            ).bind(body.resourceId).first<{ owner_id: string }>();

            if (repo) recipientId = repo.owner_id;
        }
    }

    if (!recipientId) {
      return c.json({ success: false, error: "Resource not found or has no owner" }, 404);
    }

    // Don't let users request access from themselves
    if (recipientId === user.id) {
       return c.json({ success: false, error: "You already own this resource" }, 400);
    }

    // Check if a pending request already exists
    const existing = await c.env.DB.prepare(`
        SELECT id FROM notifications
        WHERE sender_id = ? AND recipient_id = ? AND resource_id = ? AND status = 'pending'
    `).bind(user.id, recipientId, body.resourceId).first();

    if (existing) {
        return c.json({ success: true, message: "Request already sent" });
    }

    const notificationId = generateId();
    const now = Math.floor(Date.now() / 1000);

    // Create notification
    await c.env.DB.prepare(`
      INSERT INTO notifications (id, recipient_id, sender_id, type, resource_id, status, created_at)
      VALUES (?, ?, ?, 'access_request', ?, 'pending', ?)
    `)
      .bind(notificationId, recipientId, user.id, body.resourceId, now)
      .run();

    return c.json({
        success: true,
        message: "Access request sent successfully",
        data: { id: notificationId }
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/notifications/:id/resolve - Accept or Deny request and clear notification
app.post("/:id/resolve", async (c) => {
    try {
      const user = await getUserFromContext(c);
      if (!user) {
        return c.json({ success: false, error: "Authentication required" }, 401);
      }

      const notificationId = c.req.param("id");
      const body = await c.req.json() as { action: 'accept' | 'deny', role?: 'viewer' | 'editor' };

      if (!['accept', 'deny'].includes(body.action)) {
        return c.json({ success: false, error: "Action must be accept or deny" }, 400);
      }

      // Get notification
      const notification = await c.env.DB.prepare(`SELECT * FROM notifications WHERE id = ?`)
        .bind(notificationId).first<{ id: string, recipient_id: string, sender_id: string, resource_id: string, status: string }>();

      if (!notification) {
        return c.json({ success: false, error: "Notification not found" }, 404);
      }

      // Only the recipient can resolve it
      if (notification.recipient_id !== user.id) {
         return c.json({ success: false, error: "Access denied" }, 403);
      }

      if (body.action === 'accept') {
          const role = body.role || 'viewer';
          const assignmentId = generateId();
          const now = Math.floor(Date.now() / 1000);

          // Assign access
          await c.env.DB.prepare(`
            INSERT INTO assignments (id, resource_id, user_id, role, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, resource_id) DO UPDATE SET role = excluded.role
          `)
            .bind(assignmentId, notification.resource_id, notification.sender_id, role, now)
            .run();
      }

      // Update notification status (could also just delete it, but keeping it for history is nice)
      await c.env.DB.prepare(`UPDATE notifications SET status = ? WHERE id = ?`)
        .bind(body.action === 'accept' ? 'accepted' : 'denied', notificationId)
        .run();

      return c.json({ success: true, message: `Request ${body.action}ed` });
    } catch (e: any) {
      return c.json({ success: false, error: e.message }, 500);
    }
  });

  // DELETE /api/notifications/:id - Dismiss/Delete a notification
  app.delete("/:id", async (c) => {
    try {
      const user = await getUserFromContext(c);
      if (!user) {
        return c.json({ success: false, error: "Authentication required" }, 401);
      }

      const notificationId = c.req.param("id");

      // Ensure the notification belongs to this user
      const deleted = await c.env.DB.prepare("DELETE FROM notifications WHERE id = ? AND recipient_id = ? RETURNING id")
        .bind(notificationId, user.id)
        .first();

      if (!deleted) {
        return c.json({ success: false, error: "Notification not found or access denied" }, 404);
      }

      return c.json({ success: true, message: "Notification deleted" });
    } catch (e: any) {
      return c.json({ success: false, error: e.message }, 500);
    }
  });

export { app as notificationsApp };
