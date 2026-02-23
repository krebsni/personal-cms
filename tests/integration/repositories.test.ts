// Integration tests for Repositories API
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse } from "../helpers/test-utils";

describe("Repositories API", () => {
  let userToken: string;
  let userId: string;
  let otherUserToken: string;
  let otherUserId: string;

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
        CREATE TABLE IF NOT EXISTS repositories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
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
          created_at INTEGER NOT NULL
        )
      `)
    ]);

    // Register and login user 1
    const registerReq1 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "repouser1", email: "repo1@test.com", password: "password123" }
    });
    const regRes1 = await SELF.fetch(registerReq1);
    const regData1 = await getResponseJson(regRes1);
    userId = regData1.data.id;

    const loginReq1 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "repo1@test.com", password: "password123" }
    });
    const loginRes1 = await SELF.fetch(loginReq1);
    const cookies1 = getCookiesFromResponse(loginRes1);
    userToken = cookies1.token;

    // Register and login user 2
    const registerReq2 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "repouser2", email: "repo2@test.com", password: "password123" }
    });
    const regRes2 = await SELF.fetch(registerReq2);
    const regData2 = await getResponseJson(regRes2);
    otherUserId = regData2.data.id;

    const loginReq2 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "repo2@test.com", password: "password123" }
    });
    const loginRes2 = await SELF.fetch(loginReq2);
    const cookies2 = getCookiesFromResponse(loginRes2);
    otherUserToken = cookies2.token;
  });

  describe("CRUD Operations", () => {
    let repoId: string;

    it("should create a new repository", async () => {
      const request = createTestRequest("POST", "/api/repositories", {
        body: { name: "My First Vault" },
        cookies: { token: userToken }
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("My First Vault");
      expect(data.data.owner_id).toBe(userId);
      repoId = data.data.id;
    });

    it("should reject creation without auth", async () => {
      const request = createTestRequest("POST", "/api/repositories", {
        body: { name: "No Auth Vault" }
      });
      const response = await SELF.fetch(request);
      expect(response.status).toBe(401);
    });

    it("should list repositories for the user", async () => {
      const request = createTestRequest("GET", "/api/repositories", {
        cookies: { token: userToken }
      });
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0].id).toBe(repoId);
    });

    it("should get specific repository details", async () => {
      const request = createTestRequest("GET", `/api/repositories/${repoId}`, {
        cookies: { token: userToken }
      });
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("My First Vault");
    });

    it("should deny access to repository for unauthorized user without assignments", async () => {
      const request = createTestRequest("GET", `/api/repositories/${repoId}`, {
        cookies: { token: otherUserToken }
      });
      const response = await SELF.fetch(request);
      expect(response.status).toBe(403);
    });

    it("should update repository name", async () => {
      const request = createTestRequest("PUT", `/api/repositories/${repoId}`, {
        body: { name: "Updated Vault" },
        cookies: { token: userToken }
      });
      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify update
      const getReq = createTestRequest("GET", `/api/repositories/${repoId}`, {
        cookies: { token: userToken }
      });
      const getRes = await SELF.fetch(getReq);
      const getData = await getResponseJson(getRes);
      expect(getData.data.name).toBe("Updated Vault");
    });

    it("should delete a repository", async () => {
      const request = createTestRequest("DELETE", `/api/repositories/${repoId}`, {
        cookies: { token: userToken }
      });
      const response = await SELF.fetch(request);
      expect(response.status).toBe(200);

      const getReq = createTestRequest("GET", `/api/repositories/${repoId}`, {
        cookies: { token: userToken }
      });
      const getRes = await SELF.fetch(getReq);
      expect(getRes.status).toBe(404);
    });
  });
});
