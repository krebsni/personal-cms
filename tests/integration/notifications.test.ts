// Integration tests for Notifications API
import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import { createTestRequest, getResponseJson, getCookiesFromResponse } from "../helpers/test-utils";

describe("Notifications API", () => {
  let ownerToken: string;
  let ownerId: string;
  let requesterToken: string;
  let requesterId: string;
  let repoId: string;
  let fileId: string;
  let notificationId: string;

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
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          recipient_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          type TEXT NOT NULL,
          resource_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL
        )
      `)
    ]);

    // Register an owner
    const regReq1 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "notifOwner", email: "notif_owner@test.com", password: "password123" }
    });
    const regRes1 = await SELF.fetch(regReq1);
    ownerId = (await getResponseJson(regRes1)).data.id;

    const loginReq1 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "notif_owner@test.com", password: "password123" }
    });
    ownerToken = getCookiesFromResponse(await SELF.fetch(loginReq1)).token;

    // Register a requester
    const regReq2 = createTestRequest("POST", "/api/auth/register", {
      body: { username: "notifRequester", email: "notif_req@test.com", password: "password123" }
    });
    const regRes2 = await SELF.fetch(regReq2);
    requesterId = (await getResponseJson(regRes2)).data.id;

    const loginReq2 = createTestRequest("POST", "/api/auth/login", {
      body: { email: "notif_req@test.com", password: "password123" }
    });
    requesterToken = getCookiesFromResponse(await SELF.fetch(loginReq2)).token;

    // Create a repository owned by owner
    const repoReq = createTestRequest("POST", "/api/repositories", {
      body: { name: "Notif Repo" },
      cookies: { token: ownerToken }
    });
    const repoRes = await SELF.fetch(repoReq);
    repoId = (await getResponseJson(repoRes)).data.id;

    // Create a file in that repository (defaults to owner)
    const fileReq = createTestRequest("POST", "/api/files", {
      body: { path: "/notif-test.md", content: "hello notifications", repositoryId: repoId },
      cookies: { token: ownerToken }
    });
    const fileRes = await SELF.fetch(fileReq);
    fileId = (await getResponseJson(fileRes)).data.id;
  });

  describe("Access Request Flow", () => {
    it("should allow a user to request access to a resource", async () => {
      const request = createTestRequest("POST", "/api/notifications/request-access", {
        body: { resourceId: fileId },
        cookies: { token: requesterToken }
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      notificationId = data.data.id;
    });

    it("should prevent duplicate pending requests", async () => {
        const request = createTestRequest("POST", "/api/notifications/request-access", {
          body: { resourceId: fileId },
          cookies: { token: requesterToken }
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.message).toBe("Request already sent");
    });

    it("should list notifications for the owner", async () => {
      const request = createTestRequest("GET", "/api/notifications", {
        cookies: { token: ownerToken }
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(1);

      const notification = data.data.find((n: any) => n.id === notificationId);
      expect(notification).toBeDefined();
      expect(notification.sender_username).toBe("notifRequester");
      expect(notification.status).toBe("pending");
    });

    it("should prevent requester from resolving the notification", async () => {
        const request = createTestRequest("POST", `/api/notifications/${notificationId}/resolve`, {
          body: { action: "accept" },
          cookies: { token: requesterToken }
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
    });

    it("should allow owner to accept the access request as viewer", async () => {
      const request = createTestRequest("POST", `/api/notifications/${notificationId}/resolve`, {
        body: { action: "accept", role: "viewer" },
        cookies: { token: ownerToken }
      });

      const response = await SELF.fetch(request);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should reflect the accepted status in owner notifications", async () => {
        const request = createTestRequest("GET", "/api/notifications", {
          cookies: { token: ownerToken }
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        const notification = data.data.find((n: any) => n.id === notificationId);
        expect(notification.status).toBe("accepted");
    });

    it("should have created an assignment granting access", async () => {
       const request = createTestRequest("GET", `/api/files/%2Fnotif-test.md`, {
           cookies: { token: requesterToken }
       });

       const response = await SELF.fetch(request);
       expect(response.status).toBe(200); // Because they were just granted viewer access
    });

    it("should allow owner to delete/dismiss the notification", async () => {
        const request = createTestRequest("DELETE", `/api/notifications/${notificationId}`, {
            cookies: { token: ownerToken }
        });

        const response = await SELF.fetch(request);
        const data = await getResponseJson(response);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify it's gone
        const verifyReq = createTestRequest("GET", "/api/notifications", {
            cookies: { token: ownerToken }
        });

        const verifyRes = await SELF.fetch(verifyReq);
        const verifyData = await getResponseJson(verifyRes);
        const notification = verifyData.data.find((n: any) => n.id === notificationId);
        expect(notification).toBeUndefined();
    });
  });
});
