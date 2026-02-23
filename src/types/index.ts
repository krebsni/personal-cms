// Core type definitions for the Personal CMS

export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  createdAt: number;
  updatedAt: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FileMetadata {
  id: string;
  path: string;
  ownerId: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  path: string;
  ownerId: string;
  parentId: string | null;
  createdAt: number;
}

export interface Permission {
  id: string;
  fileId: string;
  userId: string | null; // null means public
  permission: "read" | "write";
  createdAt: number;
}

export interface Highlight {
  id: string;
  fileId: string;
  userId: string;
  startOffset: number;
  endOffset: number;
  color: string;
  textSnapshot: string;
  createdAt: number;
  updatedAt: number;
}

export interface HighlightColor {
  id: string;
  name: string;
  hexCode: string;
  isDefault: boolean;
  sortOrder: number;
}
