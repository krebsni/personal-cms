// Main Cloudflare Worker - API Router
import { authRouter } from "./auth";

// Environment bindings from wrangler.toml
export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  COLLABORATION_ROOM: DurableObjectNamespace;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: Restrict in production
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// Add CORS headers to response
function addCorsHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  return newResponse;
}

// JSON response helper
function jsonResponse(data: unknown, status = 200): Response {
  return addCorsHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Error response helper
function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ success: false, error }, status);
}

// Success response helper
function successResponse(data: unknown, message?: string): Response {
  return jsonResponse({ success: true, data, message });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check endpoint
      if (path === "/health" || path === "/") {
        return successResponse({
          status: "ok",
          environment: env.ENVIRONMENT || "development",
          timestamp: Date.now(),
        });
      }

      // Auth routes
      if (path.startsWith("/api/auth")) {
        return await authRouter(request, env, { successResponse, errorResponse });
      }

      // Files routes (TODO: Phase 3.3)
      if (path.startsWith("/api/files")) {
        return errorResponse("Files API not yet implemented", 501);
      }

      // Highlights routes (TODO: Phase 3.5)
      if (path.startsWith("/api/highlights")) {
        return errorResponse("Highlights API not yet implemented", 501);
      }

      // Config routes (public)
      if (path.startsWith("/api/config")) {
        return errorResponse("Config API not yet implemented", 501);
      }

      // Admin routes (TODO: Phase 3.6)
      if (path.startsWith("/api/admin")) {
        return errorResponse("Admin API not yet implemented", 501);
      }

      // 404 - Route not found
      return errorResponse(`Route not found: ${path}`, 404);
    } catch (error) {
      console.error("Worker error:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Internal server error",
        500
      );
    }
  },
};

// Export response helpers for use in route modules
export type ResponseHelpers = {
  successResponse: typeof successResponse;
  errorResponse: typeof errorResponse;
};
