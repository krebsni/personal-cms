// Integration tests for Collaboration and Highlights API features
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse } from "../helpers/test-utils";

describe("Phase 4: Collaboration & Highlights API", () => {
  let ownerToken: string;
  let ownerId: string;
  let editorToken: string;
  let editorId: string;
  let repoId: string;
  let fileId: string;
  let highlightId: string;

  beforeAll(async () => {
    // Setup tables inside cloudflare:test environment
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
        CREATE TABLE IF NOT EXISTS repositories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          path TEXT UNIQUE NOT NULL,
          owner_id TEXT NOT NULL,
          parent_id TEXT,
          repository_id TEXT,
          is_public INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          path TEXT UNIQUE NOT NULL,
          owner_id TEXT NOT NULL,
          parent_id TEXT,
          repository_id TEXT,
          is_public INTEGER NOT NULL DEFAULT 0,
          content_r2_key TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS assignments (
          id TEXT PRIMARY KEY,
          resource_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('viewer', 'editor')),
          created_at INTEGER NOT NULL,
          UNIQUE(user_id, resource_id)
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
          updated_at INTEGER NOT NULL
        )
      `)
    ]);

    // Register owner
    const regReq1 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "collabOwner", email: "collab_owner@test.com", password: "password123" }
    });
    const regRes1 = await SELF.fetch(regReq1);
    ownerId = (await getResponseJson(regRes1)).data.id;

    const loginReq1 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "collab_owner@test.com", password: "password123" }
    });
    ownerToken = getCookiesFromResponse(await SELF.fetch(loginReq1)).token;

    // Register editor
    const regReq2 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "collabEditor", email: "collab_edit@test.com", password: "password123" }
    });
    const regRes2 = await SELF.fetch(regReq2);
    editorId = (await getResponseJson(regRes2)).data.id;

    const loginReq2 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "collab_edit@test.com", password: "password123" }
    });
    editorToken = getCookiesFromResponse(await SELF.fetch(loginReq2)).token;

    // Create a repo & file
    const repoReq = createTestRequest("POST", "/api/repositories", {
      body: { name: "Collab Repo" },
      cookies: { token: ownerToken }
    });
    const repoRes = await SELF.fetch(repoReq);
    repoId = (await getResponseJson(repoRes)).data.id;

    const fileReq = createTestRequest("POST", "/api/files", {
      body: { path: "/collab-test.md", content: "hello world", repositoryId: repoId },
      cookies: { token: ownerToken }
    });
    const fileRes = await SELF.fetch(fileReq);
    fileId = (await getResponseJson(fileRes)).data.id;

    // Assign editor role to the other user
    const assignReq = createTestRequest("POST", `/api/assignments/${fileId}`, {
        body: { email: "collab_edit@test.com", role: "editor" },
        cookies: { token: ownerToken }
    });
    await SELF.fetch(assignReq);
  });

  describe("Highlights Optimistic Locking", () => {
    let highlightUpdatedAt: number;

    it("should create a highlight", async () => {
      const request = createTestRequest("POST", "/api/highlights", {
        body: {
            fileId,
            startOffset: 0,
            endOffset: 5,
            color: "#ff0000",
            textSnapshot: "hello"
        },
        cookies: { token: ownerToken }
      });
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      highlightId = data.data.id;
      highlightUpdatedAt = data.data.updatedAt;
    });

    it("should allow an update with correct lastUpdatedAt", async () => {
        const updateReq = createTestRequest("PUT", `/api/highlights/${highlightId}`, {
            body: {
                lastUpdatedAt: highlightUpdatedAt,
                color: "#00ff00"
            },
            cookies: { token: ownerToken }
        });
        const updateRes = await SELF.fetch(updateReq);
        const data = await getResponseJson(updateRes);

        expect(updateRes.status).toBe(200);
        expect(data.data.color).toBe("#00ff00");
        highlightUpdatedAt = data.data.updatedAt; // Update our known timestamp
    });

    it("should reject an update with an old lastUpdatedAt (optimistic locking failure)", async () => {
        const staleTimestamp = highlightUpdatedAt - 100; // Pretend we have outdated data

        const updateReq = createTestRequest("PUT", `/api/highlights/${highlightId}`, {
            body: {
                lastUpdatedAt: staleTimestamp,
                color: "#0000ff"
            },
            cookies: { token: ownerToken }
        });
        const updateRes = await SELF.fetch(updateReq);
        const data = await getResponseJson(updateRes);

        expect(updateRes.status).toBe(409);
        expect(data.code).toBe("CONFLICT_OPTIMISTIC_LOCK");
    });
  });

  describe("Raw Markdown Editor Access", () => {
    it("should allow owner to perform raw code edit", async () => {
      const request = createTestRequest("PUT", "/api/files/%2Fcollab-test.md/raw", {
        body: { content: "hello world - raw edit by owner" },
        cookies: { token: ownerToken }
      });
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should deny standard editor (non-owner) from performing raw code edit", async () => {
        const request = createTestRequest("PUT", "/api/files/%2Fcollab-test.md/raw", {
          body: { content: "raw edit by editor" },
          cookies: { token: editorToken }
        });
        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
    });

    it("should still allow standard editor to perform normal file edit", async () => {
        const request = createTestRequest("PUT", "/api/files/%2Fcollab-test.md", {
          body: { content: "normal edit by editor" },
          cookies: { token: editorToken }
        });
        const response = await SELF.fetch(request);
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON:", text);
            data = { success: false, error: text };
        }

        if (response.status !== 200) {
            console.error("Test failed with status", response.status, "and data", data);
        }

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
    });
  });
});
