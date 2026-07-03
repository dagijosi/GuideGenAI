import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface ProjectFile {
  name: string;
  path: string;
  type: 'screenshot' | 'video' | 'document' | 'export' | 'other';
  size: number;
  createdAt: string;
}

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ['files', projectId],
    queryFn: () => api.get<ProjectFile[]>(`/v1/files/${projectId}`).then((r) => r.data),
  });
}

export function useProjectScreenshots(projectId: string) {
  return useQuery({
    queryKey: ['screenshots', projectId],
    queryFn: () =>
      api.get<ProjectFile[]>(`/v1/files/${projectId}/screenshots`).then((r) => r.data),
  });
}
