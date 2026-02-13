// Admin API module for Cloudflare Workers
import type { Env, ResponseHelpers } from "./index";
import { getUserFromRequest } from "./auth";
import * as bcrypt from "bcryptjs";

// User type matching database schema
interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  created_at: number;
  updated_at: number;
}

// Color type matching database schema
interface HighlightColor {
  id: string;
  name: string;
  hex_code: string;
  is_default: number; // SQLite uses 0/1 for boolean
  display_order: number;
  created_at: number;
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID();
}

// Check if user is admin
function requireAdmin(user: User | null): user is User & { role: "admin" } {
  return user?.role === "admin";
}

// Admin router
export async function adminRouter(
  request: Request,
  env: Env,
  helpers: ResponseHelpers
): Promise<Response> {
  const { successResponse, errorResponse } = helpers;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Get current user (required for all admin operations)
    const user = await getUserFromRequest(request, env);

    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    // Check admin role
    if (!requireAdmin(user)) {
      return errorResponse("Admin access required", 403);
    }

    // ========== USER MANAGEMENT ENDPOINTS ==========

    // GET /api/admin/users - List all users
    if (path === "/api/admin/users" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC"
      ).all<Omit<User, "password_hash">>();

      const users = result.results || [];

      // Convert to API format
      const usersData = users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      return successResponse(usersData);
    }

    // POST /api/admin/users - Create user
    if (path === "/api/admin/users" && request.method === "POST") {
      const body = await request.json() as {
        username: string;
        email: string;
        password: string;
        role?: "admin" | "user";
      };

      // Validate input
      if (!body.username || !body.email || !body.password) {
        return errorResponse("username, email, and password are required", 400);
      }

      if (body.password.length < 8) {
        return errorResponse("Password must be at least 8 characters", 400);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return errorResponse("Invalid email format", 400);
      }

      // Check if username or email already exists
      const existing = await env.DB.prepare(
        "SELECT id FROM users WHERE username = ? OR email = ?"
      )
        .bind(body.username, body.email)
        .first<{ id: string }>();

      if (existing) {
        return errorResponse("Username or email already exists", 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 10);

      // Create user
      const userId = generateId();
      const now = Math.floor(Date.now() / 1000);
      const role = body.role || "user";

      await env.DB.prepare(
        "INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(userId, body.username, body.email, passwordHash, role, now, now)
        .run();

      return successResponse(
        {
          id: userId,
          username: body.username,
          email: body.email,
          role,
          createdAt: now,
          updatedAt: now,
        },
        "User created successfully"
      );
    }

    // PUT /api/admin/users/:id - Update user
    if (path.match(/^\/api\/admin\/users\/[^/]+$/) && request.method === "PUT") {
      const userId = path.split("/").pop()!;

      const body = await request.json() as {
        username?: string;
        email?: string;
        role?: "admin" | "user";
        password?: string;
      };

      // Get existing user
      const existingUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(userId)
        .first<User>();

      if (!existingUser) {
        return errorResponse("User not found", 404);
      }

      // Prepare update fields
      const updates: string[] = [];
      const values: any[] = [];

      if (body.username && body.username !== existingUser.username) {
        // Check if new username is taken
        const usernameExists = await env.DB.prepare(
          "SELECT id FROM users WHERE username = ? AND id != ?"
        )
          .bind(body.username, userId)
          .first<{ id: string }>();

        if (usernameExists) {
          return errorResponse("Username already exists", 409);
        }

        updates.push("username = ?");
        values.push(body.username);
      }

      if (body.email && body.email !== existingUser.email) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return errorResponse("Invalid email format", 400);
        }

        // Check if new email is taken
        const emailExists = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ? AND id != ?"
        )
          .bind(body.email, userId)
          .first<{ id: string }>();

        if (emailExists) {
          return errorResponse("Email already exists", 409);
        }

        updates.push("email = ?");
        values.push(body.email);
      }

      if (body.role && ["admin", "user"].includes(body.role)) {
        updates.push("role = ?");
        values.push(body.role);
      }

      if (body.password) {
        if (body.password.length < 8) {
          return errorResponse("Password must be at least 8 characters", 400);
        }

        const passwordHash = await bcrypt.hash(body.password, 10);
        updates.push("password_hash = ?");
        values.push(passwordHash);
      }

      if (updates.length === 0) {
        return errorResponse("No valid fields to update", 400);
      }

      // Add updated_at
      const now = Math.floor(Date.now() / 1000);
      updates.push("updated_at = ?");
      values.push(now);

      // Add userId to values for WHERE clause
      values.push(userId);

      // Execute update
      await env.DB.prepare(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
      )
        .bind(...values)
        .run();

      // Fetch updated user
      const updatedUser = await env.DB.prepare(
        "SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?"
      )
        .bind(userId)
        .first<Omit<User, "password_hash">>();

      return successResponse(
        {
          id: updatedUser!.id,
          username: updatedUser!.username,
          email: updatedUser!.email,
          role: updatedUser!.role,
          createdAt: updatedUser!.created_at,
          updatedAt: updatedUser!.updated_at,
        },
        "User updated successfully"
      );
    }

    // DELETE /api/admin/users/:id - Delete user
    if (path.match(/^\/api\/admin\/users\/[^/]+$/) && request.method === "DELETE") {
      const userId = path.split("/").pop()!;

      // Prevent admin from deleting themselves
      if (userId === user.id) {
        return errorResponse("Cannot delete your own account", 400);
      }

      // Check if user exists
      const existingUser = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
        .bind(userId)
        .first<{ id: string }>();

      if (!existingUser) {
        return errorResponse("User not found", 404);
      }

      // Delete user (cascade will handle related records)
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

      return successResponse(null, "User deleted successfully");
    }

    // ========== COLOR PALETTE ENDPOINTS ==========

    // GET /api/admin/colors - Get all highlight colors
    if (path === "/api/admin/colors" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM highlight_colors ORDER BY display_order ASC, created_at ASC"
      ).all<HighlightColor>();

      const colors = result.results || [];

      // Convert to API format
      const colorsData = colors.map((c) => ({
        id: c.id,
        name: c.name,
        hexCode: c.hex_code,
        isDefault: c.is_default === 1,
        displayOrder: c.display_order,
        createdAt: c.created_at,
      }));

      return successResponse(colorsData);
    }

    // POST /api/admin/colors - Add highlight color
    if (path === "/api/admin/colors" && request.method === "POST") {
      const body = await request.json() as {
        name: string;
        hexCode: string;
        isDefault?: boolean;
        displayOrder?: number;
      };

      // Validate input
      if (!body.name || !body.hexCode) {
        return errorResponse("name and hexCode are required", 400);
      }

      // Validate hex code format
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!hexRegex.test(body.hexCode)) {
        return errorResponse("Invalid hex code format (must be #RRGGBB)", 400);
      }

      // Check if color with same name exists
      const existing = await env.DB.prepare(
        "SELECT id FROM highlight_colors WHERE name = ?"
      )
        .bind(body.name)
        .first<{ id: string }>();

      if (existing) {
        return errorResponse("Color with this name already exists", 409);
      }

      // Get max display order if not provided
      let displayOrder = body.displayOrder || 0;
      if (!body.displayOrder) {
        const maxOrder = await env.DB.prepare(
          "SELECT MAX(display_order) as max_order FROM highlight_colors"
        ).first<{ max_order: number | null }>();

        displayOrder = (maxOrder?.max_order || 0) + 1;
      }

      // Create color
      const colorId = generateId();
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(
        "INSERT INTO highlight_colors (id, name, hex_code, is_default, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          colorId,
          body.name,
          body.hexCode,
          body.isDefault ? 1 : 0,
          displayOrder,
          now
        )
        .run();

      return successResponse(
        {
          id: colorId,
          name: body.name,
          hexCode: body.hexCode,
          isDefault: body.isDefault || false,
          displayOrder,
          createdAt: now,
        },
        "Color added successfully"
      );
    }

    // PUT /api/admin/colors/:id - Update highlight color
    if (path.match(/^\/api\/admin\/colors\/[^/]+$/) && request.method === "PUT") {
      const colorId = path.split("/").pop()!;

      const body = await request.json() as {
        name?: string;
        hexCode?: string;
        isDefault?: boolean;
        displayOrder?: number;
      };

      // Get existing color
      const existingColor = await env.DB.prepare(
        "SELECT * FROM highlight_colors WHERE id = ?"
      )
        .bind(colorId)
        .first<HighlightColor>();

      if (!existingColor) {
        return errorResponse("Color not found", 404);
      }

      // Prepare update fields
      const updates: string[] = [];
      const values: any[] = [];

      if (body.name && body.name !== existingColor.name) {
        // Check if new name is taken
        const nameExists = await env.DB.prepare(
          "SELECT id FROM highlight_colors WHERE name = ? AND id != ?"
        )
          .bind(body.name, colorId)
          .first<{ id: string }>();

        if (nameExists) {
          return errorResponse("Color name already exists", 409);
        }

        updates.push("name = ?");
        values.push(body.name);
      }

      if (body.hexCode) {
        // Validate hex code format
        const hexRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexRegex.test(body.hexCode)) {
          return errorResponse("Invalid hex code format (must be #RRGGBB)", 400);
        }

        updates.push("hex_code = ?");
        values.push(body.hexCode);
      }

      if (body.isDefault !== undefined) {
        updates.push("is_default = ?");
        values.push(body.isDefault ? 1 : 0);
      }

      if (body.displayOrder !== undefined) {
        updates.push("display_order = ?");
        values.push(body.displayOrder);
      }

      if (updates.length === 0) {
        return errorResponse("No valid fields to update", 400);
      }

      // Add colorId to values for WHERE clause
      values.push(colorId);

      // Execute update
      await env.DB.prepare(
        `UPDATE highlight_colors SET ${updates.join(", ")} WHERE id = ?`
      )
        .bind(...values)
        .run();

      // Fetch updated color
      const updatedColor = await env.DB.prepare(
        "SELECT * FROM highlight_colors WHERE id = ?"
      )
        .bind(colorId)
        .first<HighlightColor>();

      return successResponse(
        {
          id: updatedColor!.id,
          name: updatedColor!.name,
          hexCode: updatedColor!.hex_code,
          isDefault: updatedColor!.is_default === 1,
          displayOrder: updatedColor!.display_order,
          createdAt: updatedColor!.created_at,
        },
        "Color updated successfully"
      );
    }

    // DELETE /api/admin/colors/:id - Delete highlight color
    if (path.match(/^\/api\/admin\/colors\/[^/]+$/) && request.method === "DELETE") {
      const colorId = path.split("/").pop()!;

      // Check if color exists
      const existingColor = await env.DB.prepare(
        "SELECT id FROM highlight_colors WHERE id = ?"
      )
        .bind(colorId)
        .first<{ id: string }>();

      if (!existingColor) {
        return errorResponse("Color not found", 404);
      }

      // Delete color
      await env.DB.prepare("DELETE FROM highlight_colors WHERE id = ?")
        .bind(colorId)
        .run();

      return successResponse(null, "Color deleted successfully");
    }

    // Route not found
    return errorResponse(`Admin route not found: ${path}`, 404);
  } catch (error) {
    console.error("Admin API error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Admin operation error",
      500
    );
  }
}
