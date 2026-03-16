import { useAuthStore } from '../store/authStore';
import type { ApiResponse } from '../types';

export class ApiError extends Error {
  public status: number;
  public data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

/**
 * Standard fetch wrapper that enforces explicit error handling (Fail Loudly).
 * Checks response status and parses JSON. Also intercepts 401 to logout.
 */
export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `/api${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Intercept unauthorized requests and log out
    useAuthStore.getState().logout();
  }

  // Handle No Content
  if (response.status === 204) {
    return {} as T;
  }

  let data: ApiResponse<T>;
  try {
    data = await response.json();
  } catch (err) {
    if (!response.ok) {
      throw new ApiError(`Server returned ${response.status} without JSON body`, response.status);
    }
    throw new Error(`Failed to parse response JSON for ${url}`);
  }

  // Enforce standard Cloudflare Worker response format
  if (!response.ok || data.success === false) {
    throw new ApiError(
      data.error || data.message || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }

  // For /api/auth/login, etc., the backend returns { success: true, data: User }
  // depending on the exact implementation, we might need data.data or data.
  // The worker auth wrapper uses `c.json({ success: true, data: userData, message: "..." })`
  if (data && 'data' in data) {
    return data.data as T;
  }

  return data as unknown as T;
}
