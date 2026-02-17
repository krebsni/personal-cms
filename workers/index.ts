// Main Cloudflare Worker - API Router
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types";

import { authApp } from "./auth";
import { filesApp } from "./files";
import { permissionsApp } from "./permissions";
import { highlightsApp } from "./highlights";
import { adminApp } from "./admin";
import { CollaborationRoom } from "./collaboration";

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", secureHeaders());
app.use("*", cors({
  origin: "*", // TODO: Restrict in production
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Mount API routes
// Note: Hono's route() mounts the app.
// Since we defined sub-apps with their own routes, we mount them at specific prefixes.

app.route("/api/auth", authApp);
app.route("/api/files", filesApp);
app.route("/api/permissions", permissionsApp);
app.route("/api/highlights", highlightsApp);
app.route("/api/highlights", highlightsApp);
app.route("/api/admin", adminApp);

// Collaboration Route (Durable Object)
app.all("/api/collaboration/:fileId/*", (c) => {
  const fileId = c.req.param("fileId");
  const id = c.env.COLLABORATION_ROOM.idFromName(fileId);
  const stub = c.env.COLLABORATION_ROOM.get(id);

  // Rewrite URL to match what the DO expects (strip prefix)
  // The DO is mounted at /, so we strip /api/collaboration/:fileId
  // The wildcard * will be the path inside the DO
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(`/api/collaboration/${fileId}`, "");
  if (url.pathname === "") url.pathname = "/";

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT || "development",
    timestamp: Date.now(),
  });
});

app.get("/", (c) => {
  return c.json({
    message: "Personal CMS API",
    status: "online",
    docs: "/api/docs"
  });
});

// 404 Handler
app.notFound((c) => {
  return c.json({ success: false, error: `Route not found: ${c.req.path}` }, 404);
});

// Error Handler
app.onError((err, c) => {
  console.error("Worker error:", err);
  return c.json({
    success: false,
    error: err instanceof Error ? err.message : "Internal server error"
  }, 500);
});

export default app;
export type { Env };
export { CollaborationRoom };
