// API client for backend communication
import type {
  ApiResponse,
  User,
  LoginCredentials,
  RegisterData,
  FileMetadata,
  Highlight,
  HighlightColor,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        credentials: "include", // Include cookies for JWT
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  // Authentication endpoints
  async login(credentials: LoginCredentials): Promise<ApiResponse<User>> {
    return this.request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async register(data: RegisterData): Promise<ApiResponse<User>> {
    return this.request<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>("/api/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>("/api/auth/me");
  }

  // File endpoints
  async getFiles(): Promise<ApiResponse<FileMetadata[]>> {
    return this.request<FileMetadata[]>("/api/files");
  }

  async getFile(path: string): Promise<ApiResponse<{ content: string; metadata: FileMetadata }>> {
    return this.request<{ content: string; metadata: FileMetadata }>(
      `/api/files/${encodeURIComponent(path)}`
    );
  }

  async uploadFile(file: File, path: string): Promise<ApiResponse<FileMetadata>> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    try {
      const response = await fetch(`${this.baseUrl}/api/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Upload failed: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  async deleteFile(path: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/files/${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
  }

  // Highlight endpoints
  async getHighlights(fileId: string): Promise<ApiResponse<Highlight[]>> {
    return this.request<Highlight[]>(`/api/highlights/${fileId}`);
  }

  async createHighlight(
    highlight: Omit<Highlight, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<Highlight>> {
    return this.request<Highlight>("/api/highlights", {
      method: "POST",
      body: JSON.stringify(highlight),
    });
  }

  async updateHighlight(id: string, updates: Partial<Highlight>): Promise<ApiResponse<Highlight>> {
    return this.request<Highlight>(`/api/highlights/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteHighlight(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/highlights/${id}`, {
      method: "DELETE",
    });
  }

  // Highlight colors (admin)
  async getHighlightColors(): Promise<ApiResponse<HighlightColor[]>> {
    return this.request<HighlightColor[]>("/api/config/colors");
  }

  async createHighlightColor(
    color: Omit<HighlightColor, "id">
  ): Promise<ApiResponse<HighlightColor>> {
    return this.request<HighlightColor>("/api/admin/config/colors", {
      method: "POST",
      body: JSON.stringify(color),
    });
  }

  async deleteHighlightColor(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/admin/config/colors/${id}`, {
      method: "DELETE",
    });
  }

  // Admin - User management
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>("/api/admin/users");
  }

  async createUser(
    userData: Omit<User, "id" | "createdAt" | "updatedAt"> & { password: string }
  ): Promise<ApiResponse<User>> {
    return this.request<User>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/admin/users/${id}`, {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient(API_URL);
export default api;
