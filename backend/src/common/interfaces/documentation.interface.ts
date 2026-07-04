export interface PageDocumentation {
  pageId: string;
  url: string;
  title: string;
  /** What this page is and what users can accomplish here */
  overview: string;
  /** Situations where a user would visit this page */
  whenToUse: string;
  /** Prerequisites or information the user should have before starting */
  beforeYouBegin: string;
  /** Key sections or features explained in plain language */
  features: string[];
  /** Step-by-step task instructions written for non-technical users */
  userGuide: string;
  /** Practical tips that make the work easier */
  tips: string[];
  /** Common mistakes and how to avoid or recover from them */
  commonMistakes: string[];
  /** What the user should do after completing the task on this page */
  afterCompletion: string;
  /** Related pages or tasks the user may need next */
  relatedTasks: string[];
  /** Warnings about destructive or irreversible actions */
  warnings: string[];
  faq: Array<{ question: string; answer: string }>;
  testCases: string[];
  releaseNotes: string;
  developerNotes?: string;
  /**
   * Set when this page shares a template with others.
   * Points to the URL of the representative page whose documentation
   * was used for this page.
   */
  templateRepresentativeUrl?: string;
  /** How many pages share this template (including this one) */
  templateGroupSize?: number;
  /** Screenshot captured during crawl — attached from metadata, no extra AI cost */
  screenshotPath?: string;
  generatedAt: string;
}

export type DocGenerationMode = 'full' | 'overview' | 'workflow' | 'discovery';

export interface WorkflowGuide {
  /** Name of the workflow this guide covers */
  workflowName: string;
  /** The pages in this workflow (titles) */
  pagetitles: string[];
  /** The full end-to-end guide text */
  content: string;
  /** Screenshots for each workflow step — joined from crawl metadata */
  stepScreenshots?: Array<{ pageTitle: string; url: string; screenshotPath?: string }>;
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
  /** End-to-end workflow guides generated in workflow or full mode */
  workflowGuides?: WorkflowGuide[];
  faq: Array<{ question: string; answer: string }>;
  troubleshooting: string;
  releaseNotes: string;
  developerGuide: string;
  glossary: Record<string, string>;
  /** Which generation mode produced this documentation */
  generationMode: DocGenerationMode;
  generatedAt: string;
}
