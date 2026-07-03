export type ProjectStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface ProjectCredentials {
  username?: string;
  password?: string;
}

export interface IProject {
  id: string;
  name: string;
  url: string;
  credentials?: ProjectCredentials;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  storagePath: string;
  pageCount: number;
  workflowCount: number;
  screenshotCount: number;
  videoCount: number;
  maxDepth: number;
  maxPages: number;
  includeScreenshots: boolean;
  logs: string[];
  error?: string;
}
