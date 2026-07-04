import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DocGenerationMode } from '../types';
import { projectKeys } from './useProjects';

export function useGenerateDocs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, mode, workflowName }: {
      projectId: string;
      mode: DocGenerationMode;
      workflowName?: string;
    }) => {
      const path = mode === 'full'
        ? `/v1/documentation/${projectId}/generate/full`
        : mode === 'workflow'
          ? `/v1/documentation/${projectId}/generate/workflow`
          : `/v1/documentation/${projectId}/generate/overview`;
      const body = mode === 'workflow' ? { workflowName } : undefined;
      return api.post<{ mode: DocGenerationMode; message: string }>(path, body).then(r => r.data);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: ['doc-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['docs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['workflows', projectId] });
    },
  });
}
