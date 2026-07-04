export type ProjectStatus = 'idle' | 'running' | 'stopping' | 'completed' | 'failed' | 'paused';

export interface Project {
  id: string;
  name: string;
  url: string;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  workflowCount: number;
  screenshotCount: number;
  videoCount: number;
  maxDepth: number;
  maxPages: number;
  includeScreenshots: boolean;
  credentials?: { username?: string; password?: string };
  error?: string;
}

export interface CreateProjectPayload {
  name: string;
  url: string;
  username?: string;
  password?: string;
  maxDepth?: number;
  maxPages?: number;
  includeScreenshots?: boolean;
  includeVideo?: boolean;
}

export interface ProgressEvent {
  projectId: string;
  step: string;
  message: string;
  progress: number;
  timestamp: string;
}

export interface ProjectStats {
  totalProjects: number;
  completedProjects: number;
  failedProjects: number;
  totalPages: number;
  totalWorkflows: number;
  totalScreenshots: number;
}

export interface PageDocumentation {
  pageId: string;
  url: string;
  title: string;
  overview: string;
  features: string[];
  userGuide: string;
  tips: string[];
  warnings: string[];
  faq: Array<{ question: string; answer: string }>;
  testCases: string[];
  releaseNotes: string;
  developerNotes?: string;
  generatedAt: string;
}

export interface ProjectDocumentation {
  projectId: string;
  projectName: string;
  overview: string;
  gettingStarted: string;
  features: string[];
  pages: PageDocumentation[];
  workflows: string[];
  faq: Array<{ question: string; answer: string }>;
  troubleshooting: string;
  releaseNotes: string;
  developerGuide: string;
  glossary: Record<string, string>;
  generatedAt: string;
}
