export type ExportFormat = 'markdown' | 'pdf' | 'html' | 'docx' | 'json' | 'zip';

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface CrawlJobOptions {
  maxDepth: number;
  maxPages: number;
  includeScreenshots: boolean;
  includeVideo: boolean;
  followExternalLinks: boolean;
  waitForNetworkIdle: boolean;
}

export interface ProgressEvent {
  projectId: string;
  step: string;
  message: string;
  progress: number;
  timestamp: string;
  /** Running count of pages crawled so far — available during the crawl phase */
  pageCount?: number;
}
