// Highlights module for Cloudflare Workers
import type { Env, ResponseHelpers } from "./index";
import { getUserFromRequest } from "./auth";
import { checkFilePermission } from "./files";

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

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID();
}

// Highlights router
export async function highlightsRouter(
  request: Request,
  env: Env,
  helpers: ResponseHelpers
): Promise<Response> {
  const { successResponse, errorResponse } = helpers;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Get current user (required for highlights)
    const user = await getUserFromRequest(request, env);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    // GET /api/highlights/file/:fileId - Get user's highlights for file
    if (path.match(/^\/api\/highlights\/file\/[^/]+$/) && request.method === "GET") {
      const fileId = path.split("/").pop()!;

      // Check if user has read permission
      const hasPermission = await checkFilePermission(fileId, user.id, "read", env);
      if (!hasPermission) {
        return errorResponse("Access denied", 403);
      }

      // Get all highlights for this file by this user
      const result = await env.DB.prepare(
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

      return successResponse(highlightsData);
    }

    // POST /api/highlights - Create highlight
    if (path === "/api/highlights" && request.method === "POST") {
      const body = await request.json() as {
        fileId: string;
        startOffset: number;
        endOffset: number;
        color: string;
        textSnapshot: string;
      };

      // Validate input
      if (!body.fileId || body.startOffset === undefined || body.endOffset === undefined) {
        return errorResponse("fileId, startOffset, and endOffset are required", 400);
      }

      if (!body.color || !body.textSnapshot) {
        return errorResponse("color and textSnapshot are required", 400);
      }

      if (body.startOffset < 0 || body.endOffset <= body.startOffset) {
        return errorResponse("Invalid offset range", 400);
      }

      // Check if user has read permission
      const hasPermission = await checkFilePermission(body.fileId, user.id, "read", env);
      if (!hasPermission) {
        return errorResponse("Access denied", 403);
      }

      // Create highlight
      const highlightId = generateId();
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(
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

      return successResponse(
        {
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
        "Highlight created"
      );
    }

    // PUT /api/highlights/:id - Update highlight
    if (path.match(/^\/api\/highlights\/[^/]+$/) && request.method === "PUT") {
      const highlightId = path.split("/").pop()!;

      const body = await request.json() as {
        color?: string;
        startOffset?: number;
        endOffset?: number;
        textSnapshot?: string;
      };

      // Get existing highlight
      const highlight = await env.DB.prepare("SELECT * FROM highlights WHERE id = ?")
        .bind(highlightId)
        .first<Highlight>();

      if (!highlight) {
        return errorResponse("Highlight not found", 404);
      }

      // Check if user owns this highlight
      if (highlight.user_id !== user.id) {
        return errorResponse("Only highlight owner can update it", 403);
      }

      // Validate offset range if provided
      const startOffset = body.startOffset ?? highlight.start_offset;
      const endOffset = body.endOffset ?? highlight.end_offset;

      if (startOffset < 0 || endOffset <= startOffset) {
        return errorResponse("Invalid offset range", 400);
      }

      // Update highlight
      const now = Math.floor(Date.now() / 1000);
      const color = body.color || highlight.color;
      const textSnapshot = body.textSnapshot || highlight.text_snapshot;

      await env.DB.prepare(
        "UPDATE highlights SET start_offset = ?, end_offset = ?, color = ?, text_snapshot = ?, updated_at = ? WHERE id = ?"
      )
        .bind(startOffset, endOffset, color, textSnapshot, now, highlightId)
        .run();

      return successResponse(
        {
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
        "Highlight updated"
      );
    }

    // DELETE /api/highlights/:id - Delete highlight
    if (path.match(/^\/api\/highlights\/[^/]+$/) && request.method === "DELETE") {
      const highlightId = path.split("/").pop()!;

      // Get existing highlight to check ownership
      const highlight = await env.DB.prepare("SELECT * FROM highlights WHERE id = ?")
        .bind(highlightId)
        .first<Highlight>();

      if (!highlight) {
        return errorResponse("Highlight not found", 404);
      }

      // Check if user owns this highlight
      if (highlight.user_id !== user.id) {
        return errorResponse("Only highlight owner can delete it", 403);
      }

      // Delete highlight
      await env.DB.prepare("DELETE FROM highlights WHERE id = ?").bind(highlightId).run();

      return successResponse(null, "Highlight deleted");
    }

    // Route not found
    return errorResponse(`Highlight route not found: ${path}`, 404);
  } catch (error) {
    console.error("Highlights error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Highlight operation error",
      500
    );
  }
}
