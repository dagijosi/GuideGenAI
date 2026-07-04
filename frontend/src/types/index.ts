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
  /** Running count of pages crawled so far — emitted during the crawl phase */
  pageCount?: number;
}

export interface WorkflowStep {
  order: number;
  pageTitle: string;
  url: string;
  action: string;
  screenshotPath?: string;
}

export interface IWorkflow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  videoPath?: string;
  createdAt: string;
}

export interface ProjectStats {
  totalProjects: number;
  completedProjects: number;
  failedProjects: number;
  totalPages: number;
  totalWorkflows: number;
  totalScreenshots: number;
}

export type DocGenerationMode = 'full' | 'overview' | 'workflow';

export interface WorkflowGuide {
  workflowName: string;
  pagetitles: string[];
  content: string;
  stepScreenshots?: Array<{ pageTitle: string; url: string; screenshotPath?: string }>;
  generatedAt: string;
}

export interface PageDocumentation {
  pageId: string;
  url: string;
  title: string;
  overview: string;
  whenToUse?: string;
  beforeYouBegin?: string;
  features: string[];
  userGuide: string;
  tips: string[];
  commonMistakes?: string[];
  afterCompletion?: string;
  relatedTasks?: string[];
  warnings: string[];
  faq: Array<{ question: string; answer: string }>;
  testCases: string[];
  releaseNotes: string;
  developerNotes?: string;
  templateRepresentativeUrl?: string;
  templateGroupSize?: number;
  screenshotPath?: string;
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
  workflowGuides?: WorkflowGuide[];
  faq: Array<{ question: string; answer: string }>;
  troubleshooting: string;
  releaseNotes: string;
  developerGuide: string;
  glossary: Record<string, string>;
  generationMode?: DocGenerationMode;
  generatedAt: string;
}

export interface DocSummary {
  pageCount: number;
  generatedAt: string;
  generationMode?: DocGenerationMode;
}
