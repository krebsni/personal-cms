// Integration tests for Authentication API
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse, testUsers } from "../helpers/test-utils";
import bcrypt from "bcryptjs";

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID();
}

describe("Authentication API", () => {
  beforeAll(async () => {
    // Apply migrations to create tables
    await env.DB.batch([
        env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `),
        env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `),
        // Clear tables before seeding
        env.DB.prepare(`DELETE FROM sessions`),
        env.DB.prepare(`DELETE FROM users`),
    ]);

    // Seed the database with test users
    const now = Math.floor(Date.now() / 1000);
    
    // Admin user
    const adminId = generateId();
    const adminPasswordHash = await bcrypt.hash(testUsers.admin.password, 10);
    await env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(adminId, testUsers.admin.username, testUsers.admin.email, adminPasswordHash, "admin", now, now)
      .run();

    // Regular user
    const userId = generateId();
    const userPasswordHash = await bcrypt.hash(testUsers.user.password, 10);
    await env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(userId, testUsers.user.username, testUsers.user.email, userPasswordHash, "user", now, now)
      .run();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const newUser = {
          username: "new-user-register",
          email: "new-user-register@test.com",
          password: "password123"
      };
      const request = createTestRequest("POST", "/api/auth/register", {
        body: newUser,
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.username).toBe(newUser.username);
      expect(data.data.email).toBe(newUser.email);
      expect(data.data.role).toBe("user");
      expect(data.data).not.toHaveProperty("password_hash");

      // Check cookie was set
      const cookies = getCookiesFromResponse(response);
      expect(cookies.token).toBeDefined();
    });

    it("should reject registration with duplicate email", async () => {
      const request = createTestRequest("POST", "/api/auth/register", {
        body: {
          username: "anotheruser",
          email: testUsers.user.email, // Same email as seeded user
          password: "password123",
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);
      
      expect(response.status).toBe(409); 
      expect(data.success).toBe(false);
      expect(data.error).toContain("already exists");
    });

    it("should reject registration with short password", async () => {
      const request = createTestRequest("POST", "/api/auth/register", {
        body: {
          username: "newuser-shortpass",
          email: "new-shortpass@test.com",
          password: "short",
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("at least 8 characters");
    });

    it("should reject registration with missing fields", async () => {
      const request = createTestRequest("POST", "/api/auth/register", {
        body: {
          username: "incomplete",
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with correct credentials", async () => {
      const request = createTestRequest("POST", "/api/auth/login", {
        body: {
          email: testUsers.user.email,
          password: testUsers.user.password,
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(testUsers.user.email);
      expect(data.message).toBe("Login successful");

      const cookies = getCookiesFromResponse(response);
      expect(cookies.token).toBeDefined();
    });

    it("should reject login with wrong password", async () => {
      const request = createTestRequest("POST", "/api/auth/login", {
        body: {
          email: testUsers.user.email,
          password: "wrongpassword",
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid email or password");
    });

    it("should reject login with non-existent email", async () => {
      const request = createTestRequest("POST", "/api/auth/login", {
        body: {
          email: "nonexistent@test.com",
          password: "password123",
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid email or password");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user when authenticated", async () => {
      // Login first
      const loginRequest = createTestRequest("POST", "/api/auth/login", {
        body: {
          email: testUsers.user.email,
          password: testUsers.user.password,
        },
      });

      const loginResponse = await SELF.fetch(loginRequest);
      const cookies = getCookiesFromResponse(loginResponse);
      
      expect(loginResponse.status).toBe(200);

      // Get current user
      const request = createTestRequest("GET", "/api/auth/me", {
        cookies,
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(testUsers.user.email);
    });

    it("should reject when not authenticated", async () => {
      const request = createTestRequest("GET", "/api/auth/me");
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Not authenticated");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully and clear cookie", async () => {
      // Login first
      const loginRequest = createTestRequest("POST", "/api/auth/login", {
        body: {
          email: testUsers.user.email,
          password: testUsers.user.password,
        },
      });

      const loginResponse = await SELF.fetch(loginRequest);
      const loginCookies = getCookiesFromResponse(loginResponse);
      expect(loginResponse.status).toBe(200);

      // Logout
      const logoutRequest = createTestRequest("POST", "/api/auth/logout", {
        cookies: loginCookies,
      });

      const logoutResponse = await SELF.fetch(logoutRequest);
      const data = await getResponseJson(logoutResponse);

      expect(logoutResponse.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("Logged out");

      // Check cookie was cleared (Max-Age=0)
      const setCookie = logoutResponse.headers.get("Set-Cookie");
      expect(setCookie).toContain("Max-Age=0");

      // Verify can't access /api/auth/me anymore
      const meRequest = createTestRequest("GET", "/api/auth/me", {
        cookies: loginCookies, // Send the old, now invalid, token
      });

      const meResponse = await SELF.fetch(meRequest);
      const meData = await getResponseJson(meResponse);

      expect(meResponse.status).toBe(401);
      expect(meData.success).toBe(false);
    });
  });
});
