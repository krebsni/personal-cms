// Authentication module for Cloudflare Workers
import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import bcrypt from "bcryptjs";
import type { Env, User } from "./types";
import { generateId } from "./utils";



// Generate JWT token
async function generateToken(user: User, secret: string): Promise<string> {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };
  return await sign(payload, secret, "HS256");
}

// Verify and decode JWT token
async function verifyToken(token: string, secret: string): Promise<any> {
  return await verify(token, secret, "HS256");
}

// Get user from request (JWT in cookie or Authorization header)
// Adapted for Hono context
async function getUserFromContext(c: any): Promise<User | null> {
  const env = c.env as Env;
  let token: string | null = null;

  // Try cookie
  const cookieToken = getCookie(c, "token");
  if (cookieToken) {
    token = cookieToken;
  }

  // Try Authorization header
  if (!token) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = await verifyToken(token, env.JWT_SECRET);

    // Validate session in DB
    const tokenHash = token.substring(0, 64);

    // Check if session exists and is valid
    const session = await env.DB.prepare(
      "SELECT id FROM sessions WHERE user_id = ? AND token_hash = ? AND expires_at > ?"
    )
      .bind(decoded.sub, tokenHash, Math.floor(Date.now() / 1000))
      .first();

    if (!session) {
      // console.error("[Auth] Session not found or expired during verification");
      return null;
    }

    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(decoded.sub)
      .first<User>();

    return user;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// Legacy helper for other modules (until they are converted)
async function getUserFromRequest(request: Request, env: Env): Promise<User | null> {
  let token: string | null = null;

  const cookies = request.headers.get("Cookie");
  if (cookies) {
    const match = cookies.match(/token=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  try {
    const decoded = await verifyToken(token, env.JWT_SECRET);
    const tokenHash = token.substring(0, 64);

    const session = await env.DB.prepare(
      "SELECT id FROM sessions WHERE user_id = ? AND token_hash = ? AND expires_at > ?"
    )
      .bind(decoded.sub, tokenHash, Math.floor(Date.now() / 1000))
      .first();

    if (!session) return null;

    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(decoded.sub)
      .first<User>();

    return user;
  } catch (error) {
    return null;
  }
}

const app = new Hono<{ Bindings: Env }>();

// POST /api/auth/register
app.post("/register", async (c) => {
  try {
    const body = await c.req.json() as { username: string; email: string; password: string };

    if (!body.username || !body.email || !body.password) {
      return c.json({ success: false, error: "Username, email, and password are required" }, 400);
    }

    if (body.password.length < 8) {
      return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
    }

    const existingUser = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email = ? OR username = ?"
    )
      .bind(body.email, body.username)
      .first();

    if (existingUser) {
      return c.json({ success: false, error: "User with this email or username already exists" }, 409);
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const userId = generateId();
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(userId, body.username, body.email, passwordHash, "user", now, now)
      .run();

    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .first<User>();

    if (!user) {
      return c.json({ success: false, error: "Failed to create user" }, 500);
    }

    const token = await generateToken(user, c.env.JWT_SECRET);
    const { password_hash: _, ...userData } = user;

    const isDev = c.env.ENVIRONMENT === "development";

    setCookie(c, "token", token, {
      httpOnly: true,
      secure: !isDev, // Allow non-secure in dev
      sameSite: isDev ? "Lax" : "Strict", // Lax for dev to allow easier navigation
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return c.json({ success: true, data: userData, message: "User registered successfully" });
  } catch (e: any) {
    console.error("Get user failed:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/auth/login
app.post("/login", async (c) => {
  try {
    const body = await c.req.json() as { email: string; password: string };

    if (!body.email || !body.password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }

    const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
      .bind(body.email)
      .first<User>();

    if (!user) {
      return c.json({ success: false, error: "Invalid email or password" }, 401);
    }

    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) {
      return c.json({ success: false, error: "Invalid email or password" }, 401);
    }

    const token = await generateToken(user, c.env.JWT_SECRET);
    const sessionId = generateId();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 7 * 24 * 60 * 60;

    await c.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(sessionId, user.id, token.substring(0, 64), expiresAt, now)
      .run();

    const { password_hash: _, ...userData } = user;

    const isDev = c.env.ENVIRONMENT === "development";

    setCookie(c, "token", token, {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? "Lax" : "Strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return c.json({ success: true, data: userData, message: "Login successful" });
  } catch (e: any) {
    console.error("Get user failed:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/auth/logout
app.post("/logout", async (c) => {
  try {
    const user = await getUserFromContext(c);

    if (user) {
      // console.log(`[Auth] Logging out user ${user.id}`);
      await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
        .bind(user.id)
        .run();
    }

    const isDev = c.env.ENVIRONMENT === "development";

    deleteCookie(c, "token", {
      path: "/",
      secure: !isDev,
      httpOnly: true,
      sameSite: isDev ? "Lax" : "Strict"
    });

    return c.json({ success: true, message: "Logged out successfully" });
  } catch (e: any) {
    console.error("Get user failed:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/auth/me
app.get("/me", async (c) => {
  try {
    const user = await getUserFromContext(c);

    if (!user) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const { password_hash: _, ...userData } = user;
    return c.json({ success: true, data: userData });
  } catch (e: any) {
    console.error("Get user failed:", e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Export the Hono app as default (to be mounted) or named
export { app as authApp, getUserFromRequest, getUserFromContext };
