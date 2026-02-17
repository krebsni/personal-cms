// Shared utilities for Cloudflare Workers

// Generate UUID v4
export function generateId(): string {
  return crypto.randomUUID();
}
