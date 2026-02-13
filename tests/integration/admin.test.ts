// Integration tests for Admin API
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse } from "../helpers/test-utils";

describe("Admin API", () => {
  let adminToken: string;
  let adminId: string;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    // Apply migrations
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
          token_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS highlight_colors (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          hex_code TEXT NOT NULL,
          is_default INTEGER NOT NULL DEFAULT 0,
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `),
    ]);

    // Register admin user
    const adminRegister = createTestRequest("POST", "/api/auth/register", {
      body: { username: "testadmin", email: "admin@test.com", password: "password123" },
    });
    const adminRegResponse = await SELF.fetch(adminRegister);
    const adminData = await getResponseJson(adminRegResponse);
    adminId = adminData.data.id;

    // Manually update user to admin role
    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?")
      .bind(adminId)
      .run();

    const adminLogin = createTestRequest("POST", "/api/auth/login", {
      body: { email: "admin@test.com", password: "password123" },
    });
    const adminLoginResponse = await SELF.fetch(adminLogin);
    const adminCookies = getCookiesFromResponse(adminLoginResponse);
    adminToken = adminCookies.token;

    // Register regular user
    const userRegister = createTestRequest("POST", "/api/auth/register", {
      body: { username: "testuser", email: "user@test.com", password: "password123" },
    });
    const userRegResponse = await SELF.fetch(userRegister);
    const userData = await getResponseJson(userRegResponse);
    userId = userData.data.id;

    const userLogin = createTestRequest("POST", "/api/auth/login", {
      body: { email: "user@test.com", password: "password123" },
    });
    const userLoginResponse = await SELF.fetch(userLogin);
    const userCookies = getCookiesFromResponse(userLoginResponse);
    userToken = userCookies.token;
  });

  describe("User Management", () => {
    describe("GET /api/admin/users", () => {
      it("should list all users for admin", async () => {
        const request = createTestRequest("GET", "/api/admin/users", {
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
        expect(data.data.length).toBeGreaterThanOrEqual(2); // At least admin and user
        expect(data.data[0]).toHaveProperty("id");
        expect(data.data[0]).toHaveProperty("username");
        expect(data.data[0]).toHaveProperty("email");
        expect(data.data[0]).toHaveProperty("role");
        expect(data.data[0]).not.toHaveProperty("password_hash");
      });

      it("should reject non-admin user", async () => {
        const request = createTestRequest("GET", "/api/admin/users", {
          cookies: { token: userToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Admin access required");
      });

      it("should reject unauthenticated request", async () => {
        const request = createTestRequest("GET", "/api/admin/users", {});

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Authentication required");
      });
    });

    describe("POST /api/admin/users", () => {
      it("should create new user as admin", async () => {
        const request = createTestRequest("POST", "/api/admin/users", {
          body: {
            username: "newuser",
            email: "newuser@test.com",
            password: "password123",
            role: "user",
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.username).toBe("newuser");
        expect(data.data.email).toBe("newuser@test.com");
        expect(data.data.role).toBe("user");
        expect(data.message).toContain("created");
      });

      it("should create admin user", async () => {
        const request = createTestRequest("POST", "/api/admin/users", {
          body: {
            username: "newadmin",
            email: "newadmin@test.com",
            password: "password123",
            role: "admin",
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.role).toBe("admin");
      });

      it("should reject duplicate username", async () => {
        const request = createTestRequest("POST", "/api/admin/users", {
          body: {
            username: "testuser", // Already exists
            email: "different@test.com",
            password: "password123",
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(409);
        expect(data.success).toBe(false);
        expect(data.error).toContain("already exists");
      });

      it("should reject duplicate email", async () => {
        const request = createTestRequest("POST", "/api/admin/users", {
          body: {
            username: "differentuser",
            email: "user@test.com", // Already exists
            password: "password123",
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(409);
        expect(data.success).toBe(false);
        expect(data.error).toContain("already exists");
      });

      it("should reject short password", async () => {
        const request = createTestRequest("POST", "/api/admin/users", {
          body: {
            username: "shortpass",
            email: "shortpass@test.com",
            password: "short",
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("at least 8 characters");
      });

      it("should reject non-admin", async () => {
        const request = createTestRequest("POST", "/api/admin/users", {
          body: {
            username: "unauthorized",
            email: "unauthorized@test.com",
            password: "password123",
          },
          cookies: { token: userToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
      });
    });

    describe("PUT /api/admin/users/:id", () => {
      it("should update user role", async () => {
        // Create a user to update
        const createResp = await SELF.fetch(
          createTestRequest("POST", "/api/admin/users", {
            body: {
              username: "roletest",
              email: "roletest@test.com",
              password: "password123",
            },
            cookies: { token: adminToken },
          })
        );
        const createData = await getResponseJson(createResp);
        const testUserId = createData.data.id;

        // Update role to admin
        const request = createTestRequest("PUT", `/api/admin/users/${testUserId}`, {
          body: { role: "admin" },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.role).toBe("admin");
        expect(data.message).toContain("updated");
      });

      it("should update username", async () => {
        // Create a user to update
        const createResp = await SELF.fetch(
          createTestRequest("POST", "/api/admin/users", {
            body: {
              username: "oldname",
              email: "oldname@test.com",
              password: "password123",
            },
            cookies: { token: adminToken },
          })
        );
        const createData = await getResponseJson(createResp);
        const testUserId = createData.data.id;

        // Update username
        const request = createTestRequest("PUT", `/api/admin/users/${testUserId}`, {
          body: { username: "newname" },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.username).toBe("newname");
      });

      it("should return 404 for non-existent user", async () => {
        const request = createTestRequest("PUT", "/api/admin/users/nonexistent-id", {
          body: { role: "admin" },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error).toContain("not found");
      });
    });

    describe("DELETE /api/admin/users/:id", () => {
      it("should delete user", async () => {
        // Create a user to delete
        const createResp = await SELF.fetch(
          createTestRequest("POST", "/api/admin/users", {
            body: {
              username: "todelete",
              email: "todelete@test.com",
              password: "password123",
            },
            cookies: { token: adminToken },
          })
        );
        const createData = await getResponseJson(createResp);
        const testUserId = createData.data.id;

        // Delete user
        const request = createTestRequest("DELETE", `/api/admin/users/${testUserId}`, {
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain("deleted");
      });

      it("should prevent admin from deleting themselves", async () => {
        const request = createTestRequest("DELETE", `/api/admin/users/${adminId}`, {
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Cannot delete your own account");
      });

      it("should return 404 for non-existent user", async () => {
        const request = createTestRequest("DELETE", "/api/admin/users/nonexistent-id", {
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });
    });
  });

  describe("Color Palette Management", () => {
    describe("GET /api/admin/colors", () => {
      it("should list all colors", async () => {
        const request = createTestRequest("GET", "/api/admin/colors", {
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it("should reject non-admin", async () => {
        const request = createTestRequest("GET", "/api/admin/colors", {
          cookies: { token: userToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
      });
    });

    describe("POST /api/admin/colors", () => {
      it("should create color", async () => {
        const request = createTestRequest("POST", "/api/admin/colors", {
          body: {
            name: "Yellow",
            hexCode: "#FFFF00",
            isDefault: true,
            displayOrder: 1,
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.name).toBe("Yellow");
        expect(data.data.hexCode).toBe("#FFFF00");
        expect(data.data.isDefault).toBe(true);
        expect(data.data.displayOrder).toBe(1);
        expect(data.message).toContain("added");
      });

      it("should reject invalid hex code", async () => {
        const request = createTestRequest("POST", "/api/admin/colors", {
          body: {
            name: "Invalid",
            hexCode: "FFFF00", // Missing #
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Invalid hex code");
      });

      it("should reject duplicate color name", async () => {
        // Create first color
        await SELF.fetch(
          createTestRequest("POST", "/api/admin/colors", {
            body: { name: "Red", hexCode: "#FF0000" },
            cookies: { token: adminToken },
          })
        );

        // Try to create duplicate
        const request = createTestRequest("POST", "/api/admin/colors", {
          body: { name: "Red", hexCode: "#FF0001" },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(409);
        expect(data.success).toBe(false);
        expect(data.error).toContain("already exists");
      });
    });

    describe("PUT /api/admin/colors/:id", () => {
      it("should update color", async () => {
        // Create a color to update
        const createResp = await SELF.fetch(
          createTestRequest("POST", "/api/admin/colors", {
            body: { name: "Green", hexCode: "#00FF00" },
            cookies: { token: adminToken },
          })
        );
        const createData = await getResponseJson(createResp);
        const colorId = createData.data.id;

        // Update color
        const request = createTestRequest("PUT", `/api/admin/colors/${colorId}`, {
          body: {
            name: "Dark Green",
            hexCode: "#008000",
            displayOrder: 5,
          },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.name).toBe("Dark Green");
        expect(data.data.hexCode).toBe("#008000");
        expect(data.data.displayOrder).toBe(5);
      });

      it("should return 404 for non-existent color", async () => {
        const request = createTestRequest("PUT", "/api/admin/colors/nonexistent-id", {
          body: { name: "Test" },
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });
    });

    describe("DELETE /api/admin/colors/:id", () => {
      it("should delete color", async () => {
        // Create a color to delete
        const createResp = await SELF.fetch(
          createTestRequest("POST", "/api/admin/colors", {
            body: { name: "ToDelete", hexCode: "#123456" },
            cookies: { token: adminToken },
          })
        );
        const createData = await getResponseJson(createResp);
        const colorId = createData.data.id;

        // Delete color
        const request = createTestRequest("DELETE", `/api/admin/colors/${colorId}`, {
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain("deleted");
      });

      it("should return 404 for non-existent color", async () => {
        const request = createTestRequest("DELETE", "/api/admin/colors/nonexistent-id", {
          cookies: { token: adminToken },
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
      });
    });
  });
});
