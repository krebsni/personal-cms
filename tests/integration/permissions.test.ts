// Integration tests for Permissions API
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse } from "../helpers/test-utils";

describe("Permissions API", () => {
  let ownerToken: string;
  let ownerId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let testFileId: string;

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
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )
      `),
    ]);

    // Register owner user
    const ownerRegister = createTestRequest("POST", "/api/auth/register", {
      body: { username: "owner", email: "owner@test.com", password: "password123" },
    });
    const ownerRegResponse = await SELF.fetch(ownerRegister);
    const ownerData = await getResponseJson(ownerRegResponse);
    ownerId = ownerData.data.id;

    const ownerLogin = createTestRequest("POST", "/api/auth/login", {
      body: { email: "owner@test.com", password: "password123" },
    });
    const ownerLoginResponse = await SELF.fetch(ownerLogin);
    const ownerCookies = getCookiesFromResponse(ownerLoginResponse);
    ownerToken = ownerCookies.token;

    // Register other user
    const otherRegister = createTestRequest("POST", "/api/auth/register", {
      body: { username: "other", email: "other@test.com", password: "password123" },
    });
    const otherRegResponse = await SELF.fetch(otherRegister);
    const otherData = await getResponseJson(otherRegResponse);
    otherUserId = otherData.data.id;

    const otherLogin = createTestRequest("POST", "/api/auth/login", {
      body: { email: "other@test.com", password: "password123" },
    });
    const otherLoginResponse = await SELF.fetch(otherLogin);
    const otherCookies = getCookiesFromResponse(otherLoginResponse);
    otherUserToken = otherCookies.token;

    // Create a test file
    const fileRequest = createTestRequest("POST", "/api/files", {
      body: { path: "/test/permissions.md", content: "Test file for permissions" },
      cookies: { token: ownerToken },
    });
    const fileResponse = await SELF.fetch(fileRequest);
    const fileData = await getResponseJson(fileResponse);
    testFileId = fileData.data.id;
  });

  afterEach(async () => {
    // Clean up created permissions and files after each test
    await env.DB.prepare("DELETE FROM permissions").run();
    await env.DB.prepare("DELETE FROM files").run();
  });


  describe("POST /api/permissions/file/:fileId", () => {
    it("should grant read permission to specific user", async () => {
      const request = createTestRequest("POST", `/api/permissions/file/${testFileId}`, {
        body: { userId: otherUserId, permission: "read" },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.fileId).toBe(testFileId);
      expect(data.data.userId).toBe(otherUserId);
      expect(data.data.permission).toBe("read");
      expect(data.message).toContain("granted");
    });

    it("should reject permission grant from non-owner", async () => {
      const request = createTestRequest("POST", `/api/permissions/file/${testFileId}`, {
        body: { userId: ownerId, permission: "read" },
        cookies: { token: otherUserToken }, // Non-owner trying to grant
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Only file owner can grant permissions");
    });

    it("should reject invalid permission type", async () => {
      const request = createTestRequest("POST", `/api/permissions/file/${testFileId}`, {
        body: { userId: otherUserId, permission: "invalid" },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid permission type");
    });

    it("should update existing permission", async () => {
      // Create a new file for this test
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/update-perm.md", content: "Test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      // First grant read
      const grant1 = createTestRequest("POST", `/api/permissions/file/${fileId}`, {
        body: { userId: otherUserId, permission: "read" },
        cookies: { token: ownerToken },
      });
      await SELF.fetch(grant1);

      // Then upgrade to write
      const grant2 = createTestRequest("POST", `/api/permissions/file/${fileId}`, {
        body: { userId: otherUserId, permission: "write" },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(grant2);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.permission).toBe("write");
      expect(data.message).toContain("updated");
    });
  });

  describe("GET /api/permissions/file/:fileId", () => {
    it("should list all permissions for file owner", async () => {
      // Create file and grant permission
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/list-perms.md", content: "Test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      // Grant a permission
      await SELF.fetch(
        createTestRequest("POST", `/api/permissions/file/${fileId}`, {
          body: { userId: otherUserId, permission: "read" },
          cookies: { token: ownerToken },
        })
      );

      // Now list permissions
      const request = createTestRequest("GET", `/api/permissions/file/${fileId}`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it("should reject permission list from non-owner", async () => {
      const request = createTestRequest("GET", `/api/permissions/file/${testFileId}`, {
        cookies: { token: otherUserToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/permissions/file/:fileId/public", () => {
    it("should make file public", async () => {
      // Create a new file for this test
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/public.md", content: "Public file" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      // Make it public
      const request = createTestRequest("POST", `/api/permissions/file/${fileId}/public`, {
        body: { permission: "read" },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("public");
    });

    it("should reject making file public by non-owner", async () => {
      const request = createTestRequest("POST", `/api/permissions/file/${testFileId}/public`, {
        body: { permission: "read" },
        cookies: { token: otherUserToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe("DELETE /api/permissions/file/:fileId/public", () => {
    it("should make file private", async () => {
      // Create and make file public first
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/makeprivate.md", content: "File to make private" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const makePublicResp = await SELF.fetch(
        createTestRequest("POST", `/api/permissions/file/${fileId}/public`, {
          body: { permission: "read" },
          cookies: { token: ownerToken },
        })
      );
      const makePublicData = await getResponseJson(makePublicResp);

      // Verify it was made public
      expect(makePublicResp.status).toBe(200);
      expect(makePublicData.success).toBe(true);

      // Now make it private
      const request = createTestRequest("DELETE", `/api/permissions/file/${fileId}/public`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("private");
    });

    it("should return 404 if file is not public", async () => {
      // Create a private file
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/already-private.md", content: "Private file" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      // Try to make it private (it's already private)
      const request = createTestRequest("DELETE", `/api/permissions/file/${fileId}/public`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      // Accept either error message
      expect(data.error).toMatch(/not public|Permission not found/);
    });
  });

  describe("DELETE /api/permissions/file/:fileId/:permissionId", () => {
    it("should revoke permission", async () => {
      // Create file and grant permission
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/revoke.md", content: "File for revoke test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const grantResp = await SELF.fetch(
        createTestRequest("POST", `/api/permissions/file/${fileId}`, {
          body: { userId: otherUserId, permission: "read" },
          cookies: { token: ownerToken },
        })
      );
      const grantData = await getResponseJson(grantResp);
      const permissionId = grantData.data.id;

      // Revoke permission
      const request = createTestRequest("DELETE", `/api/permissions/file/${fileId}/${permissionId}`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("revoked");
    });

    it("should return 404 for non-existent permission", async () => {
      const request = createTestRequest("DELETE", `/api/permissions/file/${testFileId}/nonexistent`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });
});
