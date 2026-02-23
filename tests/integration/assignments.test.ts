// Integration tests for Assignments API
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse } from "../helpers/test-utils";

describe("Assignments API", () => {
  let userToken: string;
  let ownerId: string;
  let viewerToken: string;
  let viewerId: string;

  beforeAll(async () => {
    // Basic migrations are assumed to be loaded by previous test suites
    // or by vitest setup. We ensure tables are recreated if needed or rely on cleanup.
    // For cloudflare:test we should ensure schema.
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
      `)
    ]);

    // Register owners
    const registerReq1 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "assignmentOwner", email: "owner@test.com", password: "password123" }
    });
    const regRes1 = await SELF.fetch(registerReq1);
    ownerId = (await getResponseJson(regRes1)).data.id;

    const loginReq1 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "owner@test.com", password: "password123" }
    });
    userToken = getCookiesFromResponse(await SELF.fetch(loginReq1)).token;

    // Register viewer
    const registerReq2 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "assignmentViewer", email: "viewer@test.com", password: "password123" }
    });
    const regRes2 = await SELF.fetch(registerReq2);
    viewerId = (await getResponseJson(regRes2)).data.id;

    const loginReq2 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "viewer@test.com", password: "password123" }
    });
    viewerToken = getCookiesFromResponse(await SELF.fetch(loginReq2)).token;
  });

  describe("Permissions via Assignments", () => {
    let fileId: string;

    it("should allow owner to assign a user to a file", async () => {
      // Create a file
      const uploadRequest = createTestRequest("POST", "/api/files", {
        body: { path: "/assignment-test.md", content: "hello" },
        cookies: { token: userToken }
      });
      const uploadRes = await SELF.fetch(uploadRequest);
      fileId = (await getResponseJson(uploadRes)).data.id;

      // Create an assignment
      const assignReq = createTestRequest("POST", `/api/assignments/${fileId}`, {
        body: { email: "viewer@test.com", role: "viewer" },
        cookies: { token: userToken }
      });
      const assignRes = await SELF.fetch(assignReq);
      const data = await getResponseJson(assignRes);

      expect(assignRes.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.role).toBe("viewer");
    });

    it("should list assignments for the file", async () => {
      const request = createTestRequest("GET", `/api/assignments/${fileId}`, {
        cookies: { token: userToken }
      });
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].username).toBe("assignmentViewer");
    });

    it("should allow assigned user to read file", async () => {
      const getReq = createTestRequest("GET", `/api/files/%2Fassignment-test.md`, {
        cookies: { token: viewerToken }
      });
      const response = await SELF.fetch(getReq);
      expect(response.status).toBe(200);
    });

    it("should deny assigned user to write file if role is viewer", async () => {
      const putReq = createTestRequest("PUT", `/api/files/%2Fassignment-test.md`, {
        body: { content: "unauthorized edit" },
        cookies: { token: viewerToken }
      });
      const response = await SELF.fetch(putReq);
      expect(response.status).toBe(403);
    });

    it("should update assignment to editor and allow write", async () => {
      const updateReq = createTestRequest("POST", `/api/assignments/${fileId}`, {
        body: { email: "viewer@test.com", role: "editor" },
        cookies: { token: userToken }
      });
      await SELF.fetch(updateReq);

      const putReq = createTestRequest("PUT", `/api/files/%2Fassignment-test.md`, {
        body: { content: "authorized edit" },
        cookies: { token: viewerToken }
      });
      const response = await SELF.fetch(putReq);
      expect(response.status).toBe(200);
    });

    it("should allow owner to delete assignment", async () => {
      const deleteReq = createTestRequest("DELETE", `/api/assignments/${fileId}/${viewerId}`, {
        cookies: { token: userToken }
      });
      const response = await SELF.fetch(deleteReq);
      expect(response.status).toBe(200);

      // Verify no longer readable
      const getReq = createTestRequest("GET", `/api/files/%2Fassignment-test.md`, {
        cookies: { token: viewerToken }
      });
      const getRes = await SELF.fetch(getReq);
      expect(getRes.status).toBe(403);
    });
  });
});
