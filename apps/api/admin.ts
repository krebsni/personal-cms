// Admin API module for Cloudflare Workers
import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { Env, User } from "./types";
import { getUserFromContext } from "./auth";
import { generateId } from "./utils";

// Color type matching database schema
interface HighlightColor {
  id: string;
  name: string;
  hex_code: string;
  is_default: number; // SQLite uses 0/1 for boolean
  display_order: number;
  created_at: number;
}



// Check if user is admin
function requireAdmin(user: User | null): user is User & { role: "admin" } {
  return user?.role === "admin";
}

const app = new Hono<{ Bindings: Env }>();

// Middleware to check admin role for all routes in this app
app.use("*", async (c, next) => {
  const user = await getUserFromContext(c);
  if (!user) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }
  if (!requireAdmin(user)) {
    return c.json({ success: false, error: "Admin access required" }, 403);
  }
  // Store user in context if needed, but for now we re-fetch or use logic
  // could use c.set() but types are tricky without extending HonoRequest
  await next();
});


// ========== USER MANAGEMENT ENDPOINTS ==========

// GET /api/admin/users - List all users
app.get("/users", async (c) => {
  try {
    const result = await c.env.DB.prepare(
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

    return c.json({ success: true, data: usersData });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/admin/users - Create user
app.post("/users", async (c) => {
  try {
    const body = await c.req.json() as {
      username: string;
      email: string;
      password: string;
      role?: "admin" | "user";
    };

    // Validate input
    if (!body.username || !body.email || !body.password) {
      return c.json({ success: false, error: "username, email, and password are required" }, 400);
    }

    if (body.password.length < 8) {
      return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return c.json({ success: false, error: "Invalid email format" }, 400);
    }

    // Check if username or email already exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM users WHERE username = ? OR email = ?"
    )
      .bind(body.username, body.email)
      .first<{ id: string }>();

    if (existing) {
      return c.json({ success: false, error: "Username or email already exists" }, 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Create user
    const userId = generateId();
    const now = Math.floor(Date.now() / 1000);
    const role = body.role || "user";

    await c.env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(userId, body.username, body.email, passwordHash, role, now, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: userId,
        username: body.username,
        email: body.email,
        role,
        createdAt: now,
        updatedAt: now,
      },
      message: "User created successfully"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/admin/users/:id - Update user
app.put("/users/:id", async (c) => {
  try {
    const userId = c.req.param("id");
    const body = await c.req.json() as {
      username?: string;
      email?: string;
      role?: "admin" | "user";
      password?: string;
    };

    // Get existing user
    const existingUser = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .first<User>();

    if (!existingUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Prepare update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (body.username && body.username !== existingUser.username) {
      // Check if new username is taken
      const usernameExists = await c.env.DB.prepare(
        "SELECT id FROM users WHERE username = ? AND id != ?"
      )
        .bind(body.username, userId)
        .first<{ id: string }>();

      if (usernameExists) {
        return c.json({ success: false, error: "Username already exists" }, 409);
      }

      updates.push("username = ?");
      values.push(body.username);
    }

    if (body.email && body.email !== existingUser.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return c.json({ success: false, error: "Invalid email format" }, 400);
      }

      // Check if new email is taken
      const emailExists = await c.env.DB.prepare(
        "SELECT id FROM users WHERE email = ? AND id != ?"
      )
        .bind(body.email, userId)
        .first<{ id: string }>();

      if (emailExists) {
        return c.json({ success: false, error: "Email already exists" }, 409);
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
        return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
      }

      const passwordHash = await bcrypt.hash(body.password, 10);
      updates.push("password_hash = ?");
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: "No valid fields to update" }, 400);
    }

    // Add updated_at
    const now = Math.floor(Date.now() / 1000);
    updates.push("updated_at = ?");
    values.push(now);

    // Add userId to values for WHERE clause
    values.push(userId);

    // Execute update
    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
    )
      .bind(...values)
      .run();

    // Fetch updated user
    const updatedUser = await c.env.DB.prepare(
      "SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?"
    )
      .bind(userId)
      .first<Omit<User, "password_hash">>();

    return c.json({
      success: true,
      data: {
        id: updatedUser!.id,
        username: updatedUser!.username,
        email: updatedUser!.email,
        role: updatedUser!.role,
        createdAt: updatedUser!.created_at,
        updatedAt: updatedUser!.updated_at,
      },
      message: "User updated successfully"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/admin/users/:id - Delete user
app.delete("/users/:id", async (c) => {
  try {
    const userId = c.req.param("id");

    // We already checked admin role in middleware, but need to check if user deletes themselves.
    // However, getUserFromContext might be needed again or cached.
    const currentUser = await getUserFromContext(c); // Lightweight since we verified token in middleware

    // Prevent admin from deleting themselves
    if (userId === currentUser?.id) {
      return c.json({ success: false, error: "Cannot delete your own account" }, 400);
    }

    // Check if user exists
    const existingUser = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?")
      .bind(userId)
      .first<{ id: string }>();

    if (!existingUser) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Delete user (cascade will handle related records)
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

    return c.json({ success: true, message: "User deleted successfully" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});


// ========== COLOR PALETTE ENDPOINTS ==========

// GET /api/admin/colors - Get all highlight colors
app.get("/colors", async (c) => {
  try {
    const result = await c.env.DB.prepare(
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

    return c.json({ success: true, data: colorsData });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/admin/colors - Add highlight color
app.post("/colors", async (c) => {
  try {
    const body = await c.req.json() as {
      name: string;
      hexCode: string;
      isDefault?: boolean;
      displayOrder?: number;
    };

    // Validate input
    if (!body.name || !body.hexCode) {
      return c.json({ success: false, error: "name and hexCode are required" }, 400);
    }

    // Validate hex code format
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(body.hexCode)) {
      return c.json({ success: false, error: "Invalid hex code format (must be #RRGGBB)" }, 400);
    }

    // Check if color with same name exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM highlight_colors WHERE name = ?"
    )
      .bind(body.name)
      .first<{ id: string }>();

    if (existing) {
      return c.json({ success: false, error: "Color with this name already exists" }, 409);
    }

    // Get max display order if not provided
    let displayOrder = body.displayOrder || 0;
    if (!body.displayOrder) {
      const maxOrder = await c.env.DB.prepare(
        "SELECT MAX(display_order) as max_order FROM highlight_colors"
      ).first<{ max_order: number | null }>();

      displayOrder = (maxOrder?.max_order || 0) + 1;
    }

    // Create color
    const colorId = generateId();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
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

    return c.json({
      success: true,
      data: {
        id: colorId,
        name: body.name,
        hexCode: body.hexCode,
        isDefault: body.isDefault || false,
        displayOrder,
        createdAt: now,
      },
      message: "Color added successfully"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/admin/colors/:id - Update highlight color
app.put("/colors/:id", async (c) => {
  try {
    const colorId = c.req.param("id");
    const body = await c.req.json() as {
      name?: string;
      hexCode?: string;
      isDefault?: boolean;
      displayOrder?: number;
    };

    // Get existing color
    const existingColor = await c.env.DB.prepare(
      "SELECT * FROM highlight_colors WHERE id = ?"
    )
      .bind(colorId)
      .first<HighlightColor>();

    if (!existingColor) {
      return c.json({ success: false, error: "Color not found" }, 404);
    }

    // Prepare update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name && body.name !== existingColor.name) {
      // Check if new name is taken
      const nameExists = await c.env.DB.prepare(
        "SELECT id FROM highlight_colors WHERE name = ? AND id != ?"
      )
        .bind(body.name, colorId)
        .first<{ id: string }>();

      if (nameExists) {
        return c.json({ success: false, error: "Color name already exists" }, 409);
      }

      updates.push("name = ?");
      values.push(body.name);
    }

    if (body.hexCode) {
      // Validate hex code format
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!hexRegex.test(body.hexCode)) {
        return c.json({ success: false, error: "Invalid hex code format (must be #RRGGBB)" }, 400);
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
      return c.json({ success: false, error: "No valid fields to update" }, 400);
    }

    // Add colorId to values for WHERE clause
    values.push(colorId);

    // Execute update
    await c.env.DB.prepare(
      `UPDATE highlight_colors SET ${updates.join(", ")} WHERE id = ?`
    )
      .bind(...values)
      .run();

    // Fetch updated color
    const updatedColor = await c.env.DB.prepare(
      "SELECT * FROM highlight_colors WHERE id = ?"
    )
      .bind(colorId)
      .first<HighlightColor>();

    return c.json({
      success: true,
      data: {
        id: updatedColor!.id,
        name: updatedColor!.name,
        hexCode: updatedColor!.hex_code,
        isDefault: updatedColor!.is_default === 1,
        displayOrder: updatedColor!.display_order,
        createdAt: updatedColor!.created_at,
      },
      message: "Color updated successfully"
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/admin/colors/:id - Delete highlight color
app.delete("/colors/:id", async (c) => {
  try {
    const colorId = c.req.param("id");

    // Check if color exists
    const existingColor = await c.env.DB.prepare(
      "SELECT id FROM highlight_colors WHERE id = ?"
    )
      .bind(colorId)
      .first<{ id: string }>();

    if (!existingColor) {
      return c.json({ success: false, error: "Color not found" }, 404);
    }

    // Delete color
    await c.env.DB.prepare("DELETE FROM highlight_colors WHERE id = ?")
      .bind(colorId)
      .run();

    return c.json({ success: true, message: "Color deleted successfully" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export { app as adminApp };
