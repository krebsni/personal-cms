import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import type { User } from '../types';

export function useFetchUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      return await fetchApi<User[]>('/admin/users');
    },
  });
}

interface AssignPayload {
  resourceId: string;
  email: string;
  role: 'viewer' | 'editor';
}

export function useAssignUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resourceId, email, role }: AssignPayload) => {
      return await fetchApi(`/assignments/${resourceId}`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries if necessary
      // (e.g. ['assignments', resourceId])
      // Currently admin dash just assigns, but doesn't show assignments list directly.
    }
  });
}
