// Collaboration Durable Object - Real-time collaboration for document editing
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import type { Env } from "./index";

interface Session {
  websocket: WebSocket;
  userId: string;
  username: string;
  fileId: string;
  cursorPosition?: number;
  lastSeen: number;
}

interface Message {
  type: "join" | "leave" | "cursor" | "presence" | "edit";
  userId: string;
  username: string;
  fileId: string;
  data?: any;
  timestamp: number;
}

const app = new Hono<{ Bindings: Env }>();

export class CollaborationRoom {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, Session>;
  private app: Hono<{ Bindings: Env }>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();

    // Initialize Hono app for this DO
    this.app = new Hono<{ Bindings: Env }>();

    // WebSocket upgrade route
    this.app.get("/", async (c) => {
      if (c.req.header("Upgrade") === "websocket") {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        await this.handleWebSocket(server, c.req.raw);

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }
      return c.text("Expected WebSocket", 400);
    });

    // Presence API
    this.app.get("/presence", (c) => {
      const presence = Array.from(this.sessions.values()).map((session) => ({
        userId: session.userId,
        username: session.username,
        fileId: session.fileId,
        cursorPosition: session.cursorPosition,
        lastSeen: session.lastSeen,
      }));
      return c.json({ presence });
    });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request, this.env);
  }

  private async handleWebSocket(websocket: WebSocket, request: Request): Promise<void> {
    websocket.accept();

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "anonymous";
    const username = url.searchParams.get("username") || "Anonymous";
    const fileId = url.searchParams.get("fileId") || "";

    const sessionId = crypto.randomUUID();
    const session: Session = {
      websocket,
      userId,
      username,
      fileId,
      lastSeen: Date.now(),
    };

    this.sessions.set(sessionId, session);

    // Send current presence to new user
    this.sendPresence(websocket);

    // Notify others of new user
    this.broadcast(
      {
        type: "join",
        userId,
        username,
        fileId,
        timestamp: Date.now(),
      },
      sessionId
    );

    // Handle messages
    websocket.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data as string) as Message;
        await this.handleMessage(sessionId, message);
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    // Handle close
    websocket.addEventListener("close", () => {
      this.sessions.delete(sessionId);
      this.broadcast({
        type: "leave",
        userId,
        username,
        fileId,
        timestamp: Date.now(),
      });
    });

    // Handle errors
    websocket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
      this.sessions.delete(sessionId);
    });
  }

  private async handleMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastSeen = Date.now();

    switch (message.type) {
      case "cursor":
        // Update cursor position
        session.cursorPosition = message.data.position;
        // Broadcast to others
        this.broadcast(
          {
            ...message,
            userId: session.userId,
            username: session.username,
            timestamp: Date.now(),
          },
          sessionId
        );
        break;

      case "edit":
        // Broadcast edit to all others
        this.broadcast(
          {
            ...message,
            userId: session.userId,
            username: session.username,
            timestamp: Date.now(),
          },
          sessionId
        );
        break;

      case "presence":
        // Send current presence
        this.sendPresence(session.websocket);
        break;
    }
  }

  private broadcast(message: Message, excludeSessionId?: string): void {
    const messageStr = JSON.stringify(message);

    for (const [sessionId, session] of this.sessions.entries()) {
      if (sessionId === excludeSessionId) continue;

      try {
        session.websocket.send(messageStr);
      } catch (error) {
        console.error("Broadcast error:", error);
        this.sessions.delete(sessionId);
      }
    }
  }

  private sendPresence(websocket: WebSocket): void {
    const presence = Array.from(this.sessions.values()).map((session) => ({
      userId: session.userId,
      username: session.username,
      fileId: session.fileId,
      cursorPosition: session.cursorPosition,
      lastSeen: session.lastSeen,
    }));

    websocket.send(
      JSON.stringify({
        type: "presence",
        data: presence,
        timestamp: Date.now(),
      })
    );
  }
}
