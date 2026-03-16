import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';

export function useAuthSession() {
  const { setUser, setLoading } = useAuthStore();

  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      try {
        setLoading(true);
        const userData = await fetchApi<User>('/auth/me');
        setUser(userData);
        return userData;
      } catch (err: any) {
        // If 401, they are just not logged in.
        // The API wrapper might have already logged them out
        setUser(null);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    retry: false, // Don't retry auth checks
  });
}

export function useLogin() {
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (credentials: any) => {
      const data = await fetchApi<User>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return data;
    },
    onSuccess: (data) => {
      setUser(data);
    },
  });
}

export function useRegister() {
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (userData: any) => {
      const data = await fetchApi<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      return data;
    },
    onSuccess: (data) => {
      setUser(data);
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      await fetchApi('/auth/logout', { method: 'POST' });
    },
    onSettled: () => {
      // Regardless of success/fail, clear local session
      logout();
    },
  });
}
