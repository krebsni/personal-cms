import { useQuery } from '@tanstack/react-query';
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
