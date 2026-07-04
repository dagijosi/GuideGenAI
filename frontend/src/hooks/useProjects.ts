import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Project, CreateProjectPayload } from '../types';

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => api.get<Project[]>('/v1/projects').then((r) => r.data),
  });
}

export function useProject(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api.get<Project>(`/v1/projects/${id}`).then((r) => r.data),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll while running; also poll while stopping so we catch the final paused/failed status
      if (status === 'running') return 2000;
      if (status === 'stopping') return 1000; // faster poll to catch transition quickly
      return false;
    },
    // When we transition OUT of stopping, do one final fresh fetch
    structuralSharing: (oldData, newData) => {
      const old = oldData as Project | undefined;
      const next = newData as Project;
      if (old?.status === 'stopping' && next.status !== 'stopping') {
        // Invalidate the list too so the project card updates
        queryClient.invalidateQueries({ queryKey: projectKeys.all });
      }
      return next;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      api.post<Project>('/v1/projects', payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useStartProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ message: string }>(`/v1/projects/${id}/start`).then((r) => r.data),
    onSuccess: (_data, id) =>
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) }),
  });
}

export function useStopProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ message: string }>(`/v1/projects/${id}/stop`).then((r) => r.data),
    onMutate: (id) => {
      // Optimistically mark as 'stopping' immediately — stops polling loop from continuing
      queryClient.setQueryData<Project>(projectKeys.detail(id), (old) =>
        old ? { ...old, status: 'stopping' } : old,
      );
      queryClient.setQueryData<Project[]>(projectKeys.all, (old) =>
        old?.map(p => p.id === id ? { ...p, status: 'stopping' } : p),
      );
    },
    onSettled: (_data, _err, id) => {
      // Let the real status come in from the server
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useCancelProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ message: string }>(`/v1/projects/${id}/cancel`).then((r) => r.data),
    onMutate: (id) => {
      // Optimistically mark as 'stopping' immediately
      queryClient.setQueryData<Project>(projectKeys.detail(id), (old) =>
        old ? { ...old, status: 'stopping' } : old,
      );
      queryClient.setQueryData<Project[]>(projectKeys.all, (old) =>
        old?.map(p => p.id === id ? { ...p, status: 'stopping' } : p),
      );
    },
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/projects/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateProjectPayload> }) =>
      api.patch<Project>(`/v1/projects/${id}`, payload).then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}

export function useResetProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Project>(`/v1/projects/${id}/reset`).then((r) => r.data),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}
