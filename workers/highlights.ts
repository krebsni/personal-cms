// Highlights module for Cloudflare Workers
import { Hono } from "hono";
import type { Env } from "./types";
import { getUserFromContext } from "./auth";
import { checkFilePermission } from "./files";
import { generateId } from "./utils";

// Highlight type matching database schema
interface Highlight {
  id: string;
  file_id: string;
  user_id: string;
  start_offset: number;
  end_offset: number;
  color: string;
  text_snapshot: string;
  created_at: number;
  updated_at: number;
}

interface HighlightColor {
  id: string;
  name: string;
  hex_code: string;
  sort_order: number;
}



const app = new Hono<{ Bindings: Env }>();

// GET /api/highlights/file/:fileId - Get user's highlights for file
app.get("/file/:fileId", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const fileId = c.req.param("fileId");

    // Check if user has read permission
    const hasPermission = await checkFilePermission(fileId, user.id, "read", c.env);
    if (!hasPermission) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Get all highlights for this file by this user
    const result = await c.env.DB.prepare(
      "SELECT * FROM highlights WHERE file_id = ? AND user_id = ? ORDER BY start_offset ASC"
    )
      .bind(fileId, user.id)
      .all<Highlight>();

    const highlights = result.results || [];

    // Convert to API format
    const highlightsData = highlights.map((h) => ({
      id: h.id,
      fileId: h.file_id,
      userId: h.user_id,
      startOffset: h.start_offset,
      endOffset: h.end_offset,
      color: h.color,
      textSnapshot: h.text_snapshot,
      createdAt: h.created_at,
      updatedAt: h.updated_at,
    }));

    return c.json({ success: true, data: highlightsData });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/highlights - Create highlight
app.post("/", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const body = await c.req.json() as {
      fileId: string;
      startOffset: number;
      endOffset: number;
      color: string;
      textSnapshot: string;
    };

    // Validate input
    if (!body.fileId || body.startOffset === undefined || body.endOffset === undefined) {
      return c.json({ success: false, error: "fileId, startOffset, and endOffset are required" }, 400);
    }

    if (!body.color || !body.textSnapshot) {
      return c.json({ success: false, error: "color and textSnapshot are required" }, 400);
    }

    if (body.startOffset < 0 || body.endOffset <= body.startOffset) {
      return c.json({ success: false, error: "Invalid offset range" }, 400);
    }

    // Check if user has read permission (highlights require read access to file content)
    const hasPermission = await checkFilePermission(body.fileId, user.id, "read", c.env);
    if (!hasPermission) {
      return c.json({ success: false, error: "Access denied" }, 403);
    }

    // Create highlight
    const highlightId = generateId();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      "INSERT INTO highlights (id, file_id, user_id, start_offset, end_offset, color, text_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        highlightId,
        body.fileId,
        user.id,
        body.startOffset,
        body.endOffset,
        body.color,
        body.textSnapshot,
        now,
        now
      )
      .run();

    return c.json({
      success: true,
      data: {
        id: highlightId,
        fileId: body.fileId,
        userId: user.id,
        startOffset: body.startOffset,
        endOffset: body.endOffset,
        color: body.color,
        textSnapshot: body.textSnapshot,
        createdAt: now,
        updatedAt: now,
      },
      message: "Highlight created"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/highlights/:id - Update highlight
app.put("/:id", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const highlightId = c.req.param("id");

    const body = await c.req.json() as {
      color?: string;
      startOffset?: number;
      endOffset?: number;
      textSnapshot?: string;
    };

    // Get existing highlight
    const highlight = await c.env.DB.prepare("SELECT * FROM highlights WHERE id = ?")
      .bind(highlightId)
      .first<Highlight>();

    if (!highlight) {
      return c.json({ success: false, error: "Highlight not found" }, 404);
    }

    // Check if user owns this highlight
    if (highlight.user_id !== user.id) {
      return c.json({ success: false, error: "Only highlight owner can update it" }, 403);
    }

    // Validate offset range if provided
    const startOffset = body.startOffset ?? highlight.start_offset;
    const endOffset = body.endOffset ?? highlight.end_offset;

    if (startOffset < 0 || endOffset <= startOffset) {
      return c.json({ success: false, error: "Invalid offset range" }, 400);
    }

    // Update highlight
    const now = Math.floor(Date.now() / 1000);
    const color = body.color || highlight.color;
    const textSnapshot = body.textSnapshot || highlight.text_snapshot;

    await c.env.DB.prepare(
      "UPDATE highlights SET start_offset = ?, end_offset = ?, color = ?, text_snapshot = ?, updated_at = ? WHERE id = ?"
    )
      .bind(startOffset, endOffset, color, textSnapshot, now, highlightId)
      .run();

    return c.json({
      success: true,
      data: {
        id: highlightId,
        fileId: highlight.file_id,
        userId: highlight.user_id,
        startOffset,
        endOffset,
        color,
        textSnapshot,
        createdAt: highlight.created_at,
        updatedAt: now,
      },
      message: "Highlight updated"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/highlights/:id - Delete highlight
app.delete("/:id", async (c) => {
  try {
    const user = await getUserFromContext(c);
    if (!user) {
      return c.json({ success: false, error: "Authentication required" }, 401);
    }

    const highlightId = c.req.param("id");

    // Get existing highlight to check ownership
    const highlight = await c.env.DB.prepare("SELECT * FROM highlights WHERE id = ?")
      .bind(highlightId)
      .first<Highlight>();

    if (!highlight) {
      return c.json({ success: false, error: "Highlight not found" }, 404);
    }

    // Check if user owns this highlight
    if (highlight.user_id !== user.id) {
      return c.json({ success: false, error: "Only highlight owner can delete it" }, 403);
    }

    // Delete highlight
    await c.env.DB.prepare("DELETE FROM highlights WHERE id = ?").bind(highlightId).run();

    return c.json({ success: true, message: "Highlight deleted" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/highlights/colors - Get highlight colors
app.get("/colors", async (c) => {
  try {
    const colors = await c.env.DB.prepare(
      "SELECT * FROM highlight_colors ORDER BY sort_order ASC"
    ).all<HighlightColor>();

    return c.json({
      success: true,
      data: (colors.results || []).map(color => ({
        id: color.id,
        name: color.name,
        hexCode: color.hex_code,
        sortOrder: color.sort_order
      }))
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export { app as highlightsApp };
