import { env, createExecutionContext, waitOnExecutionContext, self } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import worker, { CollaborationRoom } from "../../workers/index";

// Define the Durable Object binding
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Collaboration DO", () => {
    it("should handle WebSocket upgrade", async () => {
        const fileId = "test-file-1";
        const id = env.COLLABORATION_ROOM.idFromName(fileId);
        const stub = env.COLLABORATION_ROOM.get(id);

        const response = await stub.fetch("http://localhost/", {
            headers: {
                Upgrade: "websocket",
            },
        });

        expect(response.status).toBe(101);
        expect(response.webSocket).toBeDefined();
    });

    it("should reject non-WebSocket requests to root", async () => {
        const fileId = "test-file-2";
        const id = env.COLLABORATION_ROOM.idFromName(fileId);
        const stub = env.COLLABORATION_ROOM.get(id);

        const response = await stub.fetch("http://localhost/");
        expect(response.status).toBe(400);
        expect(await response.text()).toBe("Expected WebSocket");
    });

    it("should support presence API", async () => {
        const fileId = "test-file-3";
        const id = env.COLLABORATION_ROOM.idFromName(fileId);
        const stub = env.COLLABORATION_ROOM.get(id);

        // First connect a user via WebSocket to populate presence
        const wsResponse = await stub.fetch("http://localhost/?userId=user1&username=User1", {
            headers: { Upgrade: "websocket" },
        });
        const clientWs = wsResponse.webSocket;
        if (!clientWs) throw new Error("WebSocket not returned");
        clientWs.accept();

        // Check presence
        const response = await stub.fetch("http://localhost/presence");
        expect(response.status).toBe(200);
        const data = await response.json() as any;

        expect(data.presence).toBeDefined();
        expect(Array.isArray(data.presence)).toBe(true);
        expect(data.presence.length).toBe(1);
        expect(data.presence[0].userId).toBe("user1");
    });
});
