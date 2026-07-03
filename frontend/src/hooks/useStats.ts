import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProjectStats } from '../types';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<ProjectStats>('/v1/reports/stats').then((r) => r.data),
  });
}
