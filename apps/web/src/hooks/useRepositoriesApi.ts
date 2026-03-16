import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

export interface Repository {
  id: string;
  name: string;
  owner_id: string;
  created_at: number;
}

export function useFetchRepositories() {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      return await fetchApi<Repository[]>('/repositories');
    },
  });
}

export interface File {
  id: string;
  repository_id: string;
  parent_id: string | null;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  created_at: number;
  updated_at: number;
  version: number;
}

export function useFetchFile(fileId: string) {
  return useQuery({
    queryKey: ['file', fileId],
    queryFn: async () => {
      return await fetchApi<File>(`/files/${fileId}`);
    },
    enabled: !!fileId,
  });
}

export function useUpdateFile(fileId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name?: string; content?: string }) => {
      // The update endpoint expects standard updates for file. Here we might need to increment version or handle conflicts,
      // but assuming the backend handles basic updates.
      return await fetchApi(`/files/${fileId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', fileId] });
    },
  });
}
