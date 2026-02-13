// Integration tests for Highlights API
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse } from "../helpers/test-utils";

describe("Highlights API", () => {
  let ownerToken: string;
  let ownerId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let testFileId: string;
  let testFileContent: string;

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
        CREATE TABLE IF NOT EXISTS highlights (
          id TEXT PRIMARY KEY,
          file_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          start_offset INTEGER NOT NULL,
          end_offset INTEGER NOT NULL,
          color TEXT NOT NULL,
          text_snapshot TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
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

    // Register owner user
    const ownerRegister = createTestRequest("POST", "/api/auth/register", {
      body: { username: "highlightowner", email: "highlightowner@test.com", password: "password123" },
    });
    const ownerRegResponse = await SELF.fetch(ownerRegister);
    const ownerData = await getResponseJson(ownerRegResponse);
    ownerId = ownerData.data.id;

    const ownerLogin = createTestRequest("POST", "/api/auth/login", {
      body: { email: "highlightowner@test.com", password: "password123" },
    });
    const ownerLoginResponse = await SELF.fetch(ownerLogin);
    const ownerCookies = getCookiesFromResponse(ownerLoginResponse);
    ownerToken = ownerCookies.token;

    // Register other user
    const otherRegister = createTestRequest("POST", "/api/auth/register", {
      body: { username: "highlightother", email: "highlightother@test.com", password: "password123" },
    });
    const otherRegResponse = await SELF.fetch(otherRegister);
    const otherData = await getResponseJson(otherRegResponse);
    otherUserId = otherData.data.id;

    const otherLogin = createTestRequest("POST", "/api/auth/login", {
      body: { email: "highlightother@test.com", password: "password123" },
    });
    const otherLoginResponse = await SELF.fetch(otherLogin);
    const otherCookies = getCookiesFromResponse(otherLoginResponse);
    otherUserToken = otherCookies.token;

    // Create a test file with content for highlighting
    testFileContent = "# Test Document\n\nThis is a test document for highlighting.\nIt has multiple lines and paragraphs.\n\n## Section 1\n\nSome content here that can be highlighted.";
    const fileRequest = createTestRequest("POST", "/api/files", {
      body: { path: "/test/highlights-doc.md", content: testFileContent },
      cookies: { token: ownerToken },
    });
    const fileResponse = await SELF.fetch(fileRequest);
    const fileData = await getResponseJson(fileResponse);
    testFileId = fileData.data.id;
  });

  describe("POST /api/highlights", () => {
    it("should create highlight with valid data", async () => {
      const request = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId: testFileId,
          startOffset: 0,
          endOffset: 15,
          color: "#ffff00",
          textSnapshot: "# Test Document",
        },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.fileId).toBe(testFileId);
      expect(data.data.userId).toBe(ownerId);
      expect(data.data.startOffset).toBe(0);
      expect(data.data.endOffset).toBe(15);
      expect(data.data.color).toBe("#ffff00");
      expect(data.data.textSnapshot).toBe("# Test Document");
      expect(data.message).toContain("created");
    });

    it("should reject highlight without authentication", async () => {
      const request = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId: testFileId,
          startOffset: 0,
          endOffset: 10,
          color: "#ffff00",
          textSnapshot: "Test",
        },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });

    it("should reject highlight if user has no read permission", async () => {
      // Create a private file
      const privateFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/private-highlight.md", content: "Private content" },
        cookies: { token: ownerToken },
      });
      const privateFileResp = await SELF.fetch(privateFile);
      const privateFileData = await getResponseJson(privateFileResp);
      const privateFileId = privateFileData.data.id;

      // Other user tries to highlight without permission
      const request = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId: privateFileId,
          startOffset: 0,
          endOffset: 7,
          color: "#ffff00",
          textSnapshot: "Private",
        },
        cookies: { token: otherUserToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Access denied");
    });

    it("should reject with invalid offset range (negative start)", async () => {
      const request = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId: testFileId,
          startOffset: -1,
          endOffset: 10,
          color: "#ffff00",
          textSnapshot: "Test",
        },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid offset range");
    });

    it("should reject with invalid offset range (end <= start)", async () => {
      const request = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId: testFileId,
          startOffset: 10,
          endOffset: 10,
          color: "#ffff00",
          textSnapshot: "Test", // Need valid text for validation to reach offset check
        },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid offset range");
    });

    it("should reject with missing required fields", async () => {
      const request = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId: testFileId,
          startOffset: 0,
          // Missing endOffset, color, textSnapshot
        },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("GET /api/highlights/file/:fileId", () => {
    it("should return highlights for file with read access", async () => {
      // Create a new file and add highlights
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/get-highlights.md", content: "Content for getting highlights test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      // Create two highlights
      await SELF.fetch(
        createTestRequest("POST", "/api/highlights", {
          body: {
            fileId,
            startOffset: 0,
            endOffset: 7,
            color: "#ffff00",
            textSnapshot: "Content",
          },
          cookies: { token: ownerToken },
        })
      );

      await SELF.fetch(
        createTestRequest("POST", "/api/highlights", {
          body: {
            fileId,
            startOffset: 12,
            endOffset: 19,
            color: "#00ff00",
            textSnapshot: "getting",
          },
          cookies: { token: ownerToken },
        })
      );

      // Get highlights
      const request = createTestRequest("GET", `/api/highlights/file/${fileId}`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(2);
      expect(data.data[0].startOffset).toBeLessThan(data.data[1].startOffset); // Ordered by offset
    });

    it("should return empty array for file with no highlights", async () => {
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/no-highlights.md", content: "No highlights here" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const request = createTestRequest("GET", `/api/highlights/file/${fileId}`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });

    it("should reject if user has no permission to file", async () => {
      // Create private file
      const privateFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/no-access-highlights.md", content: "Private file" },
        cookies: { token: ownerToken },
      });
      const privateFileResp = await SELF.fetch(privateFile);
      const privateFileData = await getResponseJson(privateFileResp);
      const fileId = privateFileData.data.id;

      // Other user tries to get highlights
      const request = createTestRequest("GET", `/api/highlights/file/${fileId}`, {
        cookies: { token: otherUserToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Access denied");
    });

    it("should only return user's own highlights (not other users')", async () => {
      // Create file and grant read permission to other user
      const sharedFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/shared-highlights.md", content: "Shared file for highlights" },
        cookies: { token: ownerToken },
      });
      const sharedFileResp = await SELF.fetch(sharedFile);
      const sharedFileData = await getResponseJson(sharedFileResp);
      const fileId = sharedFileData.data.id;

      // Grant read permission to other user
      await SELF.fetch(
        createTestRequest("POST", `/api/permissions/file/${fileId}`, {
          body: { userId: otherUserId, permission: "read" },
          cookies: { token: ownerToken },
        })
      );

      // Owner creates highlight
      await SELF.fetch(
        createTestRequest("POST", "/api/highlights", {
          body: {
            fileId,
            startOffset: 0,
            endOffset: 6,
            color: "#ffff00",
            textSnapshot: "Shared",
          },
          cookies: { token: ownerToken },
        })
      );

      // Other user creates highlight
      await SELF.fetch(
        createTestRequest("POST", "/api/highlights", {
          body: {
            fileId,
            startOffset: 7,
            endOffset: 11,
            color: "#00ff00",
            textSnapshot: "file",
          },
          cookies: { token: otherUserToken },
        })
      );

      // Other user gets highlights - should only see their own
      const request = createTestRequest("GET", `/api/highlights/file/${fileId}`, {
        cookies: { token: otherUserToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].userId).toBe(otherUserId);
      expect(data.data[0].textSnapshot).toBe("file");
    });
  });

  describe("PUT /api/highlights/:id", () => {
    it("should update highlight color", async () => {
      // Create file and highlight
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/update-color.md", content: "Update color test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const createHighlight = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId,
          startOffset: 0,
          endOffset: 6,
          color: "#ffff00",
          textSnapshot: "Update",
        },
        cookies: { token: ownerToken },
      });
      const createResp = await SELF.fetch(createHighlight);
      const createData = await getResponseJson(createResp);
      const highlightId = createData.data.id;

      // Update color
      const request = createTestRequest("PUT", `/api/highlights/${highlightId}`, {
        body: { color: "#ff0000" },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.color).toBe("#ff0000");
      expect(data.data.startOffset).toBe(0);
      expect(data.data.endOffset).toBe(6);
      expect(data.message).toContain("updated");
    });

    it("should update highlight offsets", async () => {
      // Create file and highlight
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/update-offsets.md", content: "Update offsets test content" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const createHighlight = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId,
          startOffset: 0,
          endOffset: 6,
          color: "#ffff00",
          textSnapshot: "Update",
        },
        cookies: { token: ownerToken },
      });
      const createResp = await SELF.fetch(createHighlight);
      const createData = await getResponseJson(createResp);
      const highlightId = createData.data.id;

      // Update offsets
      const request = createTestRequest("PUT", `/api/highlights/${highlightId}`, {
        body: {
          startOffset: 7,
          endOffset: 14,
          textSnapshot: "offsets",
        },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.startOffset).toBe(7);
      expect(data.data.endOffset).toBe(14);
      expect(data.data.textSnapshot).toBe("offsets");
    });

    it("should reject update if not owner", async () => {
      // Owner creates file and highlight
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/update-not-owner.md", content: "Not owner test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const createHighlight = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId,
          startOffset: 0,
          endOffset: 3,
          color: "#ffff00",
          textSnapshot: "Not",
        },
        cookies: { token: ownerToken },
      });
      const createResp = await SELF.fetch(createHighlight);
      const createData = await getResponseJson(createResp);
      const highlightId = createData.data.id;

      // Other user tries to update
      const request = createTestRequest("PUT", `/api/highlights/${highlightId}`, {
        body: { color: "#ff0000" },
        cookies: { token: otherUserToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("owner");
    });

    it("should reject with invalid offset range", async () => {
      // Create file and highlight
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/update-invalid-offset.md", content: "Invalid offset test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const createHighlight = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId,
          startOffset: 0,
          endOffset: 7,
          color: "#ffff00",
          textSnapshot: "Invalid",
        },
        cookies: { token: ownerToken },
      });
      const createResp = await SELF.fetch(createHighlight);
      const createData = await getResponseJson(createResp);
      const highlightId = createData.data.id;

      // Try to update with invalid range
      const request = createTestRequest("PUT", `/api/highlights/${highlightId}`, {
        body: {
          startOffset: 10,
          endOffset: 5, // end < start
        },
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid offset range");
    });
  });

  describe("DELETE /api/highlights/:id", () => {
    it("should delete own highlight", async () => {
      // Create file and highlight
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/delete-highlight.md", content: "Delete test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const createHighlight = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId,
          startOffset: 0,
          endOffset: 6,
          color: "#ffff00",
          textSnapshot: "Delete",
        },
        cookies: { token: ownerToken },
      });
      const createResp = await SELF.fetch(createHighlight);
      const createData = await getResponseJson(createResp);
      const highlightId = createData.data.id;

      // Delete highlight
      const request = createTestRequest("DELETE", `/api/highlights/${highlightId}`, {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("deleted");
    });

    it("should reject delete if not owner", async () => {
      // Owner creates file and highlight
      const newFile = createTestRequest("POST", "/api/files", {
        body: { path: "/test/delete-not-owner.md", content: "Delete not owner test" },
        cookies: { token: ownerToken },
      });
      const newFileResp = await SELF.fetch(newFile);
      const newFileData = await getResponseJson(newFileResp);
      const fileId = newFileData.data.id;

      const createHighlight = createTestRequest("POST", "/api/highlights", {
        body: {
          fileId,
          startOffset: 0,
          endOffset: 6,
          color: "#ffff00",
          textSnapshot: "Delete",
        },
        cookies: { token: ownerToken },
      });
      const createResp = await SELF.fetch(createHighlight);
      const createData = await getResponseJson(createResp);
      const highlightId = createData.data.id;

      // Other user tries to delete
      const request = createTestRequest("DELETE", `/api/highlights/${highlightId}`, {
        cookies: { token: otherUserToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("owner");
    });

    it("should return 404 for non-existent highlight", async () => {
      const request = createTestRequest("DELETE", "/api/highlights/nonexistent-id", {
        cookies: { token: ownerToken },
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });
  });
});
