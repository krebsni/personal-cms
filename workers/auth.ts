// Authentication module for Cloudflare Workers
import bcrypt from "bcryptjs";
import type { Env, ResponseHelpers } from "./index";

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

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID();
}

// Generate JWT token
async function generateToken(user: User, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    })
  );

  const data = `${header}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signatureBase64}`;
}

// Verify and decode JWT token
async function verifyToken(token: string, secret: string): Promise<any> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Convert base64url to Uint8Array
  const signatureBytes = Uint8Array.from(
    atob(signature.replace(/-/g, "+").replace(/_/g, "/").padEnd(signature.length + ((4 - (signature.length % 4)) % 4), "=")),
    (c) => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));

  if (!valid) {
    throw new Error("Invalid signature");
  }

  const decoded = JSON.parse(atob(payload));

  // Check expiration
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return decoded;
}

// Get user from request (JWT in cookie or Authorization header)
async function getUserFromRequest(request: Request, env: Env): Promise<User | null> {
  let token: string | null = null;

  // Try cookie first
  const cookies = request.headers.get("Cookie");
  if (cookies) {
    const match = cookies.match(/token=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  // Try Authorization header
  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return null;
  }

  try {
    const decoded = await verifyToken(token, env.JWT_SECRET);
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(decoded.sub)
      .first<User>();

    return user;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// Create Set-Cookie header for JWT
function createAuthCookie(token: string, maxAge: number = 7 * 24 * 60 * 60): string {
  return `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

// Create clear cookie header
function createClearCookie(): string {
  return "token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

// Auth router
export async function authRouter(
  request: Request,
  env: Env,
  helpers: ResponseHelpers
): Promise<Response> {
  const { successResponse, errorResponse } = helpers;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // POST /api/auth/register
    if (path === "/api/auth/register" && request.method === "POST") {
      const body = await request.json() as { username: string; email: string; password: string };

      // Validate input
      if (!body.username || !body.email || !body.password) {
        return errorResponse("Username, email, and password are required", 400);
      }

      if (body.password.length < 8) {
        return errorResponse("Password must be at least 8 characters", 400);
      }

      // Check if user exists
      const existingUser = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ? OR username = ?"
      )
        .bind(body.email, body.username)
        .first();

      if (existingUser) {
        return errorResponse("User with this email or username already exists", 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 10);

      // Create user
      const userId = generateId();
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(
        "INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(userId, body.username, body.email, passwordHash, "user", now, now)
        .run();

      // Get created user
      const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(userId)
        .first<User>();

      if (!user) {
        return errorResponse("Failed to create user", 500);
      }

      // Generate JWT
      const token = await generateToken(user, env.JWT_SECRET);

      // Return user data (without password_hash)
      const { password_hash, ...userData } = user;

      const response = successResponse(userData, "User registered successfully");
      response.headers.set("Set-Cookie", createAuthCookie(token));

      return response;
    }

    // POST /api/auth/login
    if (path === "/api/auth/login" && request.method === "POST") {
      const body = await request.json() as { email: string; password: string };

      // Validate input
      if (!body.email || !body.password) {
        return errorResponse("Email and password are required", 400);
      }

      // Get user
      const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
        .bind(body.email)
        .first<User>();

      if (!user) {
        return errorResponse("Invalid email or password", 401);
      }

      // Verify password
      const valid = await bcrypt.compare(body.password, user.password_hash);

      if (!valid) {
        return errorResponse("Invalid email or password", 401);
      }

      // Generate JWT
      const token = await generateToken(user, env.JWT_SECRET);

      // Store session in database
      const sessionId = generateId();
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 7 * 24 * 60 * 60; // 7 days

      await env.DB.prepare(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(sessionId, user.id, token.substring(0, 64), expiresAt, now)
        .run();

      // Return user data (without password_hash)
      const { password_hash, ...userData } = user;

      const response = successResponse(userData, "Login successful");
      response.headers.set("Set-Cookie", createAuthCookie(token));

      return response;
    }

    // POST /api/auth/logout
    if (path === "/api/auth/logout" && request.method === "POST") {
      const user = await getUserFromRequest(request, env);

      if (user) {
        // Delete user sessions from database
        await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
          .bind(user.id)
          .run();
      }

      const response = successResponse(null, "Logged out successfully");
      response.headers.set("Set-Cookie", createClearCookie());

      return response;
    }

    // GET /api/auth/me
    if (path === "/api/auth/me" && request.method === "GET") {
      const user = await getUserFromRequest(request, env);

      if (!user) {
        return errorResponse("Not authenticated", 401);
      }

      // Return user data (without password_hash)
      const { password_hash, ...userData } = user;

      return successResponse(userData);
    }

    // Route not found in auth module
    return errorResponse(`Auth route not found: ${path}`, 404);
  } catch (error) {
    console.error("Auth error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Authentication error",
      500
    );
  }
}

// Export helper for other modules to verify authentication
export { getUserFromRequest };
