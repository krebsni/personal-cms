// Integration tests for Files API
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse, testUsers, testFiles } from "../helpers/test-utils";

describe("Files API", () => {
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    // Apply migrations using batch
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
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          path TEXT UNIQUE NOT NULL,
          owner_id TEXT NOT NULL,
          content_r2_key TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS permissions (
          id TEXT PRIMARY KEY,
          file_id TEXT NOT NULL,
          user_id TEXT,
          permission TEXT NOT NULL CHECK(permission IN ('read', 'write')),
          created_at INTEGER NOT NULL,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    ]);

    // Register and login a test user
    const registerRequest = createTestRequest("POST", "/api/auth/register", {
      body: {
        username: "fileuser",
        email: "fileuser@test.com",
        password: "password123",
      },
    });

    const registerResponse = await SELF.fetch(registerRequest);
    const registerData = await getResponseJson(registerResponse);
    userId = registerData.data.id;

    const loginRequest = createTestRequest("POST", "/api/auth/login", {
      body: {
        email: "fileuser@test.com",
        password: "password123",
      },
    });

    const loginResponse = await SELF.fetch(loginRequest);
    const cookies = getCookiesFromResponse(loginResponse);
    userToken = cookies.token;
  });

  describe("POST /api/files", () => {
    it("should upload a file successfully (JSON)", async () => {
      const request = createTestRequest("POST", "/api/files", {
        body: {
          path: testFiles.markdown.path,
          content: testFiles.markdown.content,
        },
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.path).toBe(testFiles.markdown.path);
      expect(data.data.size).toBe(testFiles.markdown.content.length);
      expect(data.data.ownerId).toBe(userId);
      expect(data.message).toContain("uploaded");
    });

    it("should reject upload without authentication", async () => {
      const request = createTestRequest("POST", "/api/files", {
        body: {
          path: "/test/noauth.md",
          content: "Unauthorized content",
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });

    it("should reject duplicate file paths", async () => {
      // First upload
      const request1 = createTestRequest("POST", "/api/files", {
        body: {
          path: "/test/duplicate.md",
          content: "First upload",
        },
        cookies: { token: userToken },
      });
      await SELF.fetch(request1);

      // Try to upload again with same path
      const request2 = createTestRequest("POST", "/api/files", {
        body: {
          path: "/test/duplicate.md",
          content: "Second upload",
        },
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request2);
      const data = await getResponseJson(response);

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain("already exists");
    });
  });

  describe("GET /api/files", () => {
    it("should list user's files", async () => {
      // Upload a file first to ensure list is not empty
      await SELF.fetch(createTestRequest("POST", "/api/files", {
        body: {
          path: "/test/list-file.md",
          content: "File for list test",
        },
        cookies: { token: userToken },
      }));

      const request = createTestRequest("GET", "/api/files", {
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0]).toHaveProperty("id");
      expect(data.data[0]).toHaveProperty("path");
      expect(data.data[0]).toHaveProperty("ownerId");
    });

    it("should return empty array for anonymous users", async () => {
      const request = createTestRequest("GET", "/api/files");
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });
  });

  describe("GET /api/files/:path", () => {
    it("should get file metadata and content", async () => {
      // First create a file
      const uploadRequest = createTestRequest("POST", "/api/files", {
        body: {
          path: "/test/getfile.md",
          content: "File content for GET test",
        },
        cookies: { token: userToken },
      });
      await SELF.fetch(uploadRequest);

      // Then get it
      const encodedPath = encodeURIComponent("/test/getfile.md");
      const request = createTestRequest("GET", `/api/files/${encodedPath}`, {
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.metadata.path).toBe("/test/getfile.md");
      expect(data.data.content).toBe("File content for GET test");
    });

    it("should reject access to non-existent file", async () => {
      const request = createTestRequest("GET", "/api/files/%2Fnonexistent.md", {
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });
  });

  describe("PUT /api/files/:path", () => {
    it("should update file content", async () => {
      // First create a file
      const uploadRequest = createTestRequest("POST", "/api/files", {
        body: {
          path: "/test/updatefile.md",
          content: "Original content",
        },
        cookies: { token: userToken },
      });
      await SELF.fetch(uploadRequest);

      // Then update it
      const newContent = "Updated content with more text";
      const encodedPath = encodeURIComponent("/test/updatefile.md");
      const request = createTestRequest("PUT", `/api/files/${encodedPath}`, {
        body: { content: newContent },
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.size).toBe(newContent.length);
      expect(data.message).toContain("updated");
    });

    it("should reject update without authentication", async () => {
      const encodedPath = encodeURIComponent("/test/updatefile.md");
      const request = createTestRequest("PUT", `/api/files/${encodedPath}`, {
        body: { content: "Unauthorized update" },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe("DELETE /api/files/:path", () => {
    it("should delete file successfully", async () => {
      // First create a file
      const uploadRequest = createTestRequest("POST", "/api/files", {
        body: {
          path: "/test/deletefile.md",
          content: "File to be deleted",
        },
        cookies: { token: userToken },
      });
      await SELF.fetch(uploadRequest);

      // Then delete it
      const encodedPath = encodeURIComponent("/test/deletefile.md");
      const request = createTestRequest("DELETE", `/api/files/${encodedPath}`, {
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("deleted");
    });

    it("should return 404 when deleting non-existent file", async () => {
      const request = createTestRequest("DELETE", "/api/files/%2Fnonexistent.md", {
        cookies: { token: userToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });
  });
});
