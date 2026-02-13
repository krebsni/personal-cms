// Test utilities and helpers
import type { Env } from "../../workers/index";

// Helper to create a test request
export function createTestRequest(
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): Request {
  const url = `http://localhost:8787${path}`;
  const headers = new Headers(options.headers || {});

  // Add cookies if provided
  if (options.cookies) {
    const cookieString = Object.entries(options.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
    headers.set("Cookie", cookieString);
  }

  // Add content-type for JSON bodies
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return new Request(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

// Helper to extract JSON from response
export async function getResponseJson<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text);
}

// Helper to extract cookies from response
export function getCookiesFromResponse(response: Response): Record<string, string> {
  const setCookie = response.headers.get("Set-Cookie");
  if (!setCookie) return {};

  const cookies: Record<string, string> = {};

  // Parse cookie string: "token=value; HttpOnly; Secure; ..."
  // Split by semicolon and get first part which is key=value
  const cookieParts = setCookie.split(";").map(p => p.trim());

  // First part is always the key=value pair
  if (cookieParts.length > 0) {
    const [key, ...valueParts] = cookieParts[0].split("=");
    if (key && valueParts.length > 0) {
      // Join back in case value contains '='
      cookies[key] = valueParts.join("=");
    }
  }

  return cookies;
}

// Test user data
export const testUsers = {
  admin: {
    username: "testadmin",
    email: "admin@test.com",
    password: "admin123456",
    role: "admin" as const,
  },
  user: {
    username: "testuser",
    email: "user@test.com",
    password: "user123456",
    role: "user" as const,
  },
};

// Test file data
export const testFiles = {
  markdown: {
    path: "/test/readme.md",
    content: "# Test File\n\nThis is a test markdown file.",
  },
  doc: {
    path: "/docs/guide.md",
    content: "# Guide\n\n## Section 1\n\nContent here.",
  },
};

// Helper to create authenticated request
export async function createAuthenticatedRequest(
  worker: any,
  env: Env,
  ctx: ExecutionContext,
  method: string,
  path: string,
  user: typeof testUsers.admin,
  options: any = {}
): Promise<{ request: Request; token: string }> {
  // Login first
  const loginRequest = createTestRequest("POST", "/api/auth/login", {
    body: { email: user.email, password: user.password },
  });

  const loginResponse = await worker.fetch(loginRequest, env, ctx);
  const cookies = getCookiesFromResponse(loginResponse);
  const token = cookies.token;

  // Create authenticated request
  const request = createTestRequest(method, path, {
    ...options,
    cookies: { token },
  });

  return { request, token };
}
