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

export interface AssignPayload {
  resourceId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export function useAssignUser() {
  return useMutation({
    mutationFn: async ({ resourceId, email, role }: AssignPayload) => {
      return await fetchApi(`/assignments`, {
        method: 'POST',
        body: JSON.stringify({ resource_id: resourceId, email, role }),
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries if necessary
    }
  });
}

export interface HighlightColor {
  id: string;
  name: string;
  hex_code: string;
}

export interface Highlight {
  id: string;
  file_id: string;
  start_offset: number;
  end_offset: number;
  text_content: string;
  color_id: string;
  created_by: string;
  created_at: number;
  version: number;
}

export function useFetchColors() {
  return useQuery({
    queryKey: ['admin', 'colors'],
    queryFn: async () => {
      return await fetchApi<HighlightColor[]>('/admin/colors');
    },
  });
}

export function useFetchHighlights(fileId: string) {
  return useQuery({
    queryKey: ['highlights', fileId],
    queryFn: async () => {
      // The highlights fetch requires read permissions on the file
      return await fetchApi<Highlight[]>(`/highlights/${fileId}`);
    },
    enabled: !!fileId,
  });
}

export function useCreateHighlight(fileId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { startOffset: number, endOffset: number, textContent: string, colorId: string }) => {
      return await fetchApi(`/highlights/${fileId}`, {
        method: 'POST',
        body: JSON.stringify({
          start_offset: payload.startOffset,
          end_offset: payload.endOffset,
          text_content: payload.textContent,
          color_id: payload.colorId
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['highlights', fileId] });
    }
  });
}

export function useDeleteHighlight(fileId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (highlightId: string) => {
      return await fetchApi(`/highlights/${fileId}/${highlightId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['highlights', fileId] });
    }
  });
}
