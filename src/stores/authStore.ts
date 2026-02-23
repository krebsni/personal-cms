// Authentication state management with Zustand
import { create } from "zustand";
import type { User, LoginCredentials, RegisterData } from "../types";
import { api } from "../services/api";

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true, // Start loading by default
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    const response = await api.login(credentials);

    if (response.success && response.data) {
      set({
        user: response.data,
        isAuthenticated: true,
        isAdmin: response.data.role === "admin",
        isLoading: false,
        error: null,
      });
      return true;
    } else {
      set({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
        error: response.error || "Login failed",
      });
      return false;
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });

    const response = await api.register(data);

    if (response.success && response.data) {
      set({
        user: response.data,
        isAuthenticated: true,
        isAdmin: response.data.role === "admin",
        isLoading: false,
        error: null,
      });
      return true;
    } else {
      set({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
        error: response.error || "Registration failed",
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    await api.logout();

    set({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
  },

  checkAuth: async () => {
    set({ isLoading: true });

    try {
      const response = await api.getCurrentUser();

      if (response.success && response.data) {
        set({
          user: response.data,
          isAuthenticated: true,
          isAdmin: response.data.role === "admin",
          isLoading: false,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isAdmin: false,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
